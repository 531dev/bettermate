#ifndef BETTERMATE_UI_STATE_H
#define BETTERMATE_UI_STATE_H

#include <cstdint>
#include <ctime>
#include <display/core/WarningManager.h>

namespace bm {

// What the machine as a whole is doing, as far as it decides what a screen may offer.
enum class SystemPhase : uint8_t { Starting, WaitingForController, Ready, Updating, Autotuning, ProtocolMismatch, Error };

// One consistent snapshot of everything the screens show. It is filled on the UI task and handed to the
// active screen, so screens never read the controller mid-update and never touch another task's data.
struct UiState {
    unsigned long now = 0; // millis() when the snapshot was taken

    // Machine
    int mode = 0; // MODE_* from core/constants.h
    SystemPhase system = SystemPhase::Starting;
    bool displayOutdated = false;  // protocol mismatch: the display is the side that needs the update
    bool temperatureError = false; // the error is a boiler runaway
    bool canWake = false;          // a tap on standby may switch the machine on

    // Connectivity
    bool controllerConnected = false;
    bool wifiConnected = false;
    bool accessPoint = false;
    bool updateAvailable = false;

    // Boiler
    float currentTemp = 0.0f;
    float targetTemp = 0.0f;

    // Clock
    bool timeValid = false;
    struct tm time {};
    bool clock24h = true;

    // Next scheduled auto wake-up, if any: weekday as in tm_wday, and how far away it is
    bool wakeScheduled = false;
    int wakeHour = 0;
    int wakeMinute = 0;
    int wakeWeekday = 0;
    int wakeInMinutes = 0;

    // Warnings by WarningType: shown as a warning, or as an error that must be confirmed before brewing
    bool warn[WARNING_TYPE_COUNT] = {};
    bool error[WARNING_TYPE_COUNT] = {};
};

} // namespace bm

#endif // BETTERMATE_UI_STATE_H
