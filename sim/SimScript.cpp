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

static int effectiveOpa(lv_obj_t *obj) {
    int opa = LV_OPA_COVER;
    for (lv_obj_t *o = obj; o; o = lv_obj_get_parent(o))
        opa = opa * lv_obj_get_style_opa(o, LV_PART_MAIN) / LV_OPA_COVER;
    return opa;
}

static std::string jsonText(const char *text) {
    std::string out;
    for (const char *c = text; *c; ++c) {
        if (*c == '"' || *c == '\\')
            out += '\\';
        if (*c == '\n') {
            out += "\\n";
            continue;
        }
        out += *c;
    }
    return out;
}

// One JSON object per visible object: geometry, input state, outline and, for labels, the area the glyphs
// actually cover. scripts/verify_display_rules.py reads these to check overlap, edge clearance and controls.
static void dumpLayout(lv_obj_t *obj, FILE *out, int depth, int parentId, int &nextId) {
    if (!lv_obj_is_visible(obj) || lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN))
        return;
    const int opa = effectiveOpa(obj);
    if (opa == 0)
        return;
    const int id = nextId++;
    lv_area_t a;
    lv_obj_get_coords(obj, &a);
    const char *kind = lv_obj_check_type(obj, &lv_label_class)    ? "label"
                       : lv_obj_check_type(obj, &lv_arc_class)    ? "arc"
                       : lv_obj_check_type(obj, &lv_line_class)   ? "line"
                       : lv_obj_check_type(obj, &lv_img_class)    ? "img"
                       : lv_obj_check_type(obj, &lv_qrcode_class) ? "qrcode"
                                                                  : "obj";
    fprintf(out,
            "{\"id\":%d,\"parent\":%d,\"depth\":%d,\"kind\":\"%s\",\"x1\":%d,\"y1\":%d,\"x2\":%d,\"y2\":%d,\"opa\":%d,"
            "\"clickable\":%s,\"disabled\":%s,\"border\":%d,\"border_opa\":%d,\"radius\":%d,\"bg_opa\":%d",
            id, parentId, depth, kind, a.x1, a.y1, a.x2, a.y2, opa,
            lv_obj_has_flag(obj, LV_OBJ_FLAG_CLICKABLE) ? "true" : "false",
            lv_obj_has_state(obj, LV_STATE_DISABLED) ? "true" : "false", lv_obj_get_style_border_width(obj, LV_PART_MAIN),
            lv_obj_get_style_border_opa(obj, LV_PART_MAIN), lv_obj_get_style_radius(obj, LV_PART_MAIN),
            lv_obj_get_style_bg_opa(obj, LV_PART_MAIN));
    if (kind[0] == 'l' && kind[1] == 'a') {
        const char *text = lv_label_get_text(obj);
        const lv_font_t *font = lv_obj_get_style_text_font(obj, LV_PART_MAIN);
        const lv_coord_t letter = lv_obj_get_style_text_letter_space(obj, LV_PART_MAIN);
        const lv_coord_t line = lv_obj_get_style_text_line_space(obj, LV_PART_MAIN);
        lv_area_t content;
        lv_obj_get_content_coords(obj, &content);
        const lv_coord_t width = lv_area_get_width(&content);
        lv_point_t size;
        lv_txt_get_size(&size, text, font, letter, line, lv_obj_get_width(obj) > 0 ? width : LV_COORD_MAX,
                        LV_TEXT_FLAG_NONE);
        if (size.x > width)
            size.x = width;
        const lv_text_align_t align = lv_obj_get_style_text_align(obj, LV_PART_MAIN);
        lv_coord_t tx = content.x1;
        if (align == LV_TEXT_ALIGN_CENTER)
            tx = content.x1 + (width - size.x) / 2;
        else if (align == LV_TEXT_ALIGN_RIGHT)
            tx = content.x2 - size.x + 1;
        const int zoom = lv_obj_get_style_transform_zoom(obj, LV_PART_MAIN);
        fprintf(out, ",\"text\":\"%s\",\"tx1\":%d,\"ty1\":%d,\"tx2\":%d,\"ty2\":%d,\"zoom\":%d,\"font\":%d",
                jsonText(text).c_str(), tx, content.y1, tx + size.x - 1, content.y1 + size.y - 1, zoom,
                font ? font->line_height : 0);
    } else if (kind[0] == 'a') {
        fprintf(out, ",\"bg_start\":%d,\"bg_end\":%d,\"value\":%d,\"arc_width\":%d", lv_arc_get_bg_angle_start(obj),
                lv_arc_get_bg_angle_end(obj), lv_arc_get_value(obj), lv_obj_get_style_arc_width(obj, LV_PART_MAIN));
    }
    fprintf(out, "}\n");
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i)
        dumpLayout(lv_obj_get_child(obj, i), out, depth + 1, id, nextId);
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
        } else if (verb == "shot" || verb == "layout") {
            std::string path;
            ok = static_cast<bool>(words >> path);
            steps.push_back({verb == "shot" ? Kind::Shot : Kind::Layout, 0, 0, false, path});
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
        case Kind::Layout: {
            lv_refr_now(nullptr);
            if (FILE *out = fopen(step.path.c_str(), "w")) {
                int nextId = 0;
                fprintf(out, "{\"screen\":%d}\n", eez_flow_get_current_screen());
                dumpLayout(lv_scr_act(), out, 0, -1, nextId);
                fclose(out);
            }
            break;
        }
        case Kind::Quit:
            return true;
        }
    }
    return false;
}
