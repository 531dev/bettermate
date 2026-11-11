#include "WorkingScreen.h"

#include <cstdio>

namespace bm {

void formatTime(unsigned long ms, char *buf, size_t size) { snprintf(buf, size, "%lu:%02lu", ms / 60000, ms / 1000 % 60); }

lv_obj_t *WorkingScreen::stepper(lv_obj_t *parent, int x, int y, const char *value, Intent intent) {
    auto *obj = luxury::pill(parent, x, y, 56, 56, value);
    lv_obj_set_style_text_font(lv_obj_get_child(obj, 0), &bm_luxury_recipe, 0);
    lv_obj_set_style_text_letter_space(lv_obj_get_child(obj, 0), 0, 0);
    bind(obj, intent);
    return obj;
}

void WorkingScreen::buildFrame(lv_obj_t *root) {
    content = ui::box(root);
    lv_obj_set_size(content, 480, 480);
    modeLabel = luxury::label(content, 0, 64, &bm_luxury_detail, "", 300, 3);
    title = luxury::label(content, 0, 104, &bm_luxury_recipe, "", 300);
    lv_obj_set_height(title, 26);
    menu = luxury::modesButton(content);
    bind(menu, Intent::Menu);
    lv_obj_add_event_cb(root, [](lv_event_t *e) {
        auto *screen = static_cast<WorkingScreen *>(lv_event_get_user_data(e));
        auto *input = lv_indev_get_act();
        if (input == nullptr)
            return;
        // A swipe never ends as a tap on whatever lies under the finger, even when it may not navigate.
        lv_indev_wait_release(input);
        if (screen->modeNavigationEnabled && !screen->processActive && lv_indev_get_gesture_dir(input) == LV_DIR_TOP)
            screen->host.act(Intent::Menu);
    }, LV_EVENT_GESTURE, this);
}

void WorkingScreen::onShow(const UiState &state) {
    update(state);
}

void WorkingScreen::updateFrame(const UiState &s, bool allowModeNavigation, bool showStopCaption) {
    const auto p = luxury::palette();
    processActive = s.active || s.grindActive;
    modeNavigationEnabled = allowModeNavigation;
    ui::setVisible(menu, allowModeNavigation);
    luxury::updateModesButton(menu, processActive, showStopCaption);
    luxury::background(root(), p.background);
    luxury::color(modeLabel, p.faint);
    luxury::color(title, p.ink);
}

} // namespace bm
