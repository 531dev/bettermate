#include "Ui.h"

#include <cstring>

namespace bm::ui {

// Each object remembers which color roles it carries (in its user data) so a role can be swapped later:
// low byte foreground, next byte fill, each stored +1 so that zero means "none".
static uintptr_t roles(lv_obj_t *obj) { return reinterpret_cast<uintptr_t>(lv_obj_get_user_data(obj)); }
static void setRoles(lv_obj_t *obj, uintptr_t value) { lv_obj_set_user_data(obj, reinterpret_cast<void *>(value)); }

static lv_obj_t *bare(lv_obj_t *obj) {
    lv_obj_remove_style_all(obj);
    setRoles(obj, 0);
    return obj;
}

lv_obj_t *screen() {
    lv_obj_t *obj = bare(lv_obj_create(nullptr));
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_style(obj, theme().type(Type::Body), 0);
    setBg(obj, Bg::Surface0);
    setFg(obj, Fg::Ink);
    return obj;
}

lv_obj_t *box(lv_obj_t *parent) {
    lv_obj_t *obj = bare(lv_obj_create(parent));
    lv_obj_set_size(obj, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    return obj;
}

static lv_obj_t *flex(lv_obj_t *parent, lv_flex_flow_t flow, lv_coord_t gap, lv_flex_align_t cross) {
    lv_obj_t *obj = box(parent);
    lv_obj_set_layout(obj, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(obj, flow);
    lv_obj_set_flex_align(obj, LV_FLEX_ALIGN_START, cross, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(obj, gap, 0);
    lv_obj_set_style_pad_column(obj, gap, 0);
    return obj;
}

lv_obj_t *column(lv_obj_t *parent, lv_coord_t gap) { return flex(parent, LV_FLEX_FLOW_COLUMN, gap, LV_FLEX_ALIGN_CENTER); }

lv_obj_t *row(lv_obj_t *parent, lv_coord_t gap, lv_flex_align_t cross) { return flex(parent, LV_FLEX_FLOW_ROW, gap, cross); }

lv_obj_t *label(lv_obj_t *parent, Type type, Fg color, const char *text) {
    lv_obj_t *obj = bare(lv_label_create(parent));
    lv_obj_add_style(obj, theme().type(type), 0);
    setFg(obj, color);
    lv_label_set_text(obj, text);
    return obj;
}

lv_obj_t *icon(lv_obj_t *parent, const lv_img_dsc_t *glyph, Fg color) {
    lv_obj_t *obj = bare(lv_img_create(parent));
    setFg(obj, color);
    lv_img_set_src(obj, glyph);
    return obj;
}

lv_obj_t *fill(lv_obj_t *parent, Bg color, lv_coord_t radius) {
    lv_obj_t *obj = box(parent);
    lv_obj_set_style_radius(obj, radius, 0);
    setBg(obj, color);
    return obj;
}

void setText(lv_obj_t *label, const char *text) {
    if (strcmp(lv_label_get_text(label), text) != 0)
        lv_label_set_text(label, text);
}

void setIcon(lv_obj_t *icon, const lv_img_dsc_t *glyph) {
    if (lv_img_get_src(icon) != glyph)
        lv_img_set_src(icon, glyph);
}

void setFg(lv_obj_t *obj, Fg color) {
    const uintptr_t current = roles(obj);
    const uintptr_t wanted = static_cast<uintptr_t>(color) + 1;
    if ((current & 0xff) == wanted)
        return;
    if (current & 0xff)
        lv_obj_remove_style(obj, theme().fg(static_cast<Fg>((current & 0xff) - 1)), 0);
    lv_obj_add_style(obj, theme().fg(color), 0);
    setRoles(obj, (current & ~static_cast<uintptr_t>(0xff)) | wanted);
}

void setBg(lv_obj_t *obj, Bg color) {
    const uintptr_t current = roles(obj);
    const uintptr_t wanted = static_cast<uintptr_t>(color) + 1;
    if (((current >> 8) & 0xff) == wanted)
        return;
    if ((current >> 8) & 0xff)
        lv_obj_remove_style(obj, theme().bg(static_cast<Bg>(((current >> 8) & 0xff) - 1)), 0);
    lv_obj_add_style(obj, theme().bg(color), 0);
    setRoles(obj, (current & ~static_cast<uintptr_t>(0xff00)) | (wanted << 8));
}

void setVisible(lv_obj_t *obj, bool visible) {
    if (lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN) == visible) {
        if (visible)
            lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
        else
            lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    }
}

Badge badge(lv_obj_t *parent) {
    Badge b;
    b.root = fill(parent, Bg::Surface1, tokens::RADIUS_SM);
    lv_obj_set_style_pad_hor(b.root, tokens::SPACE_2 + 2, 0);
    lv_obj_set_style_pad_ver(b.root, tokens::SPACE_1, 0);
    b.text = label(b.root, Type::Label, Fg::Ink);
    return b;
}

void setBadge(const Badge &badge, Tone tone, const char *text) {
    // The neutral badge sits on surface-1: the screen itself is surface-0, where the web's ground would vanish.
    static const struct {
        Bg ground;
        Fg word;
    } TONES[] = {
        {Bg::Surface1, Fg::Ink},        // Neutral
        {Bg::SuccessSoft, Fg::Success}, // Ready
        {Bg::HeatSoft, Fg::Heat},       // Heating
        {Bg::PrimarySoft, Fg::Primary}, // Brewing
        {Bg::WarningSoft, Fg::Warning}, // Warning
        {Bg::DangerSoft, Fg::Danger},   // Danger
    };
    const auto &t = TONES[static_cast<size_t>(tone)];
    setBg(badge.root, t.ground);
    setFg(badge.text, t.word);
    setText(badge.text, text);
}

} // namespace bm::ui
