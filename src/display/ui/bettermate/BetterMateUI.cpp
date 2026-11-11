#include "BetterMateUI.h"

#include <Arduino.h>
#include <WiFi.h>
#include <algorithm>
#include <display/config.h>
#include <display/core/Controller.h>
#include <display/core/process/BrewProcess.h>
#include <display/core/process/GrindProcess.h>
#ifndef GAGGIMATE_SIM // hardware panel drivers are device-only
#include <display/drivers/AmoledDisplayDriver.h>
#endif
#include <display/plugins/BLEScalePlugin.h>
#include <display/ui/bettermate/Motion.h>
#include <display/ui/bettermate/NextWakeup.h>
#include <display/ui/utils/FrameProbe.h>
#include <display/ui/utils/FrameTiming.h>
#include <version.h>

using bm::ScreenId;

namespace {
// The task wakes three times a frame: often enough to read the touch panel on time, and a frame is drawn on
// the pass that crosses its 42.5 ms boundary.
constexpr uint32_t UI_LOOP_PERIOD_MS = 14;
constexpr uint32_t PROFILE_LOOP_PERIOD_MS = 100;

ScreenId screenForMode(int mode) {
    switch (mode) {
    case MODE_BREW:
        return ScreenId::Brew;
    case MODE_STEAM:
        return ScreenId::Steam;
    case MODE_WATER:
        return ScreenId::Water;
    case MODE_GRIND:
        return ScreenId::Grind;
    default:
        return ScreenId::Standby;
    }
}

// Edit the final pumping Brew phase; preinfusion, flow profiles and transitions retain their settings.
int pressurePhase(const Profile &profile) {
    for (int i = static_cast<int>(profile.phases.size()) - 1; i >= 0; --i) {
        const auto &phase = profile.phases[i];
        if (phase.phase == PhaseType::PHASE_TYPE_BREW && phase.valve && (!phase.pumpIsSimple || phase.pumpSimple > 0))
            return i;
    }
    return -1;
}

bool pressureEditable(const Phase &phase) {
    return phase.pumpIsSimple || (phase.pumpAdvanced.target == PumpTarget::PUMP_TARGET_PRESSURE && phase.pumpAdvanced.pressure > 0);
}

// True while any pointer input device (the touch panel) is pressed.
bool pointerPressed() {
    for (lv_indev_t *indev = lv_indev_get_next(nullptr); indev != nullptr; indev = lv_indev_get_next(indev)) {
        if (lv_indev_get_type(indev) == LV_INDEV_TYPE_POINTER && indev->proc.state == LV_INDEV_STATE_PRESSED)
            return true;
    }
    return false;
}
} // namespace

BetterMateUI::BetterMateUI(Controller *controller, Driver *driver, PluginManager *pluginManager)
    : controller(controller), panelDriver(driver), pluginManager(pluginManager) {
    frame_probe::attach();
#ifndef GAGGIMATE_SIM
    amoledPanel = driver == AmoledDisplayDriver::getInstance();
#endif
    // The UI repaints once a frame, itself: LVGL's own refresh timer would repaint between frames.
    if (lv_disp_t *display = lv_disp_get_default(); display->refr_timer != nullptr) {
        lv_timer_del(display->refr_timer);
        display->refr_timer = nullptr;
    }

    applyTheme();
    bm::ui::paintFace();
    // A tap that hits no control and a swipe anywhere go to the screen on the glass.
    lv_obj_t *face = lv_scr_act();
    lv_obj_add_event_cb(
        face,
        [](lv_event_t *e) {
            auto *ui = static_cast<BetterMateUI *>(lv_event_get_user_data(e));
            if (ui->active != nullptr && ui->settle >= 3)
                ui->active->tapped();
        },
        LV_EVENT_SHORT_CLICKED, this);
    lv_obj_add_event_cb(
        face,
        [](lv_event_t *e) {
            auto *ui = static_cast<BetterMateUI *>(lv_event_get_user_data(e));
            lv_indev_t *input = lv_indev_get_act();
            if (input == nullptr)
                return;
            // A swipe never ends as a tap on whatever lies under the finger.
            lv_indev_wait_release(input);
            if (ui->active != nullptr && ui->settle >= 3)
                ui->active->swiped(lv_indev_get_gesture_dir(input));
        },
        LV_EVENT_GESTURE, this);
    tickRing.build(bm::ui::root());

    // Draw Standby before the backlight comes up, then start the task: everything it touches exists now.
    loop();
    setBrightness(controller->getSettings().getMainBrightness());
    xTaskCreatePinnedToCore(loopTask, "BetterMateUI::loop", configMINIMAL_STACK_SIZE * 6, this, 1, &taskHandle, 1);
}

void BetterMateUI::init() {
    const auto redraw = [this](Event const &) { markDirty(); };
    for (const char *name :
         {"boiler:currentTemperature:change", "boiler:pressure:change", "boiler:targetTemperature:change",
          "controller:targetVolume:change", "controller:targetDuration:change", "controller:grindDuration:change",
          "controller:grindVolume:change", "controller:grind:end", "controller:grind:start", "controller:process:end",
          "controller:process:start", "controller:bluetooth:waiting", "controller:bluetooth:disconnect"})
        pluginManager->on(name, redraw);

    pluginManager->on("controller:mode:change", [this](Event const &event) { request(screenForMode(event.getInt("value"))); });
    pluginManager->on("controller:brew:start", [this](Event const &) {
        confirming = false;
        request(ScreenId::Shot);
    });
    pluginManager->on("controller:brew:clear", [this](Event const &) {
        if (static_cast<ScreenId>(requested.load()) == ScreenId::Shot)
            request(ScreenId::Brew);
    });
    pluginManager->on("controller:brew:confirm", [this](Event const &) {
        confirming = true;
        request(ScreenId::Warnings);
    });
    // Answered elsewhere (web UI, another client): drop the question.
    pluginManager->on("controller:brew:confirm:cancel", [this](Event const &) {
        if (confirming.exchange(false) && static_cast<ScreenId>(requested.load()) == ScreenId::Warnings)
            request(ScreenId::Brew);
    });
    pluginManager->on("controller:bluetooth:connect", [this](Event const &) {
        if (!initialized.exchange(true) && static_cast<ScreenId>(requested.load()) == ScreenId::Standby &&
            !controller->getSystemInfo().protocolMismatch && controller->getSettings().getStartupMode() == MODE_BREW)
            request(ScreenId::Brew);
        markDirty();
    });
    pluginManager->on("controller:wifi:connect", [this](Event const &event) {
        apActive = event.getInt("AP") != 0;
        markDirty();
    });
    pluginManager->on("ota:update:status", [this](Event const &event) {
        updateAvailable = event.getInt("value") != 0;
        markDirty();
    });
    // Whatever was on the glass, these send the machine back to Standby, which shows the reason.
    for (const char *name : {"ota:update:start", "ota:update:end", "controller:error", "controller:protocol:mismatch",
                             "controller:autotune:start", "controller:autotune:result"})
        pluginManager->on(name, [this](Event const &) { request(ScreenId::Standby); });

    for (const char *name :
         {"profiles:profile:select", "profiles:profile:favorite", "profiles:profile:unfavorite", "profiles:profile:save"})
        pluginManager->on(name, [this](Event const &) {
            reloadProfiles();
            markDirty();
        });
    pluginManager->on("controller:volumetric-measurement:bluetooth:change", [this](Event const &event) {
        const float weight = event.getFloat("value");
        if (roundf(weight * 10.0f) != roundf(scaleWeight.load() * 10.0f)) {
            scaleWeight = weight;
            markDirty();
        }
    });
    xTaskCreatePinnedToCore(profileLoopTask, "BetterMateUI::profiles", configMINIMAL_STACK_SIZE * 4, this, 1, &profileTaskHandle, 0);
}

void BetterMateUI::loop() {
    const unsigned long now = millis();

    if (touchFlushHeld) {
        if (!controller->isActive()) {
            touchFlushHeld = false;
        } else if (!pointerPressed()) {
            touchFlushHeld = false;
            controller->onFlushRelease();
        }
    }

    const uint32_t lvglStarted = millis();
    lv_timer_handler(); // touch input; nothing repaints here
    if (static_cast<long>(now - nextFrameAt) >= 0) {
        // After a stall the count resumes from now: frames are never replayed in a burst.
        const bool late = now - nextFrameAt > 4 * bm::motion::FRAME_MS_ODD;
        nextFrameAt = (late ? now : nextFrameAt) + (frame % 2 == 0 ? bm::motion::FRAME_MS_EVEN : bm::motion::FRAME_MS_ODD);
        ++frame;
        runFrame(now);
        _lv_disp_refr_timer(nullptr);
    }
    frame_probe::loopDone(now, lvglStarted, millis());
}

void BetterMateUI::runFrame(unsigned long now) {
    applyTheme();
    if (controller->isErrorState())
        request(ScreenId::Standby);

    // Parts that began stepping in on an earlier frame advance before anything new starts.
    bm::ui::fx::step();

    const auto wanted = static_cast<ScreenId>(requested.load());
    const bool change = wanted != current || active == nullptr;
    const bool snapshot = dirty.exchange(false) || change || frame - lastSnapshot >= bm::motion::SNAPSHOT_EVERY;
    if (snapshot) {
        gather(now, wanted);
        lastSnapshot = frame;
    }
    if (change)
        beginChange(wanted);
    else if (snapshot)
        active->update(state);

    // A screen change is a cut that settles over three frames; the ring holds still until it has.
    const bool settling = settle < 3;
    if (settling) {
        if (leaving != nullptr)
            leaving->conceal(settle);
        active->reveal(settle);
        if (++settle == 3)
            leaving = nullptr;
    }
    active->tick(state, frame);
    if (!settling)
        tickRing.step();

    // Standby dims the panel after a while; any other screen is at full brightness.
    if (current == ScreenId::Standby && !dimmed && standbyEnterTime != 0) {
        const Settings &settings = controller->getSettings();
        if (now - standbyEnterTime >= static_cast<unsigned long>(settings.getStandbyBrightnessTimeout())) {
            setBrightness(settings.getStandbyBrightness());
            dimmed = true;
        }
    }
}

void BetterMateUI::beginChange(ScreenId next) {
    // A change that interrupts another finishes the first at once.
    if (leaving != nullptr) {
        for (unsigned rank = settle; rank < 3; ++rank)
            leaving->conceal(rank);
    }
    leaving = active;
    if (current == ScreenId::Standby && next != ScreenId::Standby && active != nullptr) {
        setBrightness(controller->getSettings().getMainBrightness());
        dimmed = false;
    }
    if (next == ScreenId::Standby)
        standbyEnterTime = millis();
    if (next != ScreenId::Warnings)
        confirming = false;
    current = next;
    active = screens[static_cast<size_t>(next)];
    if (leaving == active)
        leaving = nullptr;
    settle = 0;
    active->enter(state);
}

void BetterMateUI::applyTheme() {
    const int mode = controller->getSettings().getThemeMode();
    if (mode == themeMode)
        return;
    themeMode = mode;
    if (!bm::theme::set(mode == 1 ? bm::ThemeId::Light : bm::ThemeId::Black) || active == nullptr)
        return;
    // Every part holds its colors, so a theme change rebuilds the screens. It happens from Settings, rarely.
    bm::ui::fx::reset();
    for (bm::Screen *screen : screens)
        screen->destroy();
    bm::ui::paintFace();
    leaving = nullptr;
    active->enter(state);
    for (unsigned rank = 0; rank < 3; ++rank)
        active->reveal(rank);
    settle = 3;
    tickRing.settle();
    lv_obj_invalidate(lv_scr_act());
}

void BetterMateUI::gather(unsigned long now, ScreenId target) {
    const Settings &settings = controller->getSettings();
    state.now = now;
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
    state.amoledPanel = amoledPanel;
    state.menuOrigin = menuOrigin;
    state.accessPoint = apActive;
    state.wifiConnected = !state.accessPoint && WiFi.status() == WL_CONNECTED;
    state.updateAvailable = updateAvailable;
    state.currentTemp = controller->getCurrentTemp();
    state.targetTemp = controller->getTargetTemp();
    state.pressure = controller->getCurrentPressure();
    state.targetPressure = controller->getTargetPressure();
    state.pressureAvailable = info.capabilities.pressure;
    state.temperatureStable = controller->getWarnings().isTemperatureStable();
    state.profileDirty = profileDirty;
    state.confirming = confirming;
    state.volumetricAvailable = controller->isVolumetricAvailable();
    state.bluetoothScale = controller->isBluetoothScaleHealthy();
    state.weight = scaleWeight;
    state.active = controller->isActive();
    state.waterPumped = controller->getCurrentWaterPumped();
    state.grindActive = controller->isGrindActive();
    state.grindAvailable = settings.isSmartGrindActive() || settings.getAltRelayFunction() == ALT_RELAY_GRIND;
    state.grindVolumetric = settings.isVolumetricTarget() && state.volumetricAvailable;
    state.grindDuration = settings.getTargetGrindDuration();
    state.grindWeight = settings.getTargetGrindVolume();

    const WarningManager &warningManager = controller->getWarnings();
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        const auto type = static_cast<WarningType>(i);
        state.warn[i] = warningManager.isWarn(type);
        state.error[i] = warningManager.isError(type);
    }

    gatherProfile();
    gatherProcess();

    // What only one screen shows is read only for that screen.
    if (target == ScreenId::Info) {
        gatherNetwork();
        state.displayVersion = BUILD_GIT_VERSION;
        state.controllerVersion = info.version.c_str();
    }
    if (target == ScreenId::Standby) {
        const time_t clock = time(nullptr);
        localtime_r(&clock, &state.time);
        state.timeValid = state.time.tm_year > 2016 - 1900;
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
    }
}

void BetterMateUI::gatherProfile() {
    ProfileManager *manager = controller->getProfileManager();
    if (manager == nullptr)
        return;
    const Profile &profile = manager->getSelectedProfile();
    state.profileName = profile.label.c_str();
    state.profileDuration = profile.getTotalDuration();
    state.profileWeight = profile.getTotalVolume();
    state.profileDose = profile.dose;
    state.profileVolumetric = profile.isVolumetric();
    state.profilePressure = 0;
    state.profilePressureSet = false;
    state.profilePressureEditable = false;
    if (const int index = pressurePhase(profile); index >= 0) {
        const auto &phase = profile.phases[index];
        state.profilePressureEditable = state.pressureAvailable && pressureEditable(phase);
        state.profilePressureSet =
            !phase.pumpIsSimple && phase.pumpAdvanced.target == PumpTarget::PUMP_TARGET_PRESSURE && phase.pumpAdvanced.pressure > 0;
        if (state.profilePressureSet)
            state.profilePressure = phase.pumpAdvanced.pressure;
    }

    // The browsable favourites change only when a profile is selected, saved, edited or (un)favourited.
    if (!previewDirty.exchange(false))
        return;
    const auto preview = [](const Profile &p) {
        bm::UiState::ProfilePreview::Entry entry;
        entry.name = p.label.c_str();
        entry.temperature = p.temperature;
        entry.duration = p.getTotalDuration();
        entry.weight = p.getTotalVolume();
        entry.dose = p.dose;
        // A single phase needs no stage list; its name would only repeat the mode.
        if (p.phases.size() > 1) {
            for (const auto &phase : p.phases) {
                if (!entry.summary.empty())
                    entry.summary += " \xC2\xB7 ";
                entry.summary += phase.name.c_str();
            }
        }
        entry.volumetric = p.isVolumetric();
        return entry;
    };
    state.preview = {};
    std::lock_guard<std::mutex> guard(profilesMutex);
    if (!favoritedProfiles.empty()) {
        currentProfileIdx = std::clamp(currentProfileIdx, 0, static_cast<int>(favoritedProfiles.size()) - 1);
        state.preview.index = currentProfileIdx;
        state.preview.count = favoritedProfiles.size();
        state.preview.entries.reserve(favoritedProfiles.size());
        for (const auto &favorite : favoritedProfiles)
            state.preview.entries.push_back(preview(favorite.id == profile.id ? profile : favorite));
    } else {
        state.preview.count = 1;
        state.preview.entries.push_back(preview(profile));
    }
}

void BetterMateUI::gatherProcess() {
    state.shot = {};
    state.grindElapsed = 0;
    state.activeGrindDuration = 0;
    state.activeGrindWeight = 0;
    state.grindOutput = 0;
    state.activeGrindVolumetric = false;
    // Hold the process lock across every deref below: other tasks delete the process at any time.
    std::lock_guard<std::recursive_mutex> guard(controller->getProcessLock());
    Process *process = controller->getProcess();
    if (process == nullptr)
        process = controller->getLastProcess();
    if (process == nullptr)
        return;
    if (process->getType() == MODE_GRIND) {
        auto *gp = static_cast<GrindProcess *>(process);
        state.grindElapsed = state.now >= gp->started ? state.now - gp->started : 0;
        state.activeGrindDuration = std::max(0, gp->time);
        state.activeGrindWeight = gp->grindVolume;
        state.grindOutput = gp->currentVolume;
        state.activeGrindVolumetric = gp->target == ProcessTarget::VOLUMETRIC;
        return;
    }
    if (process->getType() != MODE_BREW)
        return;
    auto *bp = static_cast<BrewProcess *>(process);
    if (bp->profile.phases.empty() || bp->phaseIndex >= bp->profile.phases.size())
        return; // mid-mutation: the screen keeps what it shows
    auto &shot = state.shot;
    shot.valid = true;
    shot.active = process->isActive();
    shot.complete = process->isComplete();
    shot.volumetric = bp->target == ProcessTarget::VOLUMETRIC;
    shot.utility = bp->isUtility();
    shot.profileName = bp->profile.label.c_str();
    shot.phaseType = bp->currentPhase.phase == PhaseType::PHASE_TYPE_BREW ? "BREW" : "INFUSION";
    shot.phaseName = shot.active                                                     ? bp->currentPhase.name.c_str()
                     : controller->getSettings().isDelayAdjust() && !shot.complete ? "Calibrating"
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
        shot.phaseCurrent =
            bp->currentPhaseStarted > 0 && now >= bp->currentPhaseStarted ? (now - bp->currentPhaseStarted) / 1000.0f : 0;
        shot.phaseTarget = bp->getPhaseDuration() / 1000.0f;
    }
    shot.progress = shot.phaseTarget > 0 ? std::clamp(shot.phaseCurrent / shot.phaseTarget * 100.0f, 0.0f, 100.0f) : 0;
    shot.phaseCount = std::min<int>(bp->profile.phases.size(), 8);
    for (int i = 0; i < shot.phaseCount; ++i)
        shot.phaseDurations[i] = bp->profile.phases[i].duration;
    shot.phaseIndex = static_cast<int>(bp->phaseIndex);
}

void BetterMateUI::gatherNetwork() {
    const Settings &settings = controller->getSettings();
    state.network = state.accessPoint ? WIFI_AP_SSID : state.wifiConnected ? settings.getWifiSsid().c_str() : "Disconnected";
    state.address = state.accessPoint ? "4.4.4.1" : WiFi.localIP().toString().c_str();
    state.qrContent.clear();
    if (state.accessPoint) {
        // WIFI: QR syntax; escape \ ; , : " in the password. The password never becomes a label.
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
}

void BetterMateUI::wake() {
    // The guard and the order of the stock wake-up action.
    if (!controller->getClientController()->isConnected() || controller->getSystemInfo().protocolMismatch || !controller->isReady())
        return;
    request(ScreenId::Brew);
    controller->deactivate();
    controller->setMode(MODE_BREW);
}

void BetterMateUI::focusProfile(unsigned index) {
    if (current != ScreenId::Profiles)
        return;
    {
        std::lock_guard<std::mutex> guard(profilesMutex);
        if (index >= favoritedProfiles.size() || currentProfileIdx == static_cast<int>(index))
            return;
        currentProfileIdx = static_cast<int>(index);
    }
    previewDirty = true;
    markDirty();
}

void BetterMateUI::act(bm::Intent intent) {
    using bm::Intent;
    ProfileManager *profileManager = controller->getProfileManager();
    const bool canWake = controller->getClientController()->isConnected() && !controller->getSystemInfo().protocolMismatch &&
                         controller->isReady();
    const bool brewing = controller->getMode() == MODE_BREW && controller->isActive();
    switch (intent) {
    case Intent::Refresh:
        break;
    case Intent::Wake:
        if (canWake) {
            menuOrigin = MODE_BREW;
            controller->deactivate();
            controller->setMode(MODE_BREW);
            request(ScreenId::Menu);
        }
        break;
    case Intent::Menu:
        // Opening the menu stops whatever is running, except a shot: that one ends with its own STOP.
        if (brewing)
            break;
        menuOrigin = controller->getMode();
        controller->deactivate();
        controller->setMode(MODE_BREW);
        request(ScreenId::Menu);
        break;
    case Intent::Back:
        switch (current) {
        case ScreenId::Warnings:
            if (confirming)
                controller->cancelBrewConfirm();
            else
                request(returnTo);
            break;
        case ScreenId::Info:
            request(ScreenId::Menu);
            break;
        case ScreenId::Menu:
            request(screenForMode(controller->getMode()));
            break;
        case ScreenId::Profiles:
            request(ScreenId::Brew);
            break;
        case ScreenId::Adjust:
            request(ScreenId::Profiles);
            break;
        case ScreenId::Sheet:
            request(ScreenId::Adjust);
            break;
        default:
            break;
        }
        break;
    case Intent::Profiles:
        currentProfileIdx = 0;
        request(ScreenId::Profiles);
        break;
    case Intent::Adjust:
        if (!canWake || controller->isActive() || current != ScreenId::Profiles)
            break;
        {
            String id;
            {
                std::lock_guard<std::mutex> guard(profilesMutex);
                if (currentProfileIdx >= 0 && currentProfileIdx < static_cast<int>(favoritedProfiles.size()))
                    id = favoritedProfiles[currentProfileIdx].id;
            }
            if (!id.isEmpty() && id != profileManager->getSelectedProfile().id) {
                profileManager->selectProfile(id);
                profileDirty = false;
                currentProfileIdx = 0;
            }
        }
        request(ScreenId::Adjust);
        break;
    case Intent::SaveSheet:
        if (profileDirty && current == ScreenId::Adjust)
            request(ScreenId::Sheet);
        break;
    case Intent::Warnings:
        if (brewing)
            break;
        if (current != ScreenId::Warnings)
            returnTo = current;
        request(ScreenId::Warnings);
        break;
    case Intent::Info:
        request(ScreenId::Info);
        break;
    case Intent::Start:
        controller->activate();
        break;
    case Intent::Flush:
        controller->onFlush();
        touchFlushHeld = true;
        break;
    case Intent::Tare:
        controller->getClientController()->tare();
        BLEScales.tare();
        break;
    case Intent::ToggleTarget:
        controller->onTargetToggle();
        break;
    case Intent::TempDown:
    case Intent::TempUp:
        if (controller->getMode() == MODE_BREW)
            profileDirty = true;
        intent == Intent::TempUp ? controller->raiseTemp() : controller->lowerTemp();
        break;
    case Intent::PressureDown:
    case Intent::PressureUp:
        if (!canWake || current != ScreenId::Adjust || controller->isActive() || !controller->getSystemInfo().capabilities.pressure)
            break;
        {
            auto &selected = profileManager->getSelectedProfile();
            const int index = pressurePhase(selected);
            if (index < 0 || !pressureEditable(selected.phases[index]))
                break;
            auto &phase = selected.phases[index];
            if (phase.pumpIsSimple) {
                // A pump-power phase gains a pressure target on its first step.
                phase.pumpIsSimple = false;
                phase.pumpAdvanced = {PumpTarget::PUMP_TARGET_PRESSURE, 9.0f, 0.0f};
            } else {
                const float next = std::clamp(phase.pumpAdvanced.pressure + (intent == Intent::PressureUp ? 0.5f : -0.5f), 0.1f, 12.0f);
                if (next == phase.pumpAdvanced.pressure)
                    break;
                phase.pumpAdvanced.pressure = next;
            }
            profileDirty = true;
            controller->updateLastAction();
        }
        break;
    case Intent::TargetDown:
    case Intent::TargetUp:
        profileDirty = true;
        intent == Intent::TargetUp ? controller->raiseBrewTarget() : controller->lowerBrewTarget();
        break;
    case Intent::DeleteWeight:
        if (current == ScreenId::Adjust && profileManager->getSelectedProfile().isVolumetric() && controller->isVolumetricAvailable()) {
            controller->onVolumetricDelete();
            profileDirty = true;
        }
        break;
    case Intent::Save:
    case Intent::SaveAsNew:
        if (profileDirty) {
            intent == Intent::Save ? controller->onProfileSave() : controller->onProfileSaveAsNew();
            profileDirty = false;
            request(ScreenId::Brew);
        }
        break;
    case Intent::UseOnce:
        request(ScreenId::Brew);
        break;
    case Intent::Confirm:
        confirming = false;
        controller->activate(true);
        break;
    case Intent::CancelConfirm:
        controller->cancelBrewConfirm();
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
        if (canWake) {
            controller->setMode(intent == Intent::SteamMode ? MODE_STEAM : intent == Intent::WaterMode ? MODE_WATER : MODE_GRIND);
            controller->deactivate();
        }
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
        if (currentProfileIdx > 0)
            --currentProfileIdx;
        break;
    case Intent::NextProfile: {
        std::lock_guard<std::mutex> guard(profilesMutex);
        if (currentProfileIdx + 1 < static_cast<int>(favoritedProfileIds.size()))
            ++currentProfileIdx;
        break;
    }
    case Intent::SelectProfile:
        if (current != ScreenId::Profiles || !canWake || controller->isActive())
            break;
        {
            String id;
            {
                std::lock_guard<std::mutex> guard(profilesMutex);
                if (currentProfileIdx >= 0 && currentProfileIdx < static_cast<int>(favoritedProfileIds.size()))
                    id = favoritedProfileIds[currentProfileIdx];
            }
            if (!id.isEmpty() && id != profileManager->getSelectedProfile().id) {
                profileManager->selectProfile(id);
                profileDirty = false;
            }
            request(ScreenId::Brew);
        }
        break;
    }
    previewDirty = true;
    markDirty();
}

void BetterMateUI::loopProfiles() {
    if (profileLoaded)
        return;
    ProfileManager *profileManager = controller->getProfileManager();
    if (profileManager == nullptr)
        return;
    // Build into locals and swap under the lock: the UI task reads these concurrently.
    const auto favoritedIds = profileManager->getFavoritedProfiles();
    std::vector<String> ids;
    ids.reserve(favoritedIds.size() + 1);
    ids.emplace_back(controller->getSettings().getSelectedProfile());
    for (const auto &id : favoritedIds) {
        if (std::find(ids.begin(), ids.end(), id) == ids.end())
            ids.emplace_back(id);
    }
    std::vector<Profile> loaded;
    loaded.reserve(ids.size());
    for (const auto &profileId : ids) {
        Profile profile{};
        profileManager->loadProfile(profileId, profile);
        loaded.emplace_back(std::move(profile));
    }
    {
        std::lock_guard<std::mutex> guard(profilesMutex);
        favoritedProfileIds = std::move(ids);
        favoritedProfiles = std::move(loaded);
    }
    profileLoaded = 1;
    previewDirty = true;
    markDirty();
}

void BetterMateUI::loopTask(void *arg) {
    auto *ui = static_cast<BetterMateUI *>(arg);
    while (true) {
        // Wait out the rest of the period: a fixed wait after a slow pass would add to it.
        const TickType_t started = xTaskGetTickCount();
        ui->loop();
        vTaskDelay(frame_timing::loopDelay(started, xTaskGetTickCount(), UI_LOOP_PERIOD_MS / portTICK_PERIOD_MS));
    }
}

void BetterMateUI::profileLoopTask(void *arg) {
    auto *ui = static_cast<BetterMateUI *>(arg);
    while (true) {
        ui->loopProfiles();
        vTaskDelay(PROFILE_LOOP_PERIOD_MS / portTICK_PERIOD_MS);
    }
}
