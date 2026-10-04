#include "ProfileScreen.h"

#include <cstdio>

namespace bm {

void ProfileScreen::build(lv_obj_t *root) {
    buildFrame(root, true);
    lv_obj_add_event_cb(
        root,
        [](lv_event_t *e) {
            auto *screen = static_cast<ProfileScreen *>(lv_event_get_user_data(e));
            lv_indev_t *input = lv_indev_get_act();
            if (!input)
                return;
            const lv_dir_t dir = lv_indev_get_gesture_dir(input);
            if (dir == LV_DIR_LEFT || dir == LV_DIR_RIGHT) {
                lv_indev_wait_release(input);
                screen->host.act(dir == LV_DIR_LEFT ? Intent::NextProfile : Intent::PreviousProfile);
            }
        },
        LV_EVENT_GESTURE, this);
    text(root, 0, 145, Type::Label, Fg::Heat, "TEMPERATURE");
    temperature = text(root, 0, 170, Type::MetricSm, Fg::Ink);
    text(root, 0, 220, Type::Label, Fg::Primary, "SHOT TARGET");
    target = text(root, 0, 245, Type::MetricSm, Fg::Ink);
    counts = text(root, 0, 293, Type::Body, Fg::Muted);
    position = text(root, 0, 326, Type::Label, Fg::Muted);
    previous = button(root, 70, 240, 56, &bm_icon_chevron_left_24, Intent::PreviousProfile);
    next = button(root, 410, 240, 56, &bm_icon_chevron_right_24, Intent::NextProfile);
    button(root, 240, 382, 72, &bm_icon_check_48, Intent::SelectProfile, Bg::Primary, Fg::OnPrimary);
}

void ProfileScreen::update(const UiState &state) {
    updateFrame(state, false);
    const auto &p = state.preview;
    ui::setText(modeLabel, p.index == 0 ? "CURRENT PROFILE" : "SELECT PROFILE");
    ui::setText(title, p.name.c_str());
    char buf[64];
    snprintf(buf, sizeof(buf), "%.0f °C", p.temperature);
    ui::setText(temperature, buf);
    if (p.volumetric)
        snprintf(buf, sizeof(buf), "%.1f g", p.weight);
    else
        formatTime(static_cast<unsigned long>(p.duration * 1000), buf, sizeof(buf));
    ui::setText(target, buf);
    snprintf(buf, sizeof(buf), "%u %s · %u %s", p.phases, p.phases == 1 ? "phase" : "phases", p.steps,
             p.steps == 1 ? "step" : "steps");
    ui::setText(counts, buf);
    snprintf(buf, sizeof(buf), "%u / %u", p.index + 1, p.count ? p.count : 1);
    ui::setText(position, buf);
    enable(previous, p.previous);
    enable(next, p.next);
}

} // namespace bm
