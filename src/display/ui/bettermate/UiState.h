#ifndef BETTERMATE_UI_STATE_H
#define BETTERMATE_UI_STATE_H

#include <cstdint>
#include <ctime>
#include <display/core/WarningManager.h>
#include <string>
#include <vector>

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
    bool amoledPanel = false;      // the panel burns in: Standby rests after a while
    int menuOrigin = 0;            // the mode the menu was opened from, drawn as the active disc

    // Connectivity
    bool controllerConnected = false;
    bool wifiConnected = false;
    bool accessPoint = false;
    bool updateAvailable = false;

    // Boiler
    float currentTemp = 0.0f;
    float targetTemp = 0.0f;
    float pressure = 0.0f;
    float targetPressure = 0.0f;
    bool pressureAvailable = false;
    bool temperatureStable = false;

    // Selected profile and Brew's subviews
    std::string profileName;
    float profileDuration = 0.0f; // seconds
    float profileWeight = 0.0f;
    float profileDose = 0.0f; // optional recipe metadata, grams of dry coffee
    bool profileVolumetric = false;
    bool profileDirty = false;
    float profilePressure = 0.0f;
    bool profilePressureSet = false;
    bool profilePressureEditable = false;
    bool confirming = false; // the controller asks to confirm a start despite warnings
    bool volumetricAvailable = false;
    bool bluetoothScale = false;
    double weight = 0.0;

    // Simple modes share their frame but keep distinct controller actions.
    bool active = false;
    float waterPumped = 0.0f; // millilitres since the process started; 0 when the controller does not measure it
    bool grindActive = false;
    bool grindAvailable = false;
    bool grindVolumetric = false;
    unsigned long grindDuration = 0;
    double grindWeight = 0.0;
    unsigned long grindElapsed = 0;
    unsigned long activeGrindDuration = 0;
    double activeGrindWeight = 0.0;
    double grindOutput = 0.0;
    bool activeGrindVolumetric = false;

    struct ProfilePreview {
        struct Entry {
            std::string name;
            std::string summary;
            float temperature = 0.0f;
            float duration = 0.0f;
            float weight = 0.0f;
            float dose = 0.0f;
            bool volumetric = false;
        };
        std::vector<Entry> entries;
        unsigned index = 0;
        unsigned count = 0;
    } preview;

    // Network QR content is prepared by the host; passwords never become screen labels.
    std::string network;
    std::string address;
    std::string qrContent;
    std::string displayVersion;
    std::string controllerVersion;

    // Copied under the controller's process lock; no process pointers escape to a screen.
    struct Shot {
        bool valid = false;
        bool active = false;
        bool complete = false;
        bool volumetric = false;
        bool phaseWeight = false;
        std::string profileName;
        std::string phaseType;
        std::string phaseName;
        unsigned long elapsed = 0; // milliseconds, frozen after the pump stops
        float duration = 0.0f;
        float targetWeight = 0.0f;
        float targetTemp = 0.0f;
        float phaseCurrent = 0.0f;
        float phaseTarget = 0.0f;
        float progress = 0.0f; // 0..100
        double weight = 0.0;
        // Planned seconds per phase and the running phase, for the stage bars.
        float phaseDurations[8]{};
        int phaseCount = 0;
        int phaseIndex = 0;
    } shot;

    // Clock
    bool timeValid = false;
    struct tm time{};
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
