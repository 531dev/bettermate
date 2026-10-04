#include "WorkingScreen.h"

#include <cstdio>

namespace bm {

void formatTime(unsigned long ms, char *buf, size_t size) { snprintf(buf, size, "%lu:%02lu", ms / 60000, ms / 1000 % 60); }

lv_obj_t *WorkingScreen::text(lv_obj_t *parent, int x, int y, Type type, Fg color, const char *value, int width) {
    lv_obj_t *label = ui::label(parent, type, color, value);
    if (width) {
        lv_obj_set_width(label, width);
        lv_label_set_long_mode(label, LV_LABEL_LONG_DOT);
        lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    }
    lv_obj_align(label, LV_ALIGN_TOP_MID, x, y);
    return label;
}

lv_obj_t *WorkingScreen::button(lv_obj_t *parent, int x, int y, int size, const lv_img_dsc_t *glyph, Intent intent, Bg color,
                                Fg foreground) {
    lv_obj_t *obj = ui::fill(parent, color, LV_RADIUS_CIRCLE);
    lv_obj_set_size(obj, size, size);
    lv_obj_set_pos(obj, x - size / 2, y - size / 2);
    lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_t *icon = ui::icon(obj, glyph, foreground);
    lv_obj_center(icon);
    lv_obj_clear_flag(icon, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(icon, LV_OBJ_FLAG_EVENT_BUBBLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
    bind(obj, intent);
    return obj;
}

void WorkingScreen::enable(lv_obj_t *obj, bool enabled) {
    if (lv_obj_has_state(obj, LV_STATE_DISABLED) == !enabled)
        return;
    if (enabled)
        lv_obj_clear_state(obj, LV_STATE_DISABLED);
    else
        lv_obj_add_state(obj, LV_STATE_DISABLED);
    lv_obj_set_style_opa(obj, enabled ? LV_OPA_COVER : LV_OPA_40, 0);
}

void WorkingScreen::buildFrame(lv_obj_t *root, bool minimalFrame) {
    minimal = minimalFrame;
    gauges.build(root, minimal);
    lv_obj_add_event_cb(
        root,
        [](lv_event_t *e) {
            auto *screen = static_cast<WorkingScreen *>(lv_event_get_user_data(e));
            lv_indev_t *input = lv_indev_get_act();
            if (input && lv_indev_get_gesture_dir(input) == LV_DIR_TOP) {
                lv_indev_wait_release(input);
                screen->host.act(Intent::Menu);
            }
        },
        LV_EVENT_GESTURE, this);
    connectivity = ui::row(root, tokens::SPACE_3);
    lv_obj_align(connectivity, LV_ALIGN_TOP_MID, 0, 24);
    wifi = ui::icon(connectivity, &bm_icon_wifi_24, Fg::Muted);
    bluetooth = ui::icon(connectivity, &bm_icon_bluetooth_24, Fg::Muted);
    updateIcon = ui::icon(connectivity, &bm_icon_refresh_cw_24, Fg::Muted);
    warning = ui::badge(root);
    lv_obj_align(warning.root, LV_ALIGN_TOP_MID, 0, 22);
    modeLabel = text(root, 0, 54, Type::Label, Fg::Muted, "BREW");
    title = text(root, 0, 76, Type::Title, Fg::Ink, "", 300);

    pairs = ui::box(root);
    lv_obj_set_size(pairs, 300, 78);
    lv_obj_set_pos(pairs, 90, 248);
    lv_obj_t *tempPair = ui::box(pairs);
    lv_obj_set_size(tempPair, 130, 78);
    lv_obj_set_pos(tempPair, 0, 0);
    tempCaption = text(tempPair, 0, 0, Type::Label, Fg::Heat, "TEMP");
    tempValue = text(tempPair, 0, 20, Type::MetricSm, Fg::Ink);
    tempTarget = text(tempPair, 0, 54, Type::Label, Fg::Muted);
    pressurePair = ui::box(pairs);
    lv_obj_set_size(pressurePair, 130, 78);
    lv_obj_set_pos(pressurePair, 170, 0);
    text(pressurePair, 0, 0, Type::Label, Fg::Primary, "PRESSURE");
    pressureValue = text(pressurePair, 0, 20, Type::MetricSm, Fg::Ink);
    pressureTarget = text(pressurePair, 0, 54, Type::Label, Fg::Muted);

    // Leave distinct 56 px menu and 72 px action hit areas at the bottom of the round panel.
    menu = button(root, 240, 450, 56, &bm_icon_chevron_up_24, Intent::Menu, Bg::Surface0, Fg::Muted);
    if (minimal) {
        showPairs(false);
        singleTemperature = text(root, 0, 414, Type::Label, Fg::Heat);
    }
}

void WorkingScreen::showPairs(bool visible) { ui::setVisible(pairs, visible); }

void WorkingScreen::updateFrame(const UiState &state, bool showWarnings) {
    gauges.update(state);
    int count = 0;
    bool error = false;
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        count += showWarnings && (state.warn[i] || state.error[i]);
        error |= state.error[i];
    }
    ui::setVisible(connectivity, count == 0);
    ui::setVisible(wifi, state.wifiConnected);
    ui::setVisible(bluetooth, state.controllerConnected);
    ui::setVisible(updateIcon, state.updateAvailable);
    ui::setVisible(warning.root, count > 0);
    char buf[24];
    snprintf(buf, sizeof(buf), "%d %s", count, count == 1 ? "WARNING" : "WARNINGS");
    ui::setBadge(warning, error ? ui::Tone::Danger : ui::Tone::Warning, buf);
    updatePairs(state);
    if (minimal) {
        ui::setVisible(singleTemperature, !state.pressureAvailable);
        snprintf(buf, sizeof(buf), "%.0f °C", state.currentTemp);
        ui::setText(singleTemperature, buf);
    }
}

void WorkingScreen::updatePairs(const UiState &state) {
    char buf[40];
    snprintf(buf, sizeof(buf), "%.1f", state.currentTemp);
    ui::setText(tempValue, buf);
    snprintf(buf, sizeof(buf), "/ %.0f °C", state.targetTemp);
    ui::setText(tempTarget, buf);
    ui::setFg(tempCaption, state.temperatureStable ? Fg::Success : Fg::Heat);
    snprintf(buf, sizeof(buf), "%.1f", state.pressure);
    ui::setText(pressureValue, buf);
    snprintf(buf, sizeof(buf), "/ %.1f BAR", state.targetPressure);
    ui::setText(pressureTarget, buf);
    ui::setVisible(pressurePair, state.pressureAvailable);
    lv_obj_t *tempPair = lv_obj_get_parent(tempValue);
    const lv_coord_t x = state.pressureAvailable ? 0 : 85;
    if (lv_obj_get_x(tempPair) != x)
        lv_obj_set_x(tempPair, x);
}

} // namespace bm
