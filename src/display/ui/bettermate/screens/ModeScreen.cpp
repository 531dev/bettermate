#include "ModeScreen.h"

#include <cstdio>

namespace bm {

void ModeScreen::build(lv_obj_t *root) {
    buildFrame(root);
    lv_obj_set_y(pairs, 265);
    const bool grind = kind == Kind::Grind;
    caption = text(root, 0, 161, Type::Label, Fg::Muted, "TEMPERATURE");
    hero = text(root, 0, 182, Type::Metric, Fg::Ink, "", 300);
    lv_obj_set_height(hero, 78);
    lv_obj_add_flag(hero, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
    bind(hero, Intent::Menu);
    hint = text(root, 0, 247, Type::Label, Fg::Muted);
    button(root, 142, 374, 56, &bm_icon_minus_24, grind ? Intent::GrindDown : Intent::TempDown);
    button(root, 338, 374, 56, &bm_icon_plus_24, grind ? Intent::GrindUp : Intent::TempUp);
    if (kind == Kind::Steam) {
        action = ui::fill(root, Bg::Heat, LV_RADIUS_CIRCLE);
        lv_obj_set_size(action, 72, 72);
        lv_obj_set_pos(action, 204, 346);
        actionIcon = ui::icon(action, &bm_icon_wind_48, Fg::OnHeat);
        lv_obj_center(actionIcon);
    } else {
        action = button(root, 240, 382, 72, &bm_icon_play_48, grind ? Intent::ToggleGrind : Intent::ToggleWater, Bg::Primary,
                        Fg::OnPrimary);
        actionIcon = lv_obj_get_child(action, 0);
    }
    if (grind) {
        scale = ui::row(root, 8);
        lv_obj_set_size(scale, 190, 56);
        lv_obj_set_style_radius(scale, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_flex_align(scale, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_pos(scale, 145, 105);
        lv_obj_add_flag(scale, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
        ui::icon(scale, &bm_icon_scale_24, Fg::Ink);
        weight = ui::label(scale, Type::MetricSm, Fg::Ink);
        bind(scale, Intent::ToggleTarget);
        bind(scale, Intent::Tare, LV_EVENT_LONG_PRESSED);
    }
}

void ModeScreen::update(const UiState &state) {
    updateFrame(state);
    char buf[48];
    if (kind == Kind::Grind) {
        ui::setText(modeLabel, "GRIND");
        ui::setText(title, state.grindActive ? "Grinding" : "Set your dose");
        ui::setText(caption, state.grindVolumetric ? "WEIGHT TARGET" : "TIME TARGET");
        if (state.grindVolumetric)
            snprintf(buf, sizeof(buf), "%.1f", state.grindWeight);
        else
            formatTime(state.grindDuration, buf, sizeof(buf));
        ui::setText(hero, buf);
        ui::setText(hint, state.grindVolumetric ? "GRAMS · ADJUST BELOW" : "MIN:SEC · ADJUST BELOW");
        ui::setVisible(scale, state.bluetoothScale);
        snprintf(buf, sizeof(buf), "%.1f g", state.weight);
        ui::setText(weight, buf);
        ui::setBg(scale, state.grindVolumetric ? Bg::PrimarySoft : Bg::Surface2);
        ui::setIcon(actionIcon, state.grindActive ? &bm_icon_stop_48 : &bm_icon_play_48);
        enable(action, state.canWake);
    } else {
        const bool steam = kind == Kind::Steam;
        ui::setText(modeLabel, steam ? "STEAM" : "WATER");
        ui::setText(title,
                    steam ? (state.active ? "Steaming" : "Heating automatically") : (state.active ? "Dispensing" : "Hot water"));
        snprintf(buf, sizeof(buf), "%.1f", state.currentTemp);
        ui::setText(hero, buf);
        snprintf(buf, sizeof(buf), "%.0f °C TARGET · ADJUST BELOW", state.targetTemp);
        ui::setText(hint, buf);
        if (steam)
            ui::setVisible(action, state.active);
        else {
            ui::setIcon(actionIcon, state.active ? &bm_icon_stop_48 : &bm_icon_play_48);
            enable(action, state.canWake);
        }
    }
}

} // namespace bm
