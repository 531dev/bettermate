#include "ProfileScreen.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>

namespace bm {
namespace {
constexpr int PAGE_WIDTH = 400;
constexpr int PICKER_HEIGHT = 224;
constexpr int PICKER_Y = 98;
constexpr int DOTS_Y = 304;

// "93° · 18 → 36 g · 28 s": parts that a recipe does not define are left out rather than dashed.
std::string recipeLine(const UiState::ProfilePreview::Entry &entry) {
    char part[48];
    std::string line;
    const auto add = [&line](const char *text) {
        if (!line.empty())
            line += " · ";
        line += text;
    };
    snprintf(part, sizeof(part), "%.0f°", entry.temperature);
    add(part);
    if (entry.volumetric && entry.dose > 0)
        snprintf(part, sizeof(part), "%.3g → %.3g g", entry.dose, entry.weight);
    else if (entry.volumetric)
        snprintf(part, sizeof(part), "%.3g g", entry.weight);
    else if (entry.dose > 0)
        snprintf(part, sizeof(part), "%.3g g in", entry.dose);
    else
        part[0] = '\0';
    if (part[0])
        add(part);
    snprintf(part, sizeof(part), "%.3g s", entry.duration);
    add(part);
    return line;
}

const char *number(float value, char *buf, size_t size) {
    snprintf(buf, size, std::fabs(value - std::round(value)) < 0.05f ? "%.0f" : "%.1f", value);
    return buf;
}
} // namespace

void ProfileScreen::build(lv_obj_t *root) {
    browse = ui::box(root);
    lv_obj_set_size(browse, 480, 480);
    lv_obj_add_flag(browse, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(browse, LV_OBJ_FLAG_GESTURE_BUBBLE);
    position = luxury::label(browse, 0, 62, &bm_luxury_detail, "PROFILES", 300, 3);
    picker = ui::box(browse);
    lv_obj_set_size(picker, PAGE_WIDTH, PICKER_HEIGHT);
    lv_obj_set_pos(picker, 40, PICKER_Y);
    lv_obj_set_style_anim_time(picker, 300, 0);
    lv_obj_add_flag(picker, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_clear_flag(picker, LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_CHAIN | LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_set_scroll_dir(picker, LV_DIR_HOR);
    lv_obj_set_scroll_snap_x(picker, LV_SCROLL_SNAP_CENTER);
    lv_obj_set_scrollbar_mode(picker, LV_SCROLLBAR_MODE_OFF);
    lv_obj_add_event_cb(picker, [](lv_event_t *e) {
        static_cast<ProfileScreen *>(lv_event_get_user_data(e))->renderPicker();
    }, LV_EVENT_SCROLL, this);
    // Unsupported swipes and swipes at a list boundary must not select a card.
    lv_obj_add_event_cb(picker, [](lv_event_t *) {
        if (auto *input = lv_indev_get_act())
            lv_indev_wait_release(input);
    }, LV_EVENT_GESTURE, this);
    for (auto *&dot : dots) {
        dot = ui::box(browse);
        lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, 0);
    }
    edit = luxury::pill(browse, 240, 392, 136, 56, "EDIT");
    lv_obj_add_event_cb(edit, [](lv_event_t *e) {
        static_cast<ProfileScreen *>(lv_event_get_user_data(e))->choose(Intent::Adjust);
    }, LV_EVENT_SHORT_CLICKED, this);
    menu = luxury::modesButton(browse);
    bind(menu, Intent::Menu);
    buildAdjust(root);
}

void ProfileScreen::buildAdjust(lv_obj_t *root) {
    adjust = ui::box(root);
    lv_obj_set_size(adjust, 480, 480);
    adjustTitle = luxury::label(adjust, 0, 60, &bm_luxury_detail, "ADJUST", 300, 2);
    adjustName = luxury::label(adjust, 0, 84, &bm_luxury_recipe, "", 300);
    focusCaption = luxury::label(adjust, 0, 116, &bm_luxury_detail, "", 240, 1);
    focusValue = luxury::label(adjust, 0, 138, &bm_luxury_reading, "", 220);
    focusUnit = luxury::label(adjust, 0, 222, &bm_luxury_detail, "", 120, 1);
    focusReadout.attach(focusValue, 0);
    minus = luxury::pill(adjust, 96, 182, 56, 56, "–");
    plus = luxury::pill(adjust, 384, 182, 56, 56, "+");
    for (auto *obj : {minus, plus}) {
        lv_obj_set_style_text_font(lv_obj_get_child(obj, 0), &bm_luxury_recipe, 0);
        lv_obj_set_style_text_letter_space(lv_obj_get_child(obj, 0), 0, 0);
        lv_obj_add_event_cb(obj, [](lv_event_t *e) {
            auto *screen = static_cast<ProfileScreen *>(lv_event_get_user_data(e));
            screen->step(lv_event_get_target(e) == screen->plus);
        }, LV_EVENT_SHORT_CLICKED, this);
    }
    useTime = luxury::textButton(adjust, 240, 266, 140, "USE TIME");
    bind(useTime, Intent::DeleteWeight);
    for (int i = 0; i < 2; ++i) {
        slots[i] = luxury::control(adjust, 240, 322, 140, 56);
        slotValues[i] = luxury::label(slots[i], 0, 6, &bm_luxury_recipe, "", 136);
        slotCaptions[i] = luxury::label(slots[i], 0, 33, &bm_luxury_detail, "", 136, 1);
        lv_obj_add_event_cb(slots[i], [](lv_event_t *e) {
            auto *screen = static_cast<ProfileScreen *>(lv_event_get_user_data(e));
            screen->tapField(lv_event_get_target(e) == screen->slots[1] ? 1 : 0);
        }, LV_EVENT_SHORT_CLICKED, this);
    }
    save = luxury::pill(adjust, 240, 392, 136, 56, "SAVE");
    lv_obj_add_event_cb(save, [](lv_event_t *e) {
        auto *screen = static_cast<ProfileScreen *>(lv_event_get_user_data(e));
        screen->sheetOpen = true;
        screen->host.act(Intent::Refresh);
    }, LV_EVENT_SHORT_CLICKED, this);
    back = luxury::modesButton(adjust);
    bind(back, Intent::CancelAdjust);

    // Saving asks once how: to the profile, as a new profile, or for this session only.
    sheet = ui::box(adjust);
    lv_obj_set_size(sheet, 480, 480);
    lv_obj_add_flag(sheet, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(sheet, LV_OBJ_FLAG_GESTURE_BUBBLE);
    luxury::label(sheet, 0, 118, &bm_luxury_mode, "Save changes", 300);
    sheetSave = luxury::pill(sheet, 240, 222, 152, 56, "SAVE");
    sheetCopy = luxury::textButton(sheet, 240, 290, 200, "SAVE AS NEW");
    sheetOnce = luxury::textButton(sheet, 240, 346, 200, "USE ONCE");
    bind(sheetSave, Intent::Save);
    bind(sheetCopy, Intent::SaveAsNew);
    bind(sheetOnce, Intent::Accept);
    sheetBack = luxury::modesButton(sheet);
    lv_obj_add_event_cb(sheetBack, [](lv_event_t *e) {
        auto *screen = static_cast<ProfileScreen *>(lv_event_get_user_data(e));
        screen->sheetOpen = false;
        screen->host.act(Intent::Refresh);
    }, LV_EVENT_SHORT_CLICKED, this);
}

void ProfileScreen::onShow(const UiState &state) {
    selectionPending = false;
    sheetOpen = false;
    syncPicker(state.preview, true);
    luxury::Instant now;
    update(state);
}

void ProfileScreen::syncPicker(const UiState::ProfilePreview &preview, bool reset) {
    bool changed = names.size() != preview.entries.size();
    for (unsigned i = 0; !changed && i < names.size(); ++i)
        changed = names[i] != preview.entries[i].name;
    syncingPicker = changed || reset;
    if (syncingPicker)
        lv_obj_scroll_to_x(picker, 0, LV_ANIM_OFF);
    if (changed) {
        lv_obj_clean(picker);
        rows.clear();
        names.clear();
        for (unsigned i = 0; i < preview.entries.size(); ++i) {
            names.push_back(preview.entries[i].name);
            auto *row = luxury::control(picker, i * PAGE_WIDTH + PAGE_WIDTH / 2, PICKER_HEIGHT / 2,
                                        PAGE_WIDTH, PICKER_HEIGHT);
            lv_obj_add_flag(row, LV_OBJ_FLAG_SNAPPABLE);
            lv_obj_set_style_radius(row, 20, 0);
            auto *label = luxury::label(row, 0, 72, &bm_luxury_profile, names[i].c_str(), 340);
            // The focused name, stages, and recipe form one scrolling group.
            auto *stages = luxury::label(row, 0, 126, &bm_luxury_body, "", 340);
            auto *details = luxury::label(row, 0, 158, &bm_luxury_label, "", 340, 1);
            lv_obj_set_style_transform_pivot_x(label, 170, 0);
            lv_obj_set_style_transform_pivot_y(label, 26, 0);
            lv_obj_set_user_data(row, reinterpret_cast<void *>(static_cast<uintptr_t>(i)));
            lv_obj_add_event_cb(row, [](lv_event_t *e) {
                auto *screen = static_cast<ProfileScreen *>(lv_event_get_user_data(e));
                screen->selectProfile(static_cast<int>(reinterpret_cast<uintptr_t>(lv_obj_get_user_data(lv_event_get_target(e)))));
            }, LV_EVENT_SHORT_CLICKED, this);
            rows.push_back({label, stages, details});
        }
    }
    for (unsigned i = 0; i < rows.size(); ++i) {
        const auto &entry = preview.entries[i];
        ui::setText(rows[i].recipe, recipeLine(entry).c_str());
        ui::setText(rows[i].summary, entry.summary.c_str());
        ui::setVisible(rows[i].summary, !entry.summary.empty());
        // Without a stage list the recipe moves up beneath the name.
        lv_obj_set_y(rows[i].recipe, entry.summary.empty() ? 134 : 158);
    }
    if (syncingPicker) {
        focused = static_cast<int>(preview.index);
        lv_obj_update_layout(picker);
        lv_obj_scroll_to_x(picker, focused * PAGE_WIDTH, LV_ANIM_OFF);
        syncingPicker = false;
        renderPicker();
    } else if (preview.index != static_cast<unsigned>(focused))
        lv_obj_scroll_to_x(picker, preview.index * PAGE_WIDTH, LV_ANIM_ON);
}

void ProfileScreen::selectProfile(int index) {
    if (!canChoose || selectionPending || index < 0 || index >= static_cast<int>(names.size()))
        return;
    selectionPending = true;
    lv_obj_scroll_to_x(picker, index * PAGE_WIDTH, LV_ANIM_OFF);
    focused = index;
    host.focusProfile(index);
    host.act(Intent::SelectProfile);
}

void ProfileScreen::renderPicker() {
    if (syncingPicker || rows.empty())
        return;
    const auto p = luxury::palette();
    const int scroll = lv_obj_get_scroll_x(picker);
    const int closest = std::clamp((scroll + PAGE_WIDTH / 2) / PAGE_WIDTH, 0, static_cast<int>(rows.size()) - 1);
    if (closest != focused) {
        focused = closest;
        host.focusProfile(focused);
    }
    for (unsigned i = 0; i < rows.size(); ++i) {
        const auto &row = rows[i];
        const int distance = std::abs(static_cast<int>(i) * PAGE_WIDTH - scroll);
        const int near = std::min(distance, PAGE_WIDTH);
        const int zoom = 256 - near * 40 / PAGE_WIDTH;
        const int opacity = std::max(0, 255 - distance * 128 / PAGE_WIDTH);
        if (lv_obj_get_style_transform_zoom(row.name, 0) != zoom)
            lv_obj_set_style_transform_zoom(row.name, zoom, 0);
        luxury::color(row.name, lv_color_mix(p.ink, p.muted, 255 - near * 255 / PAGE_WIDTH));
        luxury::opacity(row.name, opacity);
        lv_label_set_long_mode(row.name, distance == 0 ? LV_LABEL_LONG_SCROLL_CIRCULAR : LV_LABEL_LONG_DOT);
        const int detailOpacity = std::max(0, 255 - distance * 255 / PAGE_WIDTH);
        for (auto *detail : {row.summary, row.recipe})
            luxury::opacity(detail, detailOpacity);
        luxury::color(row.summary, p.muted);
        luxury::color(row.recipe, p.accent);
    }
    const int count = std::min(7, static_cast<int>(rows.size()));
    const int first = std::clamp(focused - 3, 0, std::max(0, static_cast<int>(rows.size()) - count));
    for (int i = 0; i < 7; ++i) {
        ui::setVisible(dots[i], count > 1 && i < count);
        const bool active = first + i == focused;
        lv_obj_set_size(dots[i], active ? 6 : 4, active ? 6 : 4);
        lv_obj_set_pos(dots[i], 240 + (i * 16 - (count - 1) * 8) - (active ? 3 : 2), DOTS_Y - (active ? 3 : 2));
        luxury::background(dots[i], active ? p.accent : p.muted);
    }
}

void ProfileScreen::choose(Intent intent) {
    lv_obj_scroll_to_x(picker, focused * PAGE_WIDTH, LV_ANIM_OFF);
    renderPicker();
    host.act(intent);
}

bool ProfileScreen::available(Field field, const UiState &s) const {
    return field != Field::Pressure || (s.pressureAvailable && s.profilePressureEditable);
}

void ProfileScreen::focus(Field field) { focusField = field; }

void ProfileScreen::step(bool up) {
    switch (focusField) {
    case Field::Temperature:
        host.act(up ? Intent::TempUp : Intent::TempDown);
        break;
    case Field::Pressure:
        host.act(up ? Intent::PressureUp : Intent::PressureDown);
        break;
    case Field::Output:
        host.act(up ? Intent::TargetUp : Intent::TargetDown);
        break;
    }
}

void ProfileScreen::tapField(int slot) {
    const Field field = slotFields[slot];
    // A pump-power phase gains a pressure target on its first tap, then that value takes focus.
    if (field == Field::Pressure && !pressureSet)
        host.act(Intent::PressureUp);
    focus(field);
    host.act(Intent::Refresh);
}

void ProfileScreen::update(const UiState &s) {
    const auto p = luxury::palette();
    const auto &preview = s.preview;
    luxury::background(root(), p.background);
    ui::setVisible(browse, !s.adjusting);
    ui::setVisible(adjust, s.adjusting);
    if (!s.adjusting)
        syncPicker(preview);
    luxury::color(position, p.faint);
    luxury::updateModesButton(menu);
    renderPicker();
    const bool hasProfile = preview.index < preview.entries.size() && !preview.entries[preview.index].name.empty();
    canChoose = s.canWake && hasProfile && !s.adjusting;
    luxury::border(edit, p.muted);
    luxury::color(lv_obj_get_child(edit, 0), p.ink);
    luxury::enabled(edit, s.canWake && hasProfile);
    updateAdjust(s);
}

void ProfileScreen::updateAdjust(const UiState &s) {
    const auto p = luxury::palette();
    if (s.adjusting && !wasAdjusting) {
        focusField = Field::Temperature;
        sheetOpen = false;
    }
    wasAdjusting = s.adjusting;
    if (!s.adjusting)
        return;
    pressureSet = s.profilePressureSet;
    if (!available(focusField, s) || (focusField == Field::Pressure && !pressureSet))
        focusField = Field::Temperature;
    if (!s.profileDirty)
        sheetOpen = false;

    ui::setText(adjustTitle, s.profileDirty ? "UNSAVED" : "ADJUST");
    luxury::color(adjustTitle, s.profileDirty ? p.warning : p.faint);
    ui::setText(adjustName, s.profileName.c_str());
    luxury::color(adjustName, p.ink);

    const bool volume = s.profileVolumetric && s.volumetricAvailable;
    const auto caption = [&](Field field) {
        return field == Field::Temperature ? "TEMPERATURE"
               : field == Field::Pressure  ? "PRESSURE"
               : volume                    ? "OUTPUT"
                                           : "TIME";
    };
    const auto value = [&](Field field) {
        return field == Field::Temperature ? s.targetTemp
               : field == Field::Pressure  ? s.profilePressure
               : volume                    ? s.profileWeight
                                           : s.profileDuration;
    };
    // The focused value, large, with its unit underneath.
    if (shownField != focusField) {
        shownField = focusField;
        focusReadout.reset();
    }
    focusReadout.attach(focusValue, focusField == Field::Temperature ? 0 : 1);
    if (focusField == Field::Output && !volume)
        focusReadout.attach(focusValue, 0);
    focusReadout.set(value(focusField), luxury::MOTION_STATE);
    ui::setText(focusCaption, caption(focusField));
    ui::setText(focusUnit, focusField == Field::Temperature ? "°C"
                           : focusField == Field::Pressure  ? "bar"
                           : volume                         ? "g"
                                                            : "s");
    luxury::color(focusCaption, p.accent);
    luxury::color(focusValue, p.ink);
    luxury::color(focusUnit, p.muted);
    for (auto *obj : {minus, plus}) {
        luxury::border(obj, p.muted);
        luxury::color(lv_obj_get_child(obj, 0), p.ink);
        luxury::enabled(obj, s.canWake && !sheetOpen);
    }
    luxury::color(lv_obj_get_child(useTime, 0), p.accent);
    luxury::fade(useTime, focusField == Field::Output && volume && !sheetOpen);

    // The other values wait in a quiet row; a tap brings one into focus.
    int count = 0;
    for (Field field : {Field::Temperature, Field::Pressure, Field::Output}) {
        if (field == focusField || !available(field, s) || count >= 2)
            continue;
        slotFields[count++] = field;
    }
    char buf[32], num[16];
    for (int i = 0; i < 2; ++i) {
        const bool shown = i < count && !sheetOpen;
        luxury::fade(slots[i], shown);
        if (i >= count)
            continue;
        lv_obj_set_x(slots[i], (count == 2 ? (i == 0 ? 160 : 320) : 240) - 70);
        const Field field = slotFields[i];
        if (field == Field::Temperature)
            snprintf(buf, sizeof(buf), "%.0f°", s.targetTemp);
        else if (field == Field::Pressure)
            snprintf(buf, sizeof(buf), pressureSet ? "%.1f bar" : "Add", s.profilePressure);
        else
            snprintf(buf, sizeof(buf), "%s %s", number(value(field), num, sizeof(num)), volume ? "g" : "s");
        ui::setText(slotValues[i], buf);
        ui::setText(slotCaptions[i], caption(field));
        luxury::color(slotValues[i], field == Field::Pressure && !pressureSet ? p.accent : p.ink);
        luxury::color(slotCaptions[i], p.faint);
    }

    luxury::border(save, p.accent);
    luxury::color(lv_obj_get_child(save, 0), p.accent);
    luxury::fade(save, s.profileDirty && s.canWake && !sheetOpen);
    luxury::updateModesButton(back);
    ui::setVisible(back, !sheetOpen);

    // The sheet replaces the editor rather than covering it.
    for (auto *obj : {adjustTitle, adjustName, focusCaption, focusValue, focusUnit})
        ui::setVisible(obj, !sheetOpen);
    ui::setVisible(sheet, sheetOpen);
    luxury::background(sheet, p.background);
    luxury::color(lv_obj_get_child(sheet, 0), p.ink);
    luxury::border(sheetSave, p.accent);
    luxury::color(lv_obj_get_child(sheetSave, 0), p.accent);
    luxury::color(lv_obj_get_child(sheetCopy, 0), p.ink);
    luxury::color(lv_obj_get_child(sheetOnce, 0), p.muted);
    luxury::updateModesButton(sheetBack);
}
} // namespace bm
