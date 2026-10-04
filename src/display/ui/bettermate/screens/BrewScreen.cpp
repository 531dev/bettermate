#include "BrewScreen.h"

#include <cstdio>

namespace bm {

void BrewScreen::build(lv_obj_t *root) {
    buildFrame(root);
    lv_obj_set_y(pairs, 265);
    lv_obj_add_flag(warning.root, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(warning.root, 16);
    lv_obj_add_event_cb(
        warning.root,
        [](lv_event_t *e) {
            auto *screen = static_cast<BrewScreen *>(lv_event_get_user_data(e));
            screen->viewingWarnings = true;
            screen->host.act(Intent::Refresh);
        },
        LV_EVENT_SHORT_CLICKED, this);
    idle = ui::box(root);
    lv_obj_set_size(idle, 480, 480);
    text(idle, 0, 161, Type::Label, Fg::Muted, "TEMPERATURE");
    hero = text(idle, 0, 182, Type::Metric, Fg::Ink, "", 300);
    lv_obj_set_height(hero, 78);
    lv_obj_add_flag(hero, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
    bind(hero, Intent::Menu);
    targetHint = text(idle, 0, 247, Type::Label, Fg::Muted);
    button(idle, 142, 374, 56, &bm_icon_list_24, Intent::Profile);
    button(idle, 338, 374, 56, &bm_icon_settings_24, Intent::Adjust);
    start = button(idle, 240, 382, 72, &bm_icon_play_48, Intent::Start, Bg::Primary, Fg::OnPrimary);
    bind(start, Intent::Flush, LV_EVENT_LONG_PRESSED);

    scale = ui::row(idle, 8);
    lv_obj_set_size(scale, 190, 56);
    lv_obj_set_flex_align(scale, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_pos(scale, 145, 105);
    lv_obj_add_flag(scale, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_GESTURE_BUBBLE);
    scaleIcon = ui::icon(scale, &bm_icon_scale_24, Fg::Muted);
    weight = ui::label(scale, Type::MetricSm, Fg::Ink);
    lv_obj_clear_flag(weight, LV_OBJ_FLAG_CLICKABLE);
    bind(scale, Intent::ToggleTarget);
    bind(scale, Intent::Tare, LV_EVENT_LONG_PRESSED);

    adjust = ui::box(root);
    lv_obj_set_size(adjust, 480, 480);
    text(adjust, 0, 127, Type::Label, Fg::Heat, "TEMPERATURE");
    temperature = text(adjust, 0, 154, Type::MetricSm, Fg::Ink);
    button(adjust, 130, 170, 56, &bm_icon_minus_24, Intent::TempDown);
    button(adjust, 350, 170, 56, &bm_icon_plus_24, Intent::TempUp);
    targetCaption = text(adjust, 0, 218, Type::Label, Fg::Primary);
    target = text(adjust, 0, 245, Type::MetricSm, Fg::Ink);
    button(adjust, 130, 261, 56, &bm_icon_minus_24, Intent::TargetDown);
    button(adjust, 350, 261, 56, &bm_icon_plus_24, Intent::TargetUp);
    deleteWeight = button(adjust, 240, 300, 56, &bm_icon_clock_24, Intent::DeleteWeight);
    deleteCaption = text(adjust, 0, 326, Type::Label, Fg::Muted, "USE TIME");
    save = button(adjust, 142, 382, 56, &bm_icon_save_24, Intent::Save);
    button(adjust, 240, 382, 72, &bm_icon_check_48, Intent::Accept, Bg::Primary, Fg::OnPrimary);
    saveAsNew = button(adjust, 338, 382, 56, &bm_icon_square_pen_24, Intent::SaveAsNew);
    text(adjust, -98, 332, Type::Label, Fg::Muted, "SAVE");
    text(adjust, 98, 332, Type::Label, Fg::Muted, "COPY");

    overlay = ui::box(root);
    lv_obj_set_size(overlay, 480, 480);
    lv_obj_add_flag(overlay, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(overlay, LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_t *card = ui::fill(overlay, Bg::Surface1, 24);
    lv_obj_set_size(card, 300, 324);
    lv_obj_set_pos(card, 90, 90);
    warningTitle = text(card, 0, 18, Type::Title, Fg::Ink, "Confirm brew");
    text(card, 0, 54, Type::Label, Fg::Warning, "ACTIVE WARNINGS");
    for (auto &row : warningRows)
        row = text(card, 0, 86, Type::Body, Fg::Warning, "", 280);
    warningBack = button(card, 78, 276, 56, &bm_icon_chevron_left_24, Intent::CancelConfirm);
    lv_obj_add_event_cb(
        warningBack, [](lv_event_t *e) { static_cast<BrewScreen *>(lv_event_get_user_data(e))->viewingWarnings = false; },
        LV_EVENT_SHORT_CLICKED, this);
    warningConfirm = button(card, 222, 276, 72, &bm_icon_play_48, Intent::Confirm, Bg::Primary, Fg::OnPrimary);
}

void BrewScreen::update(const UiState &state) {
    updateFrame(state);
    ui::setText(modeLabel, state.adjusting ? "ADJUST PROFILE" : "BREW");
    ui::setText(title, state.profileName.c_str());
    ui::setVisible(idle, !state.adjusting);
    ui::setVisible(adjust, state.adjusting);
    showPairs(!state.adjusting);
    const bool modal = state.confirming || viewingWarnings;
    ui::setVisible(overlay, modal);
    // A modal takes every touch until it is answered; the rim remains visible behind its card.
    ui::setVisible(menu, !modal);
    if (modal) {
        ui::setText(warningTitle, state.confirming ? "Confirm brew" : "Machine warnings");
        ui::setVisible(warningConfirm, state.confirming);
        lv_obj_set_x(warningBack, (state.confirming ? 78 : 150) - 28);
        int row = 0;
        for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
            const bool visible = state.warn[i] || state.error[i];
            ui::setVisible(warningRows[i], visible);
            if (visible) {
                ui::setText(warningRows[i], WarningManager::label(static_cast<WarningType>(i)));
                ui::setFg(warningRows[i], state.error[i] ? Fg::Danger : Fg::Warning);
                lv_obj_set_y(warningRows[i], 86 + row++ * 24);
            }
        }
    }
    char buf[48], time[20];
    snprintf(buf, sizeof(buf), "%.1f", state.currentTemp);
    ui::setText(hero, buf);
    const bool volume = state.profileVolumetric && state.volumetricAvailable;
    formatTime(static_cast<unsigned long>(state.profileDuration * 1000), time, sizeof(time));
    if (volume)
        snprintf(buf, sizeof(buf), "%.0f G TARGET", state.profileWeight);
    else
        snprintf(buf, sizeof(buf), "%s SHOT TARGET", time);
    ui::setText(targetHint, buf);
    ui::setVisible(scale, state.volumetricAvailable);
    ui::setIcon(scaleIcon, state.bluetoothScale ? &bm_icon_scale_24 : &bm_icon_waves_24);
    if (state.bluetoothScale)
        snprintf(buf, sizeof(buf), "%.1f g", state.weight);
    else
        snprintf(buf, sizeof(buf), "- g");
    ui::setText(weight, buf);
    enable(start, state.canWake);

    snprintf(buf, sizeof(buf), "%.0f °C", state.targetTemp);
    ui::setText(temperature, buf);
    ui::setText(targetCaption, volume ? "WEIGHT" : "DURATION");
    if (volume)
        snprintf(buf, sizeof(buf), "%.1f g", state.profileWeight);
    else
        snprintf(buf, sizeof(buf), "%s", time);
    ui::setText(target, buf);
    ui::setVisible(deleteWeight, volume);
    ui::setVisible(deleteCaption, volume);
    enable(save, state.profileDirty);
    enable(saveAsNew, state.profileDirty);
}

} // namespace bm
