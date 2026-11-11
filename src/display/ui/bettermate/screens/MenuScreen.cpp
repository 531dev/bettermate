#include "MenuScreen.h"

#include <algorithm>
#include <cstdlib>
#include <display/core/constants.h>
#include <display/ui/bettermate/LuxuryUI.h>

namespace bm {
namespace {
constexpr int MODE_COUNT = 5;
constexpr int PAGE_WIDTH = 480;
constexpr int ROW_HEIGHT = 78;
constexpr int PICKER_HEIGHT = 320;
constexpr int PICKER_BOTTOM_PAD = 60;
constexpr int PICKER_CENTER = (PICKER_HEIGHT - PICKER_BOTTOM_PAD) / 2;
constexpr int FIRST_ROW_Y = PICKER_CENTER - ROW_HEIGHT / 2;
const char *const MODE_NAMES[] = {"Brew", "Grind", "Steam", "Water", "Info"};
const Intent MODE_INTENTS[] = {Intent::BrewMode, Intent::GrindMode, Intent::SteamMode, Intent::WaterMode, Intent::Info};
const WarningType WARNING_ORDER[] = {WARNING_WATER, WARNING_SWITCH, WARNING_SCALE_CONNECTED,
                                    WARNING_SCALE_BATTERY, WARNING_FLUSH, WARNING_TEMPERATURE};
} // namespace

void MenuScreen::build(lv_obj_t *root) {
    // The two pages track horizontal drags, then ease into the nearest page.
    pages = ui::box(root);
    lv_obj_set_size(pages, PAGE_WIDTH, 480);
    lv_obj_set_style_anim_time(pages, 300, 0);
    lv_obj_add_flag(pages, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(pages, LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_CHAIN | LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_set_scroll_dir(pages, LV_DIR_HOR);
    lv_obj_set_scroll_snap_x(pages, LV_SCROLL_SNAP_CENTER);
    lv_obj_set_scrollbar_mode(pages, LV_SCROLLBAR_MODE_OFF);

    content = ui::box(pages);
    lv_obj_set_size(content, 480, 480);

    // Only exceptions appear at 12 o'clock: a warning dot opens the warnings page, Wi-Fi loss and an
    // available update open Information.
    indicators.build(content);
    for (auto *obj : {indicators.warning, indicators.wifi, indicators.update_})
        lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(indicators.warning, [](lv_event_t *e) {
        auto *screen = static_cast<MenuScreen *>(lv_event_get_user_data(e));
        lv_obj_scroll_to_x(screen->pages, PAGE_WIDTH, LV_ANIM_ON);
    }, LV_EVENT_SHORT_CLICKED, this);
    bind(indicators.wifi, Intent::Info);
    bind(indicators.update_, Intent::Info);

    // Native scrolling follows the finger, coasts and snaps a row into focus.
    // Browsing never changes the machine's mode.
    picker = ui::box(content);
    lv_obj_set_size(picker, 480, PICKER_HEIGHT);
    lv_obj_set_pos(picker, 0, 86);
    lv_obj_set_style_pad_bottom(picker, PICKER_BOTTOM_PAD, 0);
    lv_obj_set_style_anim_time(picker, 300, 0);
    lv_obj_add_flag(picker, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(picker, LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_add_flag(picker, LV_OBJ_FLAG_SCROLL_CHAIN_HOR);
    lv_obj_set_scroll_dir(picker, LV_DIR_VER);
    lv_obj_set_scroll_snap_y(picker, LV_SCROLL_SNAP_CENTER);
    lv_obj_set_scrollbar_mode(picker, LV_SCROLLBAR_MODE_OFF);
    for (int i = 0; i < MODE_COUNT; ++i) {
        modes[i] = luxury::control(picker, 240, 0, 400, ROW_HEIGHT);
        lv_obj_add_flag(modes[i], LV_OBJ_FLAG_SNAPPABLE);
        lv_obj_set_style_bg_opa(modes[i], LV_OPA_TRANSP, LV_STATE_PRESSED);
        modeLabels[i] = luxury::label(modes[i], 0, 0, &bm_luxury_picker, MODE_NAMES[i], 340);
        lv_label_set_long_mode(modeLabels[i], LV_LABEL_LONG_CLIP);
        lv_obj_center(modeLabels[i]);
        lv_obj_set_style_transform_pivot_x(modeLabels[i], 170, 0);
        lv_obj_set_style_transform_pivot_y(modeLabels[i], 36, 0);
        lv_obj_set_user_data(modes[i], reinterpret_cast<void *>(static_cast<uintptr_t>(i)));
        lv_obj_add_event_cb(modes[i], [](lv_event_t *e) {
            auto *screen = static_cast<MenuScreen *>(lv_event_get_user_data(e));
            screen->enter(static_cast<int>(reinterpret_cast<uintptr_t>(lv_obj_get_user_data(lv_event_get_target(e)))));
        }, LV_EVENT_SHORT_CLICKED, this);
    }
    endSpace = ui::box(picker);
    lv_obj_set_size(endSpace, 1, 1);
    lv_obj_clear_flag(endSpace, LV_OBJ_FLAG_SNAPPABLE);
    lv_obj_add_event_cb(picker, [](lv_event_t *e) {
        static_cast<MenuScreen *>(lv_event_get_user_data(e))->renderPicker();
    }, LV_EVENT_SCROLL, this);

    standby = luxury::power(content, 240, 442);
    lv_obj_set_style_border_width(standby, 0, 0);
    bind(standby, Intent::Standby);

    // A separate page owns warning input; vertical drags cannot reach the mode picker.
    overlay = ui::box(pages);
    lv_obj_set_size(overlay, 480, 480);
    lv_obj_set_x(overlay, PAGE_WIDTH);
    lv_obj_add_flag(overlay, LV_OBJ_FLAG_CLICKABLE);
    for (auto *surface : {pages, picker}) {
        // A swipe at a page/list boundary must not become a button tap.
        lv_obj_add_event_cb(surface, [](lv_event_t *) {
            if (auto *input = lv_indev_get_act())
                lv_indev_wait_release(input);
        }, LV_EVENT_GESTURE, nullptr);
    }
    warningHeading = luxury::label(overlay, 0, 66, &bm_luxury_mode, "Warnings", 340);
    warningSubtitle = luxury::label(overlay, 0, 111, &bm_luxury_detail, "BEFORE YOUR NEXT SHOT", 300, 1);
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        warningRows[i] = luxury::label(overlay, -32, 152 + i * 32, &bm_luxury_body, "", 260);
        lv_obj_set_style_text_align(warningRows[i], LV_TEXT_ALIGN_LEFT, 0);
        warningSeverities[i] = luxury::label(overlay, 134, 155 + i * 32, &bm_luxury_detail, "", 68);
    }
    // The same upward control as every other page leaves the warnings.
    closeButton = luxury::modesButton(overlay);
    closeLabel = nullptr;
    lv_obj_add_event_cb(closeButton, [](lv_event_t *e) {
        auto *screen = static_cast<MenuScreen *>(lv_event_get_user_data(e));
        lv_obj_scroll_to_x(screen->pages, 0, LV_ANIM_ON);
    }, LV_EVENT_SHORT_CLICKED, this);
}

void MenuScreen::onShow(const UiState &state) {
    selected = state.mode == MODE_GRIND ? 1 : state.mode == MODE_STEAM ? 2 : state.mode == MODE_WATER ? 3 : 0;
    grindAvailable = state.grindAvailable;
    lv_obj_update_layout(pages);
    lv_obj_scroll_to_x(pages, 0, LV_ANIM_OFF);
    layoutPicker();
    {
        luxury::Instant now;
        update(state);
    }
    // Arriving from another page's warning dot: slide straight to the warnings.
    if (state.openWarnings)
        lv_obj_scroll_to_x(pages, PAGE_WIDTH, LV_ANIM_ON);
}

void MenuScreen::layoutPicker() {
    if (selected == 1 && !grindAvailable)
        selected = 0;
    int count = 0;
    for (int i = 0; i < MODE_COUNT; ++i) {
        const bool visible = i != 1 || grindAvailable;
        ui::setVisible(modes[i], visible);
        positions[i] = visible ? count++ * ROW_HEIGHT : -1;
        if (visible)
            lv_obj_set_y(modes[i], FIRST_ROW_Y + positions[i]);
    }
    lv_obj_set_y(endSpace, PICKER_HEIGHT - PICKER_BOTTOM_PAD + (count - 1) * ROW_HEIGHT - 1);
    lv_obj_update_layout(picker);
    lv_obj_scroll_to_y(picker, positions[selected], LV_ANIM_OFF);
    renderPicker();
}

void MenuScreen::renderPicker() {
    const auto p = luxury::palette();
    const int scroll = lv_obj_get_scroll_y(picker);
    int closest = PICKER_HEIGHT;
    for (int i = 0; i < MODE_COUNT; ++i) {
        if (positions[i] < 0)
            continue;
        const int distance = std::abs(positions[i] - scroll);
        if (distance < closest) {
            closest = distance;
            selected = i;
        }
        // Scale and fade continuously, including momentum and snapping.
        const int near = std::min(distance, ROW_HEIGHT);
        const int far = std::min(std::max(distance - ROW_HEIGHT, 0), ROW_HEIGHT);
        const int zoom = 256 - near * 76 / ROW_HEIGHT - far * 48 / ROW_HEIGHT;
        const int opacity = distance < ROW_HEIGHT ? LV_OPA_COVER
                            : std::max(0, 255 - (distance - ROW_HEIGHT) * 80 / ROW_HEIGHT);
        if (lv_obj_get_style_transform_zoom(modeLabels[i], 0) != zoom)
            lv_obj_set_style_transform_zoom(modeLabels[i], zoom, 0);
        luxury::color(modeLabels[i], lv_color_mix(p.ink, p.muted, 255 - near * 255 / ROW_HEIGHT));
        luxury::opacity(modeLabels[i], opacity);
    }
}

void MenuScreen::enter(int index) {
    if (index < 0 || index >= MODE_COUNT || lv_obj_get_scroll_x(pages) != 0 || (index != 4 && !canEnter) ||
        (index == 1 && !grindAvailable))
        return;
    host.act(MODE_INTENTS[index]);
}

void MenuScreen::update(const UiState &s) {
    const auto p = luxury::palette();
    canEnter = s.canWake;
    if (grindAvailable != s.grindAvailable) {
        grindAvailable = s.grindAvailable;
        layoutPicker();
    }
    luxury::background(root(), p.background);
    luxury::background(overlay, p.background);
    indicators.update(s);
    // Rows keep their place in the picker; only their input follows the wake guard.
    for (int i = 0; i < MODE_COUNT; ++i) {
        if (i == 4 || s.canWake)
            lv_obj_clear_state(modes[i], LV_STATE_DISABLED);
        else
            lv_obj_add_state(modes[i], LV_STATE_DISABLED);
    }
    renderPicker();

    int count = 0;
    for (int severity = 1; severity >= 0; --severity) {
        for (auto type : WARNING_ORDER) {
            if (!(severity ? s.error[type] : s.warn[type]))
                continue;
            ui::setText(warningRows[type], luxury::warningName(type));
            ui::setText(warningSeverities[type], severity ? "ERROR" : "WARN");
            luxury::color(warningRows[type], severity ? p.danger : p.warning);
            luxury::color(warningSeverities[type], severity ? p.danger : p.warning);
            lv_obj_set_y(warningRows[type], 196 + count * 32);
            lv_obj_set_y(warningSeverities[type], 199 + count * 32);
            ++count;
        }
    }
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        ui::setVisible(warningRows[i], s.warn[i] || s.error[i]);
        ui::setVisible(warningSeverities[i], s.warn[i] || s.error[i]);
    }
    ui::setText(warningHeading, count ? "Warnings" : "All clear");
    // The page balances on the centre: a heading over its list, or the all-clear alone.
    lv_obj_set_y(warningHeading, count ? 112 : 200);
    lv_obj_set_y(warningSubtitle, 156);
    luxury::color(warningHeading, p.ink);
    luxury::color(warningSubtitle, p.muted);
    ui::setVisible(warningSubtitle, count > 0);
    luxury::updateModesButton(closeButton);
}
} // namespace bm
