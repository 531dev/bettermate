#include "BrewScreen.h"

#include <cmath>
#include <cstdio>

namespace bm {

void BrewScreen::build(lv_obj_t *root) {
    lv_obj_add_event_cb(root, [](lv_event_t *e) {
        auto *screen = static_cast<BrewScreen *>(lv_event_get_user_data(e));
        auto *input = lv_indev_get_act();
        if (input == nullptr)
            return;
        lv_indev_wait_release(input);
        if (lv_indev_get_gesture_dir(input) == LV_DIR_TOP)
            screen->host.act(Intent::Menu);
    }, LV_EVENT_GESTURE, this);

    idle = ui::box(root);
    lv_obj_set_size(idle, 480, 480);
    // The rim carries temperature on the left and pressure on the right, each with its target notch.
    temperatureRim.build(idle, luxury::Rim::Shape::Left);
    pressureRim.build(idle, luxury::Rim::Shape::Right);
    indicators.build(idle);
    lv_obj_add_flag(indicators.warning, LV_OBJ_FLAG_CLICKABLE);
    bind(indicators.warning, Intent::Warnings);

    auto *statusControl = luxury::control(idle, 240, 70, 360, 40);
    lv_obj_clear_flag(statusControl, LV_OBJ_FLAG_CLICKABLE);
    status = luxury::label(statusControl, 0, 0, &bm_luxury_detail, "", 0, 1);
    lv_obj_align(status, LV_ALIGN_CENTER, 7, 0);
    statusDot = ui::box(statusControl);
    lv_obj_set_size(statusDot, 5, 5);
    lv_obj_set_style_radius(statusDot, LV_RADIUS_CIRCLE, 0);

    hero = luxury::label(idle, 0, 116, &bm_luxury_clock, "", 300);
    temperature.attach(hero, 0);
    unit = luxury::label(idle, 0, 240, &bm_luxury_detail, "°C", 120, 1);
    unsaved = luxury::label(idle, 0, 272, &bm_luxury_detail, "UNSAVED", 200, 2);
    profile = luxury::control(idle, 240, 310, 300, 56);
    // The name and its chevron read as one centered group.
    auto *profileGroup = ui::row(profile, 4);
    lv_obj_center(profileGroup);
    profileName = luxury::label(profileGroup, 0, 0, &bm_luxury_recipe, "");
    lv_obj_set_style_max_width(profileName, 230, 0);
    lv_label_set_long_mode(profileName, LV_LABEL_LONG_DOT);
    chevron = luxury::glyph(profileGroup, luxury::Glyph::ChevronRight, 24);
    bind(profile, Intent::Profile);
    // A connected scale adds a quiet live-weight/Tare control beside the one primary action.
    scale = luxury::control(idle, 126, 392, 72, 56);
    scaleWeight = luxury::label(scale, 0, 4, &bm_luxury_detail, "", 70);
    luxury::label(scale, 0, 30, &bm_luxury_detail, "TARE", 0, 1);
    bind(scale, Intent::Tare);
    start = luxury::pill(idle, 240, 392, 152, 56, "START");
    bind(start, Intent::Start);
    bind(start, Intent::Flush, LV_EVENT_LONG_PRESSED);

    menu = luxury::modesButton(root);
    bind(menu, Intent::Menu);

    overlay = ui::box(root);
    lv_obj_set_size(overlay, 480, 480);
    lv_obj_add_flag(overlay, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(overlay, LV_OBJ_FLAG_GESTURE_BUBBLE);
    warningTitle = luxury::label(overlay, 0, 92, &bm_luxury_mode, "Confirm brew", 300);
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i)
        warningRows[i] = luxury::label(overlay, 0, 150 + i * 30, &bm_luxury_body, "", 300);
    warningConfirm = luxury::pill(overlay, 240, 352, 152, 56, "START");
    warningBack = luxury::textButton(overlay, 240, 414, 140, "CANCEL");
    bind(warningBack, Intent::CancelConfirm);
    bind(warningConfirm, Intent::Confirm);
}

void BrewScreen::onShow(const UiState &state) {
    luxury::Instant now;
    wasStable = state.temperatureStable;
    update(state);
}

void BrewScreen::update(const UiState &s) {
    const auto p = luxury::palette();
    luxury::background(root(), p.background);
    luxury::background(overlay, p.background);
    const bool modal = s.confirming;
    ui::setVisible(idle, !modal);
    ui::setVisible(menu, !modal);
    ui::setVisible(overlay, modal);
    char buf[96];

    indicators.update(s, false);
    const bool ready = s.temperatureStable;
    if (ready)
        snprintf(buf, sizeof(buf), "BREW · READY");
    else
        snprintf(buf, sizeof(buf), "BREW · HEATING TO %ld°", lroundf(s.targetTemp));
    ui::setText(status, buf);
    luxury::color(status, p.faint);
    lv_obj_update_layout(status);
    lv_obj_align_to(statusDot, status, LV_ALIGN_OUT_LEFT_MID, -10, 0);
    luxury::background(statusDot, p.accent);
    ui::setVisible(statusDot, !ready);
    luxury::pulse(statusDot, !ready);

    temperature.set(s.currentTemp);
    luxury::color(hero, p.ink);
    luxury::color(unit, p.muted);
    // Without a pressure sensor temperature keeps the whole dial, as the stock single ring did.
    temperatureRim.reshape(s.pressureAvailable ? luxury::Rim::Shape::Left : luxury::Rim::Shape::Dial);
    temperatureRim.colors(p.line, p.accent, p.ink);
    temperatureRim.set(luxury::rimFraction(s.currentTemp, luxury::RIM_MAX_TEMPERATURE),
                       luxury::rimFraction(s.targetTemp, luxury::RIM_MAX_TEMPERATURE));
    pressureRim.colors(p.line, p.accent, p.ink);
    pressureRim.set(luxury::rimFraction(s.pressure, luxury::RIM_MAX_PRESSURE),
                    s.targetPressure > 0.05f ? luxury::rimFraction(s.targetPressure, luxury::RIM_MAX_PRESSURE) : -1);
    pressureRim.show(s.pressureAvailable);
    if (ready && !wasStable)
        temperatureRim.swell();
    wasStable = ready;

    ui::setText(profileName, s.profileName.c_str());
    luxury::color(profileName, p.ink);
    luxury::glyphColor(chevron, p.muted);
    luxury::color(unsaved, p.warning);
    luxury::fade(unsaved, s.profileDirty);
    luxury::updateModesButton(menu);

    luxury::fade(scale, s.bluetoothScale);
    snprintf(buf, sizeof(buf), "%.1f g", s.weight);
    ui::setText(scaleWeight, buf);
    luxury::color(scaleWeight, p.ink);
    luxury::color(lv_obj_get_child(scale, 1), p.accent);
    luxury::border(start, p.accent);
    luxury::color(lv_obj_get_child(start, 0), p.accent);
    luxury::enabled(start, s.canWake);

    luxury::border(warningConfirm, p.accent);
    luxury::color(lv_obj_get_child(warningConfirm, 0), p.accent);
    luxury::color(lv_obj_get_child(warningBack, 0), p.muted);
    luxury::color(warningTitle, p.ink);
    if (modal) {
        luxury::enabled(warningConfirm, s.canWake);
        int row = 0;
        for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
            const bool visible = s.warn[i] || s.error[i];
            ui::setVisible(warningRows[i], visible);
            if (visible) {
                ui::setText(warningRows[i], luxury::warningName(static_cast<WarningType>(i)));
                luxury::color(warningRows[i], s.error[i] ? p.danger : p.warning);
                lv_obj_set_y(warningRows[i], 150 + row++ * 30);
            }
        }
    }
}
} // namespace bm
