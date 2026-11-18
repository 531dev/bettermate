#include "SimScript.h"

#include "SdlDriver.h"
#include <Arduino.h>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <display/main.h>
#include <display/ui/bettermate/Ui.h>
#include <sstream>
#include <vector>

// A press has to span a few LVGL input reads (30 ms each) to count as a click.
static constexpr int TAP_MS = 120;
static constexpr int SETTLE_MS = 80;
static constexpr int SWIPE_STEP_MS = 16;

static const char *const SCREEN_NAMES[] = {"standby", "brew",  "shot",     "steam", "water", "grind",
                                           "menu",    "profiles", "adjust", "sheet", "warnings", "info",
                                           "fault",   "updating", "setup"};
static constexpr int SCREEN_COUNT = sizeof(SCREEN_NAMES) / sizeof(SCREEN_NAMES[0]);

// Every LVGL refresh that drew something, with the pixels it redrew: the simulator renders a frame in a
// millisecond or two, so time proves nothing here, but the redrawn share is exactly what the panel will pay for.
struct Refresh {
    unsigned long at;
    uint32_t px;
};
static std::vector<Refresh> refreshes;
static void onRefresh(lv_disp_drv_t *, uint32_t, uint32_t px) { refreshes.push_back({millis(), px}); }

// Script coordinates are the design's: its 480 px box, wherever the stage puts it on the panel. On a 480 px panel
// the two agree; on a 466 px one (SIM_PANEL_SIZE=466) the stage starts 7 px outside the glass, so `tap 240 446`
// still lands on the handle and `layout` still reports it at 240, 446. A `shot` is the panel as it is.
static int stageShift() { return (lv_disp_get_hor_res(nullptr) - bm::tokens::DISPLAY_SIZE) / 2; }

// The text an object shows: a label's, or a Reading's.
static const char *textOf(lv_obj_t *obj) {
    if (lv_obj_check_type(obj, &lv_label_class))
        return lv_label_get_text(obj);
    return bm::ui::Reading::textOf(obj);
}

static bool visibleText(lv_obj_t *obj, const char *text) {
    if (!lv_obj_is_visible(obj))
        return false;
    const char *own = textOf(obj);
    if (own != nullptr && strcmp(own, text) == 0)
        return true;
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i) {
        if (visibleText(lv_obj_get_child(obj, i), text))
            return true;
    }
    return false;
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

static unsigned rgb(lv_color_t color) { return lv_color_to32(color) & 0xffffff; }

// One JSON object per visible object: geometry, input state, colors and, for text, the area the glyphs cover.
// scripts/verify_display.py reads these to check the design's rules.
static void dumpLayout(lv_obj_t *obj, FILE *out, int depth, int parentId, int &nextId) {
    if (!lv_obj_is_visible(obj) || lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN))
        return;
    // The stage only centres the 480 px design on the panel: its parts are listed as the screen's own.
    if (obj == bm::ui::root()) {
        for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i)
            dumpLayout(lv_obj_get_child(obj, i), out, depth, parentId, nextId);
        return;
    }
    const int id = nextId++;
    lv_area_t a;
    lv_obj_get_coords(obj, &a);
    const lv_coord_t shift = static_cast<lv_coord_t>(stageShift());
    lv_area_move(&a, -shift, -shift);
    const char *reading = bm::ui::Reading::textOf(obj);
    const bool label = lv_obj_check_type(obj, &lv_label_class);
    const char *kind = reading != nullptr                           ? "reading"
                       : label                                      ? "label"
                       : lv_obj_check_type(obj, &lv_img_class)    ? "img"
                       : lv_obj_check_type(obj, &lv_qrcode_class) ? "qrcode"
                                                                  : "obj";
    fprintf(out, "{\"id\":%d,\"parent\":%d,\"depth\":%d,\"kind\":\"%s\",\"x1\":%d,\"y1\":%d,\"x2\":%d,\"y2\":%d,\"clickable\":%s,\"radius\":%d",
            id, parentId, depth, kind, a.x1, a.y1, a.x2, a.y2, lv_obj_has_flag(obj, LV_OBJ_FLAG_CLICKABLE) ? "true" : "false",
            lv_obj_get_style_radius(obj, LV_PART_MAIN));
    if (lv_obj_get_style_bg_opa(obj, LV_PART_MAIN) > LV_OPA_TRANSP)
        fprintf(out, ",\"fill\":\"#%06x\"", rgb(lv_obj_get_style_bg_color(obj, LV_PART_MAIN)));
    if (kind[0] == 'i')
        fprintf(out, ",\"color\":\"#%06x\"", rgb(lv_obj_get_style_img_recolor(obj, LV_PART_MAIN)));
    if (label) {
        const char *text = lv_label_get_text(obj);
        const lv_font_t *font = lv_obj_get_style_text_font(obj, LV_PART_MAIN);
        const lv_coord_t letter = lv_obj_get_style_text_letter_space(obj, LV_PART_MAIN);
        const lv_coord_t line = lv_obj_get_style_text_line_space(obj, LV_PART_MAIN);
        lv_area_t content;
        lv_obj_get_content_coords(obj, &content);
        lv_area_move(&content, -shift, -shift);
        const lv_coord_t width = lv_area_get_width(&content);
        lv_point_t size;
        lv_txt_get_size(&size, text, font, letter, line, width, LV_TEXT_FLAG_NONE);
        if (size.x > width)
            size.x = width;
        const lv_text_align_t align = lv_obj_get_style_text_align(obj, LV_PART_MAIN);
        lv_coord_t tx = content.x1;
        if (align == LV_TEXT_ALIGN_CENTER)
            tx = content.x1 + (width - size.x) / 2;
        else if (align == LV_TEXT_ALIGN_RIGHT)
            tx = content.x2 - size.x + 1;
        fprintf(out, ",\"text\":\"%s\",\"tx1\":%d,\"ty1\":%d,\"tx2\":%d,\"ty2\":%d,\"font\":%d,\"baseline\":%d,\"color\":\"#%06x\"",
                jsonText(text).c_str(), tx, content.y1, tx + size.x - 1, content.y1 + size.y - 1, font ? font->line_height : 0,
                font ? content.y1 + font->line_height - font->base_line : 0, rgb(lv_obj_get_style_text_color(obj, LV_PART_MAIN)));
    } else if (reading != nullptr) {
        // A Reading's box is its glyphs.
        fprintf(out, ",\"text\":\"%s\",\"tx1\":%d,\"ty1\":%d,\"tx2\":%d,\"ty2\":%d,\"font\":%d,\"baseline\":%d", jsonText(reading).c_str(),
                a.x1, a.y1, a.x2, a.y2, lv_area_get_height(&a), a.y2);
    }
    fprintf(out, "}\n");
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i)
        dumpLayout(lv_obj_get_child(obj, i), out, depth + 1, id, nextId);
}

static const char *toneName(bm::Tone tone) {
    switch (tone) {
    case bm::Tone::Heat:
        return "heat";
    case bm::Tone::HeatSoft:
        return "heat-soft";
    case bm::Tone::Primary:
        return "primary";
    case bm::Tone::Ink:
        return "ink";
    case bm::Tone::Faint:
        return "faint";
    default:
        return "track";
    }
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
        } else if (verb == "press") {
            // Finger down and left there: capture the pressed look, or hold a control for as long as the script likes.
            int x = 0, y = 0;
            ok = static_cast<bool>(words >> x >> y);
            pointer(x, y, true);
            held = {x, y};
        } else if (verb == "release") {
            pointer(held.first, held.second, false);
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
            } else if (field == "screen") {
                std::string name;
                ok = false;
                words >> name;
                for (int i = 0; i < SCREEN_COUNT; ++i) {
                    if (name == SCREEN_NAMES[i]) {
                        steps.push_back({Kind::Expect, i, 0, false, field});
                        ok = true;
                    }
                }
            } else {
                ok = static_cast<bool>(words >> expected) &&
                     (field == "mode" || field == "active" || field == "temperature" ||
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
        } else if (verb == "pumped") {
            float value = 0;
            ok = static_cast<bool>(words >> value) && std::isfinite(value) && value >= 0;
            steps.push_back({Kind::Pumped, static_cast<int>(value * 1000), 0, false, {}});
        } else if (verb == "autotune" || verb == "update") {
            steps.push_back({verb == "autotune" ? Kind::Autotune : Kind::Update, 0, 0, false, {}});
        } else if (verb == "mode") {
            // The machine's mode, as the web UI or a controller button would change it.
            static const char *const MODES[] = {"standby", "brew", "steam", "water", "grind"};
            std::string mode;
            words >> mode;
            ok = false;
            for (int i = 0; i < 5; ++i) {
                if (mode == MODES[i]) {
                    steps.push_back({Kind::Mode, i, 0, false, {}});
                    ok = true;
                }
            }
        } else if (verb == "panel") {
            std::string panel;
            ok = static_cast<bool>(words >> panel) && (panel == "amoled" || panel == "lcd");
            steps.push_back({Kind::Panel, 0, 0, panel == "amoled", {}});
        } else if (verb == "unanswered") {
            int value = 0;
            ok = static_cast<bool>(words >> value) && (value == 0 || value == 1);
            steps.push_back({Kind::Unanswered, 0, 0, value == 1, {}});
        } else if (verb == "update-ready") {
            std::string version;
            ok = static_cast<bool>(words >> version);
            steps.push_back({Kind::UpdateReady, 0, 0, false, version});
        } else if (verb == "update-progress") {
            int value = 0;
            ok = static_cast<bool>(words >> value) && value >= 0 && value <= 100;
            steps.push_back({Kind::UpdateProgress, value, 0, false, {}});
        } else if (verb == "shot" || verb == "layout" || verb == "redraw") {
            std::string path;
            ok = static_cast<bool>(words >> path);
            steps.push_back({verb == "shot" ? Kind::Shot : verb == "layout" ? Kind::Layout : Kind::Redraw, 0, 0, false, path});
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
    if (lv_disp_t *display = lv_disp_get_default(); display->driver->monitor_cb == nullptr)
        display->driver->monitor_cb = onRefresh;
    while (next < steps.size() && millis() >= resumeAt) {
        const Step &step = steps[next++];
        switch (step.kind) {
        case Kind::Wait:
            resumeAt = millis() + step.a;
            break;
        case Kind::Pointer:
            driver->injectPointer(step.a + stageShift(), step.b + stageShift(), step.flag);
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
        case Kind::Pumped:
            controller.getClientController()->simulatePumpedWater(step.a / 1000.0f);
            break;
        case Kind::Wifi:
            if (step.path == "ap-open")
                controller.getSettings().setWifiApPassword("");
            if (step.path == "sta")
                WiFi.begin(controller.getSettings().getWifiSsid(), controller.getSettings().getWifiPassword());
            else
                WiFi.disconnect();
            controller.getUI()->simulateNetwork(step.path == "ap" || step.path == "ap-open");
            break;
        case Kind::Panel:
            controller.getUI()->simulatePanel(step.flag);
            break;
        case Kind::Unanswered:
            controller.getUI()->simulateUnanswered(step.flag);
            break;
        case Kind::UpdateReady:
            controller.getUI()->simulateUpdateReady(step.path.c_str());
            break;
        case Kind::UpdateProgress:
            controller.getUI()->simulateUpdateProgress(step.a);
            break;
        case Kind::Mode:
            controller.deactivate();
            if (step.a == MODE_STANDBY)
                controller.activateStandby();
            else
                controller.setMode(step.a);
            break;
        case Kind::Expect: {
            const Profile &profile = controller.getProfileManager()->getSelectedProfile();
            const int actual = step.path == "screen"           ? static_cast<int>(controller.getUI()->screen())
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
            if (FILE *out = fopen(step.path.c_str(), "w")) {
                const auto ring = controller.getUI()->ringState().shown();
                const char *layout = ring.layout == bm::TickRing::Layout::Split    ? "split"
                                     : ring.layout == bm::TickRing::Layout::Single ? "single"
                                                                                   : "none";
                fprintf(out,
                        "{\"screen\":\"%s\",\"settled\":%s,\"ring\":{\"layout\":\"%s\",\"lit\":[%u,%u],\"notch\":[%d,%d],"
                        "\"tone\":[\"%s\",\"%s\"],\"walking\":%s}}\n",
                        SCREEN_NAMES[static_cast<int>(controller.getUI()->screen())], controller.getUI()->settled() ? "true" : "false",
                        layout, ring.lit[0], ring.lit[1], ring.notch[0], ring.notch[1], toneName(ring.tone[0]), toneName(ring.tone[1]),
                        ring.walking ? "true" : "false");
                int nextId = 0;
                dumpLayout(lv_scr_act(), out, 0, -1, nextId);
                fclose(out);
            }
            break;
        }
        case Kind::Redraw: {
            // Every refresh since the last redraw step: when it happened and how many pixels it repainted.
            if (FILE *out = fopen(step.path.c_str(), "w")) {
                for (const Refresh &r : refreshes)
                    fprintf(out, "{\"ms\":%lu,\"px\":%u}\n", r.at, r.px);
                fclose(out);
            }
            refreshes.clear();
            break;
        }
        case Kind::Quit:
            return true;
        }
    }
    return false;
}
