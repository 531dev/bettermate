#include "Screen.h"

#include <cstdio>

namespace bm {

void Screen::enter(const UiState &state) {
    if (root == nullptr) {
        root = ui::root();
        partCount = 0;
        bindingCount = 0;
        warningSlot = updateSlot = nullptr;
        // Nothing built here is on the glass before its rank is revealed, so nothing it marks for repainting on
        // the way is wanted. And it does mark: a new label is visible, at the stage's origin, without a size but
        // with the margin LVGL keeps around a label for overhanging glyphs (a quarter of its line height). Each
        // style set on it before part() hides it invalidates that margin and LVGL's own 5 px: 11 x 11 px at 0, 0
        // in the screen's first frame. So the parts are built with invalidation off. What is already on the
        // glass is laid out first, so a layout pass during the build (ui::chip measures itself) has nothing
        // visible left to move unseen.
        lv_obj_update_layout(root);
        lv_disp_t *display = lv_obj_get_disp(root);
        lv_disp_enable_invalidation(display, false);
        const uint32_t before = lv_obj_get_child_cnt(root);
        build(root);
        // Anything left on the root unregistered would stay on the glass for ever; make it a part.
        for (uint32_t i = before; i < lv_obj_get_child_cnt(root); ++i) {
            lv_obj_t *child = lv_obj_get_child(root, i);
            bool known = false;
            for (unsigned k = 0; k < partCount && !known; ++k)
                known = parts[k].obj == child;
            if (!known)
                part(child, 1);
        }
        lv_disp_enable_invalidation(display, true);
        // Lay the parts out while they are hidden, so the first reveal repaints each one once, in place.
        lv_obj_update_layout(root);
    }
    revealed = 0;
    for (unsigned i = 0; i < partCount; ++i) {
        parts[i].wanted = true;
        ui::show(parts[i].obj, false);
    }
    onEnter(state);
    update(state);
}

void Screen::reveal(unsigned rank) {
    revealed = rank + 1;
    for (unsigned i = 0; i < partCount; ++i) {
        const Part &p = parts[i];
        // Only the reading steps in; everything else arrives with the cut.
        if (p.rank == rank && p.wanted)
            ui::show(p.obj, true, ui::isReading(p.obj));
    }
}

void Screen::conceal(unsigned rank) {
    for (unsigned i = 0; i < partCount; ++i) {
        if (parts[i].rank == rank)
            ui::show(parts[i].obj, false);
    }
    if (rank >= 2)
        revealed = 0;
}

unsigned Screen::rankArea(unsigned rank, bool entering) const {
    unsigned area = 0;
    for (unsigned i = 0; i < partCount; ++i) {
        const Part &p = parts[i];
        if (p.rank == rank && (entering ? p.wanted : ui::shown(p.obj)))
            area += static_cast<unsigned>(lv_obj_get_width(p.obj)) * lv_obj_get_height(p.obj);
    }
    return area;
}

unsigned Screen::steppingArea() const {
    unsigned area = 0;
    for (unsigned i = 0; i < partCount; ++i) {
        const Part &p = parts[i];
        if (p.rank < revealed && p.wanted && ui::isReading(p.obj))
            area += static_cast<unsigned>(lv_obj_get_width(p.obj)) * lv_obj_get_height(p.obj);
    }
    return area;
}

void Screen::destroy() {
    for (unsigned i = 0; i < partCount; ++i)
        lv_obj_del(parts[i].obj);
    root = nullptr;
    partCount = 0;
    bindingCount = 0;
    revealed = 0;
}

lv_obj_t *Screen::part(lv_obj_t *obj, unsigned rank) {
    LV_ASSERT(partCount < sizeof(parts) / sizeof(parts[0]));
    parts[partCount++] = {obj, static_cast<uint8_t>(rank), true};
    // Hidden before it is first laid out, so building a screen repaints nothing.
    lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    return obj;
}

void Screen::show(lv_obj_t *obj, bool wanted) {
    for (unsigned i = 0; i < partCount; ++i) {
        Part &p = parts[i];
        if (p.obj != obj)
            continue;
        p.wanted = wanted;
        if (p.rank < revealed)
            ui::show(obj, wanted);
        return;
    }
    // Not a ranked part (a child of one): it follows its own flag at once.
    ui::show(obj, wanted);
}

void Screen::bind(lv_obj_t *obj, Intent intent, lv_event_code_t event) {
    LV_ASSERT(bindingCount < sizeof(bindings) / sizeof(bindings[0]));
    Binding &binding = bindings[bindingCount++];
    binding = {&host, intent};
    lv_obj_add_event_cb(
        obj,
        [](lv_event_t *e) {
            const auto *b = static_cast<Binding *>(lv_event_get_user_data(e));
            b->host->act(b->intent);
        },
        event, &binding);
}

lv_obj_t *Screen::addHandle() {
    lv_obj_t *handle = ui::disc(root, 240, 446, tokens::DISPLAY_TOUCH / 2, &bm_icon_chevron_up_32, Tone::Surface0, Tone::Muted);
    bind(handle, Intent::Menu);
    return part(handle, 2);
}

void Screen::addException(int y) {
    // The single ring has no gap at 12 o'clock, so the glyph's ground is kept as small as the glyph: it hides
    // two or three ticks, not seven. The touch target is still 56 px.
    constexpr int RADIUS = 20;
    const auto slot = [this, y](const lv_img_dsc_t *glyph, Tone ink, Intent intent) {
        lv_obj_t *obj = ui::disc(root, 240, y, RADIUS, glyph, Tone::Surface0, ink);
        lv_obj_set_ext_click_area(obj, tokens::DISPLAY_TOUCH / 2 - RADIUS);
        bind(obj, intent);
        return part(obj, 0);
    };
    warningSlot = slot(&bm_icon_triangle_alert_28, Tone::Warning, Intent::Warnings);
    updateSlot = slot(&bm_icon_download_28, Tone::Muted, Intent::Info);
}

void Screen::updateException(const UiState &state, bool awayFromBrew, bool running) {
    if (warningSlot == nullptr)
        return;
    const bool warning = !running && anyWarning(state, awayFromBrew);
    show(warningSlot, warning);
    show(updateSlot, !warning && !running && state.updateAvailable);
}

bool anyWarning(const UiState &s, bool awayFromBrew) {
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        if (i == WARNING_TEMPERATURE || (awayFromBrew && i == WARNING_FLUSH))
            continue;
        if (s.warn[i] || s.error[i])
            return true;
    }
    return false;
}

bool anyError(const UiState &s, bool awayFromBrew) {
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        if (i == WARNING_TEMPERATURE || (awayFromBrew && i == WARNING_FLUSH))
            continue;
        if (s.error[i])
            return true;
    }
    return false;
}

const char *warningName(WarningType type) {
    switch (type) {
    case WARNING_WATER:
        return "Water low";
    case WARNING_FLUSH:
        return "Flush recommended";
    case WARNING_SWITCH:
        return "Steam switch on";
    case WARNING_SCALE_CONNECTED:
        return "Scale disconnected";
    case WARNING_SCALE_BATTERY:
        return "Scale battery low";
    case WARNING_TEMPERATURE:
        return "Temperature unstable";
    default:
        return "Machine warning";
    }
}

void formatTime(unsigned long ms, char *buf, size_t size) { snprintf(buf, size, "%lu:%02lu", ms / 60000, ms / 1000 % 60); }

void upper(char *s) {
    for (auto *c = reinterpret_cast<unsigned char *>(s); *c != 0; ++c) {
        if (*c >= 'a' && *c <= 'z') {
            *c = static_cast<unsigned char>(*c - 32);
        } else if (*c == 0xC3 && c[1] >= 0xA0 && c[1] <= 0xBE && c[1] != 0xB7) {
            // Latin-1 lowercase a-grave to thorn sit 0x20 above their capitals; the division sign has none.
            c[1] = static_cast<unsigned char>(c[1] - 0x20);
            ++c;
        }
    }
}

} // namespace bm
