#include "SimScript.h"

#include "SdlDriver.h"
#include <Arduino.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <display/main.h>
#include <sstream>

// A press has to span a few LVGL input reads (30 ms each) to count as a click.
static constexpr int TAP_MS = 120;
static constexpr int SETTLE_MS = 80;
static constexpr int SWIPE_STEP_MS = 16;

static bool visibleText(lv_obj_t *obj, const char *text) {
    if (!lv_obj_is_visible(obj))
        return false;
    if (lv_obj_check_type(obj, &lv_label_class) && strcmp(lv_label_get_text(obj), text) == 0)
        return true;
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i) {
        if (visibleText(lv_obj_get_child(obj, i), text))
            return true;
    }
    return false;
}

bool SimScript::parse(const char *text) {
    std::stringstream commands(text);
    std::string command;
    while (std::getline(commands, command, ';')) {
        std::stringstream words(command);
        std::string verb;
        if (!(words >> verb))
            continue; // blank between two semicolons

        bool ok = true;
        if (verb == "wait") {
            int ms = 0;
            ok = static_cast<bool>(words >> ms);
            wait(ms);
        } else if (verb == "tap") {
            int x = 0, y = 0;
            ok = static_cast<bool>(words >> x >> y);
            pointer(x, y, true);
            wait(TAP_MS);
            pointer(x, y, false);
            wait(SETTLE_MS);
        } else if (verb == "hold") {
            int x = 0, y = 0, ms = 0;
            ok = static_cast<bool>(words >> x >> y >> ms);
            pointer(x, y, true);
            wait(ms);
            pointer(x, y, false);
            wait(SETTLE_MS);
        } else if (verb == "swipe") {
            int x1 = 0, y1 = 0, x2 = 0, y2 = 0, ms = 250;
            ok = static_cast<bool>(words >> x1 >> y1 >> x2 >> y2);
            words >> ms;
            const int moves = ms / SWIPE_STEP_MS > 0 ? ms / SWIPE_STEP_MS : 1;
            pointer(x1, y1, true);
            for (int i = 1; i <= moves; i++) {
                wait(SWIPE_STEP_MS);
                pointer(x1 + (x2 - x1) * i / moves, y1 + (y2 - y1) * i / moves, true);
            }
            wait(SWIPE_STEP_MS);
            pointer(x2, y2, false);
            wait(SETTLE_MS);
        } else if (verb == "key") {
            int index = 0;
            std::string state;
            ok = static_cast<bool>(words >> index >> state) && (index == 1 || index == 2) && (state == "down" || state == "up");
            steps.push_back({Kind::Key, index - 1, 0, state == "down", {}});
        } else if (verb == "theme") {
            int mode = 0;
            ok = static_cast<bool>(words >> mode);
            steps.push_back({Kind::Theme, mode, 0, false, {}});
        } else if (verb == "controller") {
            std::string state;
            ok = static_cast<bool>(words >> state) && (state == "connected" || state == "disconnected");
            steps.push_back({Kind::Connection, 0, 0, state == "connected", {}});
        } else if (verb == "protocol" || verb == "error") {
            int value = 0;
            ok = static_cast<bool>(words >> value) && value >= 0;
            steps.push_back({verb == "protocol" ? Kind::Protocol : Kind::Error, value, 0, false, {}});
        } else if (verb == "expect") {
            std::string field;
            int expected = 0;
            words >> field;
            if (field == "text" || field == "hidden") {
                std::string label;
                std::getline(words >> std::ws, label);
                ok = !label.empty();
                steps.push_back({Kind::ExpectText, 0, 0, field == "text", label});
            } else {
                ok = static_cast<bool>(words >> expected) &&
                     (field == "screen" || field == "mode" || field == "active" || field == "temperature" ||
                      field == "duration" || field == "target-weight" || field == "setpoint" || field == "grind-active" ||
                      field == "grind-duration" || field == "grind-weight");
                steps.push_back({Kind::Expect, expected, 0, false, field});
            }
        } else if (verb == "pressure-sensor" || verb == "scale") {
            int value = 0;
            ok = static_cast<bool>(words >> value) && (value == 0 || value == 1);
            steps.push_back({verb == "scale" ? Kind::Scale : Kind::PressureSensor, value, 0, false, {}});
        } else if (verb == "wifi") {
            std::string mode;
            ok = static_cast<bool>(words >> mode) &&
                 (mode == "sta" || mode == "ap" || mode == "ap-open" || mode == "disconnected");
            steps.push_back({Kind::Wifi, 0, 0, false, mode});
        } else if (verb == "weight") {
            float value = 0;
            ok = static_cast<bool>(words >> value) && std::isfinite(value);
            steps.push_back({Kind::Weight, static_cast<int>(value * 1000), 0, false, {}});
        } else if (verb == "autotune" || verb == "update") {
            steps.push_back({verb == "autotune" ? Kind::Autotune : Kind::Update, 0, 0, false, {}});
        } else if (verb == "shot") {
            std::string path;
            ok = static_cast<bool>(words >> path);
            steps.push_back({Kind::Shot, 0, 0, false, path});
        } else if (verb == "quit") {
            steps.push_back({Kind::Quit, 0, 0, false, {}});
        } else {
            ok = false;
        }
        if (!ok) {
            fprintf(stderr, "[sim-script] cannot parse \"%s\"\n", command.c_str());
            return false;
        }
    }
    return true;
}

bool SimScript::run(SdlDriver *driver) {
    while (next < steps.size() && millis() >= resumeAt) {
        const Step &step = steps[next++];
        switch (step.kind) {
        case Kind::Wait:
            resumeAt = millis() + step.a;
            break;
        case Kind::Pointer:
            driver->injectPointer(step.a, step.b, step.flag);
            break;
        case Kind::Key:
            controller.getClientController()->simulateButton(step.a, step.flag);
            break;
        case Kind::Theme:
            controller.getSettings().setThemeMode(step.a);
            break;
        case Kind::Connection:
            controller.getClientController()->simulateConnection(step.flag);
            break;
        case Kind::Protocol:
            controller.getClientController()->simulateProtocol(step.a);
            break;
        case Kind::Error:
            controller.getClientController()->simulateError(step.a);
            break;
        case Kind::Autotune:
            controller.autotune(120, 10, 1200);
            break;
        case Kind::Update:
            controller.onOTAUpdate();
            break;
        case Kind::PressureSensor:
            controller.getClientController()->simulatePressureSensor(step.a);
            controller.getUI()->markDirty();
            break;
        case Kind::Scale:
            controller.getClientController()->simulateScale(step.a);
            break;
        case Kind::Weight:
            controller.getClientController()->simulateWeight(step.a / 1000.0f);
            break;
        case Kind::Wifi:
            if (step.path == "ap-open")
                controller.getSettings().setWifiApPassword("");
            if (step.path == "sta")
                WiFi.begin(controller.getSettings().getWifiSsid(), controller.getSettings().getWifiPassword());
            else
                WiFi.disconnect();
#ifdef BETTERMATE_UI
            controller.getUI()->simulateNetwork(step.path == "ap" || step.path == "ap-open");
#else
            controller.getUI()->markDirty();
#endif
            break;
        case Kind::Expect: {
            const Profile &profile = controller.getProfileManager()->getSelectedProfile();
            const int actual = step.path == "screen"           ? eez_flow_get_current_screen()
                               : step.path == "mode"           ? controller.getMode()
                               : step.path == "temperature"    ? static_cast<int>(lroundf(profile.temperature))
                               : step.path == "duration"       ? static_cast<int>(lroundf(profile.getTotalDuration()))
                               : step.path == "target-weight"  ? static_cast<int>(lroundf(profile.getTotalVolume()))
                               : step.path == "setpoint"       ? static_cast<int>(lroundf(controller.getTargetTemp()))
                               : step.path == "grind-active"   ? controller.isGrindActive()
                               : step.path == "grind-duration" ? controller.getSettings().getTargetGrindDuration() / 1000
                               : step.path == "grind-weight"
                                   ? static_cast<int>(lround(controller.getSettings().getTargetGrindVolume() * 10))
                                   : controller.isActive();
            if (actual != step.a) {
                fprintf(stderr, "[sim-script] expected %s %d, got %d\n", step.path.c_str(), step.a, actual);
                std::exit(3);
            }
            fprintf(stderr, "[sim-script] verified %s %d\n", step.path.c_str(), actual);
            break;
        }
        case Kind::ExpectText:
            if (visibleText(lv_scr_act(), step.path.c_str()) != step.flag) {
                fprintf(stderr, "[sim-script] expected label '%s' to be %s\n", step.path.c_str(),
                        step.flag ? "visible" : "hidden");
                std::exit(3);
            }
            fprintf(stderr, "[sim-script] verified %s label '%s'\n", step.flag ? "visible" : "hidden", step.path.c_str());
            break;
        case Kind::Shot:
            driver->screenshot(step.path.c_str());
            break;
        case Kind::Quit:
            return true;
        }
    }
    return false;
}
