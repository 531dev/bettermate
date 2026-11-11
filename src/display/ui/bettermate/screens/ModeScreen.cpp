#include "ModeScreen.h"

#include <cmath>
#include <cstdio>

namespace bm {

void ModeScreen::build(lv_obj_t *root) {
    buildFrame(root);
    const bool grind = kind == Kind::Grind;
    ui::setVisible(title, false);
    if (grind) {
        progressRim.build(content, luxury::Rim::Shape::Dial);
        ui::setVisible(progressRim.arcObj(), false);
    } else {
        temperatureRim.build(content, luxury::Rim::Shape::Left);
        pressureRim.build(content, luxury::Rim::Shape::Right);
    }
    indicators.build(content);
    lv_obj_add_flag(indicators.warning, LV_OBJ_FLAG_CLICKABLE);
    bind(indicators.warning, Intent::Warnings);

    // The mode name alone; Steam and Water carry the live temperature under it.
    lv_obj_set_width(modeLabel, LV_SIZE_CONTENT);
    lv_obj_set_style_text_letter_space(modeLabel, 1, 0);
    lv_obj_align(modeLabel, LV_ALIGN_TOP_MID, 0, 60);
    ui::setText(modeLabel, kind == Kind::Steam ? "STEAM" : kind == Kind::Water ? "WATER" : "GRIND");
    if (!grind) {
        current = luxury::label(content, 0, 88, &bm_luxury_mode, "", 200);
        currentReading.attach(current, 0, "°");
    }

    // The target between its −/+ on the panel's centre line; the smaller weight face centres there too.
    auto *heroBox = ui::box(content);
    lv_obj_set_size(heroBox, 250, 124);
    lv_obj_set_pos(heroBox, 240 - 125, CENTER_Y - 62);
    hero = luxury::label(heroBox, 0, 0, &bm_luxury_clock, "", 250);
    lv_obj_align(hero, LV_ALIGN_CENTER, 0, 0);
    reading.attach(hero, 0);
    unit = luxury::label(content, 0, CENTER_Y + 64, &bm_luxury_detail, "", 200, 1);
    nudge[0] = stepper(content, 76, CENTER_Y, "–", grind ? Intent::GrindDown : Intent::TempDown);
    nudge[1] = stepper(content, 404, CENTER_Y, "+", grind ? Intent::GrindUp : Intent::TempUp);

    if (kind != Kind::Steam) {
        action = luxury::pill(content, 240, 392, 152, 56, "START");
        bind(action, grind ? Intent::ToggleGrind : Intent::ToggleWater);
    }
    if (grind) {
        // Time or weight, as one quiet switch above the reading it selects.
        targetSwitch = luxury::control(content, 240, 132, 200, 56);
        auto *row = ui::row(targetSwitch, 10);
        lv_obj_center(row);
        switchTime = luxury::label(row, 0, 0, &bm_luxury_detail, "TIME", 0, 2);
        switchDot = luxury::label(row, 0, 0, &bm_luxury_detail, "·");
        switchWeight = luxury::label(row, 0, 0, &bm_luxury_detail, "WEIGHT", 0, 2);
        bind(targetSwitch, Intent::ToggleTarget);
        scale = luxury::control(content, 126, 392, 72, 56);
        weight = luxury::label(scale, 0, 4, &bm_luxury_detail, "", 70);
        luxury::label(scale, 0, 30, &bm_luxury_detail, "TARE", 0, 1);
        bind(scale, Intent::Tare);
    }
}

void ModeScreen::onShow(const UiState &state) {
    luxury::Instant now;
    wasStable = state.temperatureStable;
    update(state);
}

void ModeScreen::update(const UiState &s) {
    const auto p = luxury::palette();
    const bool grind = kind == Kind::Grind;
    const bool steam = kind == Kind::Steam;
    const bool active = grind ? s.grindActive : s.active;
    updateFrame(s, true, steam);
    indicators.update(s, false, false, active);
    char buf[64];

    // −/+ are offered only while a change can take effect.
    const bool canAdjust = s.canWake && !(grind && active);
    const bool ready = s.temperatureStable;

    // The live temperature, which the rim also shows against its target notch
    luxury::color(modeLabel, p.faint);
    if (!grind) {
        currentReading.set(s.currentTemp, luxury::MOTION_STATE);
        luxury::color(current, p.ink);
    }

    // The target and its unit
    lv_obj_set_style_text_font(hero, &bm_luxury_clock, 0);
    if (grind) {
        const bool volume = active ? s.activeGrindVolumetric : s.grindVolumetric;
        if (volume)
            snprintf(buf, sizeof(buf), "%.1f", active ? s.grindOutput : s.grindWeight);
        else
            formatTime(active ? (s.grindElapsed >= s.activeGrindDuration ? 0 : s.activeGrindDuration - s.grindElapsed)
                              : s.grindDuration, buf, sizeof(buf));
        // Weight targets reach 250 g; the 72 px face keeps them clear of the side controls.
        if (volume)
            lv_obj_set_style_text_font(hero, &bm_luxury_reading, 0);
        ui::setText(hero, buf);
        ui::setText(unit, volume ? "g" : "");
        luxury::fade(unit, volume);
        const float progress = volume ? (s.activeGrindWeight > 0 ? s.grindOutput / s.activeGrindWeight : 0)
                                      : (s.activeGrindDuration > 0 ? static_cast<float>(s.grindElapsed) / s.activeGrindDuration : 0);
        progressRim.colors(p.line, p.accent, p.ink);
        progressRim.set(active ? progress : 0, -1, active);
        progressRim.show(active);
    } else {
        reading.set(s.targetTemp, luxury::MOTION_STATE);
        ui::setText(unit, "TARGET °C");
        temperatureRim.reshape(s.pressureAvailable ? luxury::Rim::Shape::Left : luxury::Rim::Shape::Dial);
        temperatureRim.colors(p.line, p.accent, p.ink);
        temperatureRim.set(luxury::rimFraction(s.currentTemp, luxury::RIM_MAX_TEMPERATURE),
                           luxury::rimFraction(s.targetTemp, luxury::RIM_MAX_TEMPERATURE));
        pressureRim.colors(p.line, p.accent, p.ink);
        pressureRim.set(luxury::rimFraction(s.pressure, luxury::RIM_MAX_PRESSURE),
                        active && s.targetPressure > 0.05f ? luxury::rimFraction(s.targetPressure, luxury::RIM_MAX_PRESSURE) : -1);
        pressureRim.show(s.pressureAvailable);
        if (ready && !wasStable)
            temperatureRim.swell();
    }
    wasStable = ready;
    luxury::color(hero, p.ink);
    luxury::color(unit, p.muted);
    for (auto *obj : nudge) {
        luxury::border(obj, p.muted);
        luxury::color(lv_obj_get_child(obj, 0), p.ink);
        luxury::enabled(obj, canAdjust);
    }

    if (grind) {
        const bool switchable = s.volumetricAvailable && !active;
        luxury::fade(targetSwitch, switchable);
        luxury::color(switchTime, s.grindVolumetric ? p.faint : p.ink);
        luxury::color(switchWeight, s.grindVolumetric ? p.ink : p.faint);
        luxury::color(switchDot, p.faint);
        luxury::fade(scale, s.bluetoothScale && !active);
        snprintf(buf, sizeof(buf), "%.1f g", s.weight);
        ui::setText(weight, buf);
        luxury::color(weight, p.ink);
        luxury::color(lv_obj_get_child(scale, 1), p.accent);
    }
    if (action) {
        ui::setText(lv_obj_get_child(action, 0), active ? "STOP" : "START");
        luxury::border(action, p.accent);
        luxury::color(lv_obj_get_child(action, 0), p.accent);
        luxury::enabled(action, s.canWake);
    }
}

} // namespace bm
