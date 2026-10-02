#include "BetterMateUI.h"

#include <Arduino.h>
#include <WiFi.h>
#include <display/core/Controller.h>
#include <display/ui/bettermate/NextWakeup.h>

BetterMateUI::BetterMateUI(Controller *controller, Driver *driver, PluginManager *pluginManager)
    : DefaultUI(controller, driver, pluginManager, false) {
    bm::theme().init();
    applyBetterMateTheme();
    onScreenShown(SCREEN_ID_STANDBY_SCREEN);
    // All derived members and the visible screen must exist before loop() can call our hooks.
    startTask();
}

void BetterMateUI::onScreenShown(ScreensEnum screen) {
    active = screen == SCREEN_ID_STANDBY_SCREEN ? &standby : nullptr;
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

    const Settings &settings = controller->getSettings();
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
