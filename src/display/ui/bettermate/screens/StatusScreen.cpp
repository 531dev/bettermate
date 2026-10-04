#include "StatusScreen.h"

#include <algorithm>
#include <cstdio>

namespace bm {

void StatusScreen::build(lv_obj_t *root) {
    buildFrame(root);
    lv_obj_set_y(pairs, 244);
    lv_obj_t *phaseRow = ui::row(root, 12);
    lv_obj_align(phaseRow, LV_ALIGN_TOP_MID, 0, 112);
    phaseType = ui::label(phaseRow, Type::Label, Fg::Muted);
    weight = ui::label(phaseRow, Type::Label, Fg::Ink);
    text(root, 0, 132, Type::Label, Fg::Muted, "SHOT TIME");
    hero = text(root, 0, 154, Type::Metric, Fg::Ink, "", 300);
    lv_obj_set_height(hero, 78);
    lv_obj_add_flag(hero, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
    bind(hero, Intent::Menu);
    shotTarget = text(root, 0, 222, Type::Label, Fg::Muted);
    progress = ui::fill(root, Bg::Line, LV_RADIUS_CIRCLE);
    lv_obj_set_size(progress, 280, 6);
    lv_obj_set_pos(progress, 100, 320);
    progressFill = ui::fill(progress, Bg::Primary, LV_RADIUS_CIRCLE);
    lv_obj_set_size(progressFill, 0, 6);
    phaseProgress = text(root, 0, 329, Type::Label, Fg::Muted);
    action = button(root, 240, 386, 72, &bm_icon_stop_48, Intent::Finish, Bg::Primary, Fg::OnPrimary);
    actionIcon = lv_obj_get_child(action, 0);
}

void StatusScreen::update(const UiState &state) {
    updateFrame(state);
    const auto &shot = state.shot;
    ui::setText(modeLabel, shot.complete ? "SHOT COMPLETE" : "BREW");
    ui::setText(title, shot.phaseName.c_str());
    ui::setText(phaseType, shot.phaseType.c_str());
    char buf[64], elapsed[24], duration[24];
    formatTime(shot.elapsed, elapsed, sizeof(elapsed));
    ui::setText(hero, elapsed);
    formatTime(static_cast<unsigned long>(shot.duration * 1000), duration, sizeof(duration));
    if (shot.volumetric)
        snprintf(buf, sizeof(buf), "%.0f G TARGET · %.0f °C", shot.targetWeight, shot.targetTemp);
    else
        snprintf(buf, sizeof(buf), "%s TARGET · %.0f °C", duration, shot.targetTemp);
    ui::setText(shotTarget, buf);
    ui::setVisible(progress, !shot.complete);
    ui::setVisible(phaseProgress, !shot.complete);
    const int width = static_cast<int>(std::clamp(shot.progress, 0.0f, 100.0f) * 2.8f);
    if (lv_obj_get_width(progressFill) != width)
        lv_obj_set_width(progressFill, width);
    snprintf(buf, sizeof(buf), "%.1f%s / %.1f%s", shot.phaseCurrent, shot.phaseWeight ? "g" : "s", shot.phaseTarget,
             shot.phaseWeight ? "g" : "s");
    ui::setText(phaseProgress, buf);
    ui::setVisible(weight, state.volumetricAvailable && (shot.complete || state.bluetoothScale));
    snprintf(buf, sizeof(buf), "%.1f G%s", shot.weight, shot.complete ? " FINAL" : "");
    ui::setText(weight, buf);
    ui::setIcon(actionIcon, shot.complete ? &bm_icon_check_48 : &bm_icon_stop_48);
}

} // namespace bm
