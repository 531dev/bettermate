#include "BetterMateUI.h"

#include <Arduino.h>
#include <WiFi.h>
#include <algorithm>
#include <display/config.h>
#include <display/core/Controller.h>
#include <display/core/process/BrewProcess.h>
#include <display/plugins/BLEScalePlugin.h>
#include <display/ui/bettermate/NextWakeup.h>
#include <version.h>

BetterMateUI::BetterMateUI(Controller *controller, Driver *driver, PluginManager *pluginManager)
    : DefaultUI(controller, driver, pluginManager, false) {
    bm::theme().init();
    applyBetterMateTheme();
    onScreenShown(SCREEN_ID_STANDBY_SCREEN);
    // All derived members and the visible screen must exist before loop() can call our hooks.
    startTask();
}

void BetterMateUI::onScreenShown(ScreensEnum screen) {
    switch (screen) {
    case SCREEN_ID_STANDBY_SCREEN:
        active = &standby;
        break;
    case SCREEN_ID_BREW_SCREEN:
        active = &brew;
        break;
    case SCREEN_ID_STATUS_SCREEN:
        active = &status;
        break;
    case SCREEN_ID_STEAM_SCREEN:
        active = &steam;
        break;
    case SCREEN_ID_WATER_SCREEN:
        active = &water;
        break;
    case SCREEN_ID_GRIND_SCREEN:
        active = &grind;
        break;
    case SCREEN_ID_MENU_SCREEN_NEW:
        active = &menu;
        break;
    case SCREEN_ID_INFO_SCREEN:
        active = &info;
        break;
    case SCREEN_ID_PROFILE_SCREEN:
        active = &profile;
        break;
    default:
        active = nullptr;
        break;
    }
    if (active == nullptr)
        return;

    applyBetterMateTheme();
    gather();
    lv_scr_load(active->root());
    active->onShow(state);
}

void BetterMateUI::onRendered() {
    applyBetterMateTheme();
    if (active != nullptr) {
        gather();
        active->update(state);
    }
}

void BetterMateUI::applyBetterMateTheme() {
    // DefaultUI has already resolved the device's dark-to-AMOLED override in applyTheme().
    bm::theme().apply(currentThemeMode == 1   ? bm::ThemeId::Light
                      : currentThemeMode == 2 ? bm::ThemeId::Amoled
                                              : bm::ThemeId::Dark);
}

void BetterMateUI::gather() {
    state.now = millis();
    state.mode = controller->getMode();
    switch (controller->getSystemState()) {
    case SYSTEM_STARTING:
        state.system = bm::SystemPhase::Starting;
        break;
    case SYSTEM_WAITING_CONTROLLER:
        state.system = bm::SystemPhase::WaitingForController;
        break;
    case SYSTEM_READY:
        state.system = bm::SystemPhase::Ready;
        break;
    case SYSTEM_UPDATING:
        state.system = bm::SystemPhase::Updating;
        break;
    case SYSTEM_AUTOTUNING:
        state.system = bm::SystemPhase::Autotuning;
        break;
    case SYSTEM_PROTOCOL_MISMATCH:
        state.system = bm::SystemPhase::ProtocolMismatch;
        break;
    case SYSTEM_ERROR:
        state.system = bm::SystemPhase::Error;
        break;
    }

    const SystemInfo info = controller->getSystemInfo();
    state.displayOutdated = info.protocolVersion > gm_proto::PROTOCOL_VERSION;
    state.temperatureError = controller->getError() == ERROR_CODE_RUNAWAY;
    state.controllerConnected = controller->getClientController()->isConnected();
    state.canWake = state.controllerConnected && !info.protocolMismatch && controller->isReady();
    state.accessPoint = apActive;
    state.wifiConnected = !state.accessPoint && WiFi.status() == WL_CONNECTED;
    state.updateAvailable = updateAvailable;
    state.currentTemp = controller->getCurrentTemp();
    state.targetTemp = controller->getTargetTemp();
    state.pressure = controller->getCurrentPressure();
    state.targetPressure = controller->getTargetPressure();
    state.pressureAvailable = info.capabilities.pressure;
    state.temperatureStable = controller->getWarnings().isTemperatureStable();
    if (auto *manager = controller->getProfileManager()) {
        const Profile &profile = manager->getSelectedProfile();
        state.profileName = profile.label.c_str();
        state.profileDuration = profile.getTotalDuration();
        state.profileWeight = profile.getTotalVolume();
        state.profileVolumetric = profile.isVolumetric();
        const auto preview = [this](const Profile &p) {
            state.preview.name = p.label.c_str();
            state.preview.temperature = p.temperature;
            state.preview.duration = p.getTotalDuration();
            state.preview.weight = p.getTotalVolume();
            state.preview.volumetric = p.isVolumetric();
            state.preview.phases = p.getPhaseCount();
            state.preview.steps = p.phases.size();
        };
        state.preview = {};
        std::lock_guard<std::mutex> guard(profilesMutex);
        if (!favoritedProfiles.empty()) {
            currentProfileIdx = std::clamp(currentProfileIdx, 0, static_cast<int>(favoritedProfiles.size()) - 1);
            preview(favoritedProfiles[currentProfileIdx]);
            state.preview.index = currentProfileIdx;
            state.preview.count = favoritedProfiles.size();
            state.preview.previous = currentProfileIdx > 0;
            state.preview.next = currentProfileIdx + 1 < static_cast<int>(favoritedProfiles.size());
        } else {
            preview(profile);
            state.preview.count = 1;
        }
    }
    state.profileDirty = profileDirty;
    state.adjusting = brewScreenState == BrewScreenState::Settings;
    state.confirming = brewConfirmVisible;
    state.volumetricAvailable = controller->isVolumetricAvailable();
    state.bluetoothScale = controller->isBluetoothScaleHealthy();
    state.weight = bluetoothWeight;

    state.shot = {};
    {
        std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
        Process *process = controller->getProcess();
        if (!process)
            process = controller->getLastProcess();
        if (process && process->getType() == MODE_BREW) {
            auto *bp = static_cast<BrewProcess *>(process);
            if (!bp->profile.phases.empty() && bp->phaseIndex < bp->profile.phases.size()) {
                auto &shot = state.shot;
                shot.valid = true;
                shot.active = process->isActive();
                shot.complete = process->isComplete();
                shot.volumetric = bp->target == ProcessTarget::VOLUMETRIC;
                shot.profileName = bp->profile.label.c_str();
                shot.phaseType = bp->currentPhase.phase == PhaseType::PHASE_TYPE_BREW ? "BREW" : "INFUSION";
                shot.phaseName = shot.active                                                   ? bp->currentPhase.name.c_str()
                                 : controller->getSettings().isDelayAdjust() && !shot.complete ? "Calibrating..."
                                                                                               : "Finished";
                const unsigned long now = !shot.active && bp->finished > 0 ? bp->finished : state.now;
                shot.elapsed = bp->processStarted > 0 && now >= bp->processStarted ? now - bp->processStarted : 0;
                shot.duration = bp->getTotalDuration() / 1000.0f;
                shot.targetWeight = bp->getBrewVolume();
                shot.targetTemp = bp->getTemperature();
                shot.weight = bp->currentVolume;
                shot.phaseWeight = shot.volumetric && bp->currentPhase.hasVolumetricTarget();
                if (shot.phaseWeight) {
                    shot.phaseCurrent = bp->currentVolume;
                    shot.phaseTarget = bp->currentPhase.getVolumetricTarget().value;
                } else {
                    shot.phaseCurrent = bp->currentPhaseStarted > 0 && now >= bp->currentPhaseStarted
                                            ? (now - bp->currentPhaseStarted) / 1000.0f
                                            : 0;
                    shot.phaseTarget = bp->getPhaseDuration() / 1000.0f;
                }
                shot.progress =
                    shot.phaseTarget > 0 ? std::clamp(shot.phaseCurrent / shot.phaseTarget * 100.0f, 0.0f, 100.0f) : 0;
            }
        }
    }

    const Settings &settings = controller->getSettings();
    state.active = controller->isActive();
    state.grindActive = controller->isGrindActive();
    state.grindAvailable = settings.isSmartGrindActive() || settings.getAltRelayFunction() == ALT_RELAY_GRIND;
    state.grindVolumetric = settings.isVolumetricTarget() && state.volumetricAvailable;
    state.grindDuration = settings.getTargetGrindDuration();
    state.grindWeight = settings.getTargetGrindVolume();
    state.network = state.accessPoint ? WIFI_AP_SSID : state.wifiConnected ? settings.getWifiSsid().c_str() : "Disconnected";
    state.address = state.accessPoint ? "4.4.4.1" : WiFi.localIP().toString().c_str();
    state.displayVersion = BUILD_GIT_VERSION;
    state.controllerVersion = info.version.c_str();
    state.qrContent.clear();
    if (state.accessPoint) {
        const String password = settings.getWifiApPassword();
        std::string escaped;
        for (size_t i = 0; i < password.length(); ++i) {
            const char c = password.charAt(i);
            if (c == '\\' || c == ';' || c == ',' || c == ':' || c == '"')
                escaped += '\\';
            escaped += c;
        }
        state.qrContent = std::string("WIFI:S:") + WIFI_AP_SSID + (escaped.empty() ? ";;;;" : ";T:WPA;P:" + escaped + ";;");
    } else if (state.wifiConnected) {
        state.qrContent = "http://" + state.address + "/";
    }
    state.timeValid = getLocalTime(&state.time, 5);
    state.clock24h = settings.isClock24hFormat();
    state.wakeScheduled = false;
    if (state.timeValid && settings.isAutoWakeupEnabled()) {
        const bm::NextWakeup next = bm::nextWakeup(state.time, settings.getAutoWakeupSchedules());
        state.wakeScheduled = next.scheduled;
        state.wakeHour = next.hour;
        state.wakeMinute = next.minute;
        state.wakeWeekday = next.weekday;
        state.wakeInMinutes = next.inMinutes;
    }

    const WarningManager &warnings = controller->getWarnings();
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        const auto type = static_cast<WarningType>(i);
        state.warn[i] = warnings.isWarn(type);
        state.error[i] = warnings.isError(type);
    }
}

void BetterMateUI::wake() {
    // Match action_on_wakeup, including its guard and operation order.
    if (!controller->getClientController()->isConnected() || controller->getSystemInfo().protocolMismatch ||
        !controller->isReady()) {
        return;
    }
    changeScreen(SCREEN_ID_BREW_SCREEN);
    controller->deactivate();
    controller->setMode(MODE_BREW);
}

void BetterMateUI::act(bm::Intent intent) {
    using bm::Intent;
    switch (intent) {
    case Intent::Refresh:
        break;
    case Intent::Menu:
        controller->deactivate();
        controller->setMode(MODE_BREW);
        changeScreen(SCREEN_ID_MENU_SCREEN_NEW);
        break;
    case Intent::Profile:
        onProfileSwitch();
        break;
    case Intent::Adjust:
        changeBrewScreenMode(BrewScreenState::Settings);
        break;
    case Intent::Start:
        controller->activate();
        break;
    case Intent::Flush:
        controller->onFlush();
        onTouchFlushStart();
        break;
    case Intent::Tare:
        controller->getClientController()->tare();
        BLEScales.tare();
        break;
    case Intent::ToggleTarget:
        controller->onTargetToggle();
        break;
    case Intent::TempDown:
        if (controller->getMode() == MODE_BREW)
            markProfileDirty();
        controller->lowerTemp();
        break;
    case Intent::TempUp:
        if (controller->getMode() == MODE_BREW)
            markProfileDirty();
        controller->raiseTemp();
        break;
    case Intent::TargetDown:
        markProfileDirty();
        controller->lowerBrewTarget();
        break;
    case Intent::TargetUp:
        markProfileDirty();
        controller->raiseBrewTarget();
        break;
    case Intent::DeleteWeight:
        onVolumetricDelete();
        break;
    case Intent::Accept:
        changeBrewScreenMode(BrewScreenState::Brew);
        break;
    case Intent::Save:
        if (profileDirty) {
            controller->onProfileSave();
            markProfileClean();
            changeBrewScreenMode(BrewScreenState::Brew);
        }
        break;
    case Intent::SaveAsNew:
        if (profileDirty) {
            controller->onProfileSaveAsNew();
            markProfileClean();
            changeBrewScreenMode(BrewScreenState::Brew);
        }
        break;
    case Intent::CancelConfirm:
        controller->cancelBrewConfirm();
        break;
    case Intent::Confirm:
        setBrewConfirmVisible(false);
        controller->activate(true);
        break;
    case Intent::Finish:
        controller->deactivate();
        controller->clear();
        break;
    case Intent::BrewMode:
        wake();
        break;
    case Intent::SteamMode:
    case Intent::WaterMode:
    case Intent::GrindMode:
        if (state.canWake) {
            controller->setMode(intent == Intent::SteamMode ? MODE_STEAM : intent == Intent::WaterMode ? MODE_WATER : MODE_GRIND);
            controller->deactivate();
        }
        break;
    case Intent::Info:
        changeScreen(SCREEN_ID_INFO_SCREEN);
        break;
    case Intent::Standby:
        controller->activateStandby();
        break;
    case Intent::ToggleWater:
        if (controller->getMode() == MODE_WATER)
            controller->isActive() ? controller->deactivate() : controller->activate();
        break;
    case Intent::ToggleGrind:
        controller->isGrindActive() ? controller->deactivateGrind() : controller->activateGrind();
        break;
    case Intent::GrindDown:
        controller->lowerGrindTarget();
        break;
    case Intent::GrindUp:
        controller->raiseGrindTarget();
        break;
    case Intent::PreviousProfile:
        onPreviousProfile();
        break;
    case Intent::NextProfile:
        onNextProfile();
        break;
    case Intent::SelectProfile:
        onProfileSelect();
        break;
    }
    markDirty();
}
