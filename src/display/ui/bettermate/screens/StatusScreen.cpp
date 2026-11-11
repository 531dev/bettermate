#include "StatusScreen.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>

namespace bm {

void StatusScreen::build(lv_obj_t *root) {
    buildFrame(root);
    pressureRim.build(content, luxury::Rim::Shape::Dial);
    phases.build(content);
    lv_obj_align(modeLabel, LV_ALIGN_TOP_MID, 0, 62);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 88);
    pressureValue = luxury::label(content, 0, 122, &bm_luxury_recipe, "", 220, 1);
    hero = luxury::label(content, 0, 150, &bm_luxury_clock, "", 340);
    phaseName = luxury::label(content, 0, 280, &bm_luxury_detail, "", 300, 2);
    summary = luxury::label(content, 0, 276, &bm_luxury_recipe, "", 300);
    weight = luxury::label(content, 0, 308, &bm_luxury_recipe, "", 240);
    temperature = luxury::label(content, 0, 338, &bm_luxury_detail, "", 240, 2);
    action = luxury::pill(content, 240, 392, 152, 56, "STOP");
    bind(action, Intent::Finish);
}

void StatusScreen::onShow(const UiState &state) {
    luxury::Instant now;
    update(state);
}

void StatusScreen::update(const UiState &s) {
    updateFrame(s, s.shot.complete);
    const auto p = luxury::palette();
    const auto &shot = s.shot;
    const bool running = !shot.complete;
    char buf[96], elapsed[24];

    ui::setText(modeLabel, "SHOT COMPLETE");
    luxury::fade(modeLabel, shot.complete, luxury::MOTION_STATE);
    ui::setText(title, shot.profileName.c_str());
    luxury::color(title, p.muted);

    // Rim: live pressure with the phase's target notch; inside it, one segment per phase.
    pressureRim.colors(p.line, p.accent, p.ink);
    pressureRim.set(luxury::rimFraction(s.pressure, luxury::RIM_MAX_PRESSURE),
                    s.targetPressure > 0.05f ? luxury::rimFraction(s.targetPressure, luxury::RIM_MAX_PRESSURE) : -1,
                    false);
    pressureRim.show(s.pressureAvailable && running);
    phases.plan(shot.phaseDurations, shot.phaseCount);
    phases.colors(p.line, p.ink);
    phases.set(shot.phaseIndex, shot.progress / 100.0f, shot.complete);
    phases.show(running);

    snprintf(buf, sizeof(buf), "%.1f bar", s.pressure);
    ui::setText(pressureValue, buf);
    luxury::color(pressureValue, p.accent);
    luxury::fade(pressureValue, s.pressureAvailable && running, luxury::MOTION_STATE);

    formatTime(shot.elapsed, elapsed, sizeof(elapsed));
    ui::setText(hero, elapsed);
    lv_obj_set_style_text_font(hero, strlen(elapsed) > 5 ? &bm_luxury_reading : &bm_luxury_clock, 0);
    luxury::color(hero, p.ink);

    ui::setText(phaseName, shot.phaseName.c_str());
    luxury::color(phaseName, p.muted);
    luxury::fade(phaseName, running, luxury::MOTION_STATE);

    // Completion: the rings fade and, when the shot was weighed, its yield and ratio take the phase's place.
    // The frozen timer already says how long it ran.
    const bool weighed = s.volumetricAvailable && shot.weight > 0.05;
    if (weighed && s.profileDose > 0)
        snprintf(buf, sizeof(buf), "%.1f g · 1:%.1f", shot.weight, shot.weight / s.profileDose);
    else
        snprintf(buf, sizeof(buf), "%.1f g", shot.weight);
    ui::setText(summary, buf);
    luxury::color(summary, p.ink);
    luxury::fade(summary, shot.complete && weighed, luxury::MOTION_PAGE);

    // Weight only with a scale; temperature only when it strays from the shot's target.
    const bool showWeight = running && s.volumetricAvailable && s.bluetoothScale;
    if (shot.volumetric && shot.targetWeight > 0)
        snprintf(buf, sizeof(buf), "%.1f / %.1f g", shot.weight, shot.targetWeight);
    else
        snprintf(buf, sizeof(buf), "%.1f g", shot.weight);
    ui::setText(weight, buf);
    luxury::color(weight, p.ink);
    luxury::fade(weight, showWeight, luxury::MOTION_STATE);
    const bool strays = running && shot.targetTemp > 0 && std::fabs(s.currentTemp - shot.targetTemp) > 3.0f;
    snprintf(buf, sizeof(buf), "TEMPERATURE %ld°", lroundf(s.currentTemp));
    ui::setText(temperature, buf);
    luxury::color(temperature, p.warning);
    luxury::fade(temperature, strays, luxury::MOTION_STATE);

    ui::setText(lv_obj_get_child(action, 0), shot.complete ? "DONE" : "STOP");
    luxury::border(action, p.accent);
    luxury::color(lv_obj_get_child(action, 0), p.accent);
}

} // namespace bm
