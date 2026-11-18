#include "Ui.h"

#include <cstdio>
#include <cstring>
#include <display/ui/bettermate/Motion.h>

namespace bm::ui {
namespace {
constexpr int CENTRE = tokens::DISPLAY_SIZE / 2;

// Each part keeps its color roles and its step-in level in its user data, so a part can be recoloured, faded
// by recolour and pressed without any state of its own.
enum : uint8_t { HAS_FG = 1, HAS_BG = 2, IS_IMG = 4, CUSTOM = 8, PRESSED = 16, CLAMPED = 32 };
struct Look {
    Tone fg = Tone::Ink;
    Tone bg = Tone::Surface0;
    uint8_t level = 100;
    uint8_t flags = 0;
};

Look look(const lv_obj_t *obj) {
    const auto v = reinterpret_cast<uintptr_t>(lv_obj_get_user_data(const_cast<lv_obj_t *>(obj)));
    return {static_cast<Tone>(v & 0xff), static_cast<Tone>((v >> 8) & 0xff), static_cast<uint8_t>((v >> 16) & 0xff),
            static_cast<uint8_t>((v >> 24) & 0xff)};
}

void setLook(lv_obj_t *obj, const Look &l) {
    const uintptr_t v = static_cast<uintptr_t>(l.fg) | (static_cast<uintptr_t>(l.bg) << 8) |
                        (static_cast<uintptr_t>(l.level) << 16) | (static_cast<uintptr_t>(l.flags) << 24);
    lv_obj_set_user_data(obj, reinterpret_cast<void *>(v));
}

// While one of these is alive LVGL's own (padded) invalidation is off; the caller invalidates exactly.
struct Quiet {
    Quiet() : display(lv_disp_get_default()) { lv_disp_enable_invalidation(display, false); }
    ~Quiet() { lv_disp_enable_invalidation(display, true); }
    Quiet(const Quiet &) = delete;
    Quiet &operator=(const Quiet &) = delete;
    lv_disp_t *display;
};

// The setters skip unchanged values: in LVGL 8 every style set repaints the object.
void textColor(lv_obj_t *obj, lv_color_t c) {
    if (lv_obj_get_style_text_color(obj, 0).full == c.full)
        return;
    {
        Quiet quiet;
        lv_obj_set_style_text_color(obj, c, 0);
    }
    invalidate(obj);
}
void fillColor(lv_obj_t *obj, lv_color_t c) {
    if (lv_obj_get_style_bg_color(obj, 0).full == c.full)
        return;
    {
        Quiet quiet;
        lv_obj_set_style_bg_color(obj, c, 0);
    }
    invalidate(obj);
}
void glyphColor(lv_obj_t *obj, lv_color_t c) {
    if (lv_obj_get_style_img_recolor(obj, 0).full == c.full)
        return;
    {
        Quiet quiet;
        lv_obj_set_style_img_recolor(obj, c, 0);
    }
    invalidate(obj);
}

void paint(lv_obj_t *obj, Tone fg, Tone bg, uint8_t level, uint8_t flags) {
    if (flags & HAS_BG)
        fillColor(obj, tone(bg, level));
    if (flags & CUSTOM)
        invalidate(obj);
    else if (flags & HAS_FG)
        (flags & IS_IMG) ? glyphColor(obj, tone(fg, level)) : textColor(obj, tone(fg, level));
}

void apply(lv_obj_t *obj) {
    const Look l = look(obj);
    if (!(l.flags & PRESSED))
        paint(obj, l.fg, l.bg, l.level, l.flags);
}

// A part and whatever it carries (a disc's glyph, a card's text) fade as one.
void setLevel(lv_obj_t *obj, uint8_t level) {
    Look l = look(obj);
    if (l.flags != 0 && l.level != level) {
        l.level = level;
        setLook(obj, l);
        apply(obj);
    }
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i)
        setLevel(lv_obj_get_child(obj, i), level);
}

lv_obj_t *bare(lv_obj_t *obj) {
    lv_obj_remove_style_all(obj);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    setLook(obj, {});
    return obj;
}

Tone inkOn(Tone fill) { return fill == Tone::Primary ? Tone::OnPrimary : fill == Tone::Ink ? Tone::OnInk : Tone::Ink; }

lv_obj_t *label(lv_obj_t *parent, Type type, Tone fg, const char *str) {
    lv_obj_t *obj = bare(lv_label_create(parent));
    lv_obj_set_style_text_font(obj, font(type), 0);
    if (tracking(type) != 0)
        lv_obj_set_style_text_letter_space(obj, tracking(type), 0);
    lv_label_set_text(obj, str);
    setLook(obj, {fg, Tone::Surface0, 100, HAS_FG});
    apply(obj);
    return obj;
}

// A label that is also a filled, rounded box with its text on a set baseline: pills, chips, segments.
lv_obj_t *filled(lv_obj_t *parent, Type type, Tone fg, Tone fill, const char *str, int width, int height, int baseline,
                 int radius) {
    lv_obj_t *obj = label(parent, type, fg, str);
    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_size(obj, width, height);
    lv_obj_set_style_pad_top(obj, baseline - ascent(type), 0);
    lv_obj_set_style_radius(obj, radius, 0);
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
    setLook(obj, {fg, fill, 100, HAS_FG | HAS_BG});
    apply(obj);
    return obj;
}

// ---- step-ins and presses -----------------------------------------------------------------------------------

struct Step {
    lv_obj_t *obj;
    uint8_t at;
};
Step steps[24];
unsigned stepCount = 0;

struct Press {
    lv_obj_t *obj;
    uint8_t frames;
    bool released;
    bool held;
};
Press presses[4];
unsigned pressCount = 0;

void forgetStep(lv_obj_t *obj) {
    for (unsigned i = 0; i < stepCount; ++i) {
        if (steps[i].obj == obj) {
            steps[i] = steps[--stepCount];
            return;
        }
    }
}

void mark(lv_obj_t *obj, bool pressed) {
    Look l = look(obj);
    l.flags = pressed ? (l.flags | PRESSED) : (l.flags & ~PRESSED);
    setLook(obj, l);
}

void press(lv_obj_t *obj) {
    for (unsigned i = 0; i < pressCount; ++i) {
        if (presses[i].obj == obj) {
            presses[i].released = false;
            return;
        }
    }
    if (pressCount == sizeof(presses) / sizeof(presses[0]))
        return;
    presses[pressCount++] = {obj, 0, false, false};
    // Ink means "this one": a pressed part inverts to ink and on-ink, and an ink part to a disc.
    const Look l = look(obj);
    const Tone fill = l.bg == Tone::Ink ? Tone::Surface2 : Tone::Ink;
    const Tone ink = l.bg == Tone::Ink ? Tone::Ink : Tone::OnInk;
    paint(obj, ink, fill, 100, l.flags);
    mark(obj, true);
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i) {
        lv_obj_t *child = lv_obj_get_child(obj, i);
        const Look c = look(child);
        paint(child, ink, c.bg, 100, c.flags & ~HAS_BG);
        mark(child, true);
    }
}

void restore(lv_obj_t *obj) {
    mark(obj, false);
    apply(obj);
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(obj); ++i) {
        lv_obj_t *child = lv_obj_get_child(obj, i);
        mark(child, false);
        apply(child);
    }
}

void release(lv_obj_t *obj) {
    for (unsigned i = 0; i < pressCount; ++i) {
        if (presses[i].obj == obj)
            presses[i].released = true;
    }
}

void pressEvent(lv_event_t *e) {
    lv_obj_t *obj = lv_event_get_current_target(e);
    if (lv_event_get_code(e) == LV_EVENT_PRESSED)
        press(obj);
    else
        release(obj);
}
} // namespace

namespace fx {
void step() {
    for (unsigned i = 0; i < stepCount;) {
        Step &s = steps[i];
        if (++s.at >= motion::MICRO) {
            setLevel(s.obj, 100);
            steps[i] = steps[--stepCount];
        } else {
            setLevel(s.obj, motion::EASE3[s.at]);
            ++i;
        }
    }
    for (unsigned i = 0; i < pressCount;) {
        Press &p = presses[i];
        if (p.frames < 255)
            ++p.frames;
        if (p.released && p.frames >= 2 && (!p.held || !lv_obj_is_visible(p.obj))) {
            restore(p.obj);
            presses[i] = presses[--pressCount];
        } else {
            ++i;
        }
    }
}

void reset() {
    stepCount = 0;
    pressCount = 0;
}

void hold() {
    for (unsigned i = 0; i < pressCount; ++i)
        presses[i].held = true;
}
} // namespace fx

// ---- parts --------------------------------------------------------------------------------------------------

lv_obj_t *root() {
    static lv_obj_t *stage = nullptr;
    if (stage == nullptr) {
        lv_obj_t *screen = lv_scr_act();
        stage = bare(lv_obj_create(screen));
        lv_obj_set_size(stage, tokens::DISPLAY_SIZE, tokens::DISPLAY_SIZE);
        lv_obj_set_pos(stage, (lv_obj_get_width(screen) - tokens::DISPLAY_SIZE) / 2, (lv_obj_get_height(screen) - tokens::DISPLAY_SIZE) / 2);
    }
    return stage;
}

void paintFace() {
    lv_obj_t *screen = lv_scr_act();
    lv_obj_remove_style_all(screen);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(screen, tone(Tone::Surface0), 0);
}

lv_obj_t *text(lv_obj_t *parent, int cx, int baseline, Type type, Tone fg, const char *str, int width) {
    lv_obj_t *obj = label(parent, type, fg, str);
    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, 0);
    if (width > 0)
        lv_obj_set_width(obj, width);
    lv_obj_align(obj, LV_ALIGN_TOP_MID, cx - CENTRE, baseline - ascent(type));
    return obj;
}

lv_obj_t *textLeft(lv_obj_t *parent, int x, int baseline, Type type, Tone fg, const char *str, int width) {
    lv_obj_t *obj = label(parent, type, fg, str);
    if (width > 0)
        lv_obj_set_width(obj, width);
    lv_obj_set_pos(obj, x, baseline - ascent(type));
    return obj;
}

namespace {
bool hasGlyph(const lv_font_t *face, uint32_t letter) {
    lv_font_glyph_dsc_t glyph;
    return lv_font_get_glyph_dsc(face, &glyph, letter, 0);
}

// The base letters of Latin Extended-A (U+0100 to U+017F), in order. '?' marks the four ligatures, which
// become two letters.
constexpr char LATIN_A[] = "AaAaAaCcCcCcCcDd"
                           "DdEeEeEeEeEeGgGg"
                           "GgGgHhHhIiIiIiIi"
                           "Ii??JjKkkLlLlLlL"
                           "lLlNnNnNnnNnOoOo"
                           "Oo??RrRrRrSsSsSs"
                           "SsTtTtTtUuUuUuUu"
                           "UuUuWwYyYZzZzZzs";
static_assert(sizeof(LATIN_A) == 0x80 + 1, "one base letter for each code point of Latin Extended-A");

// What to draw for a letter the face lacks: its base letter, a plain quote or dash for typographic ones, or
// nothing.
const char *substitute(uint32_t letter, char *buf) {
    switch (letter) {
    case 0x132:
        return "IJ";
    case 0x133:
        return "ij";
    case 0x152:
        return "OE";
    case 0x153:
        return "oe";
    case 0x2018:
    case 0x2019:
    case 0x201A:
    case 0x2032:
        return "'";
    case 0x201C:
    case 0x201D:
    case 0x201E:
    case 0x2033:
        return "\"";
    case 0x2010:
    case 0x2011:
    case 0x2012:
    case 0x2013:
    case 0x2014:
    case 0x2212:
        return "-";
    default:
        break;
    }
    if (letter >= 0x100 && letter < 0x180) {
        buf[0] = LATIN_A[letter - 0x100];
        buf[1] = '\0';
        return buf;
    }
    return "";
}
} // namespace

void fold(const lv_font_t *face, const char *str, char *out, size_t size) {
    size_t length = 0;
    uint32_t next = 0;
    while (str[next] != '\0') {
        const uint32_t start = next;
        const uint32_t letter = _lv_txt_encoded_next(str, &next);
        const char *piece = str + start;
        size_t bytes = next - start;
        char buf[2];
        char upper[3];
        // ASCII is in every text face (the label and button faces as capitals, which their callers write).
        if (letter >= 0x80 && !hasGlyph(face, letter)) {
            piece = substitute(letter, buf);
            bytes = strlen(piece);
            // The label face has no small letters: a base letter it lacks is drawn as its capital.
            for (size_t i = 0; i < bytes && i < 2; ++i) {
                const char c = piece[i];
                upper[i] = c >= 'a' && c <= 'z' && !hasGlyph(face, static_cast<uint32_t>(c)) ? static_cast<char>(c - 32) : c;
            }
            upper[bytes < 2 ? bytes : 2] = '\0';
            piece = upper;
        }
        if (length + bytes + 1 > size)
            break;
        memcpy(out + length, piece, bytes);
        length += bytes;
    }
    if (size > 0)
        out[length] = '\0';
}

static int fitFace(const lv_font_t *face, lv_coord_t space, const char *str, int width, unsigned glyphs, char *out, size_t size) {
    const auto measure = [&](const char *text) {
        return static_cast<int>(lv_txt_get_width(text, static_cast<uint32_t>(strlen(text)), face, space, LV_TEXT_FLAG_NONE));
    };
    fold(face, str, out, size);
    const auto count = [](const char *text) {
        unsigned n = 0;
        for (; *text != '\0'; ++text)
            n += (static_cast<unsigned char>(*text) & 0xC0) != 0x80;
        return n;
    };
    int fitted = measure(out);
    if (fitted <= width && (glyphs == 0 || count(out) <= glyphs))
        return fitted;
    // Drop one glyph at a time (a whole UTF-8 sequence, and any space left hanging) until the rest and its
    // ellipsis fit: in the width, and in the count when there is one, so a name cut for being long is one short.
    size_t length = strlen(out);
    while (length > 0) {
        do {
            --length;
        } while (length > 0 && (static_cast<unsigned char>(out[length]) & 0xC0) == 0x80);
        while (length > 0 && out[length - 1] == ' ')
            --length;
        if (length + sizeof(ELLIPSIS) > size)
            continue;
        memcpy(out + length, ELLIPSIS, sizeof(ELLIPSIS));
        fitted = measure(out);
        if (fitted <= width && (glyphs == 0 || count(out) <= glyphs))
            return fitted;
    }
    out[0] = '\0';
    return 0;
}

int fit(Type type, const char *str, int width, char *out, size_t size, unsigned glyphs) {
    return fitFace(font(type), static_cast<lv_coord_t>(tracking(type)), str, width, glyphs, out, size);
}

void clamp(lv_obj_t *obj, int width) {
    lv_obj_set_width(obj, width);
    lv_label_set_long_mode(obj, LV_LABEL_LONG_CLIP);
    Look l = look(obj);
    l.flags |= CLAMPED;
    setLook(obj, l);
}

void invalidate(const lv_obj_t *obj, const lv_area_t *area) {
    if (!lv_obj_is_visible(obj))
        return;
    lv_area_t exact;
    lv_obj_get_coords(obj, &exact);
    if (area != nullptr && !_lv_area_intersect(&exact, &exact, area))
        return;
    _lv_inv_area(lv_obj_get_disp(obj), &exact);
}

void setText(lv_obj_t *obj, const char *str) {
    char fitted[128];
    const lv_font_t *face = lv_obj_get_style_text_font(obj, 0);
    if (look(obj).flags & CLAMPED)
        fitFace(face, lv_obj_get_style_text_letter_space(obj, 0), str, lv_obj_get_style_width(obj, 0), 0, fitted, sizeof(fitted));
    else
        fold(face, str, fitted, sizeof(fitted));
    str = fitted;
    if (strcmp(lv_label_get_text(obj), str) == 0)
        return;
    {
        Quiet quiet;
        lv_label_set_text(obj, str);
    }
    // A label sized to its text gets its new box at the next layout pass, which repaints the difference.
    invalidate(obj);
}

void setTone(lv_obj_t *obj, Tone fg) {
    Look l = look(obj);
    if (l.fg == fg)
        return;
    l.fg = fg;
    setLook(obj, l);
    apply(obj);
}

void setFill(lv_obj_t *obj, Tone fill) {
    Look l = look(obj);
    if (l.bg == fill)
        return;
    l.bg = fill;
    setLook(obj, l);
    apply(obj);
}

lv_obj_t *icon(lv_obj_t *parent, int cx, int cy, const lv_img_dsc_t *glyph, Tone fg) {
    lv_obj_t *obj = bare(lv_img_create(parent));
    lv_img_set_src(obj, glyph);
    lv_obj_set_style_img_recolor_opa(obj, LV_OPA_COVER, 0);
    lv_obj_set_pos(obj, cx - glyph->header.w / 2, cy - glyph->header.h / 2);
    setLook(obj, {fg, Tone::Surface0, 100, HAS_FG | IS_IMG});
    apply(obj);
    return obj;
}

void setIcon(lv_obj_t *obj, const lv_img_dsc_t *glyph) {
    if (lv_img_get_src(obj) != glyph)
        lv_img_set_src(obj, glyph);
}

lv_obj_t *pill(lv_obj_t *parent, int cx, int y, int width, const char *str, Tone fill, int height) {
    // The label's baseline sits 8 px under the pill's centre line, as drawn in the design.
    lv_obj_t *obj = filled(parent, Type::Button, inkOn(fill), fill, str, width, height, height / 2 + 8, LV_RADIUS_CIRCLE);
    lv_obj_set_pos(obj, cx - width / 2, y);
    pressable(obj);
    return obj;
}

void setPill(lv_obj_t *obj, const char *str, Tone fill) {
    setText(obj, str);
    setFill(obj, fill);
    setTone(obj, inkOn(fill));
}

lv_obj_t *disc(lv_obj_t *parent, int cx, int cy, int radius, const lv_img_dsc_t *glyph, Tone fill, Tone ink) {
    lv_obj_t *obj = bare(lv_obj_create(parent));
    lv_obj_set_size(obj, radius * 2, radius * 2);
    lv_obj_set_pos(obj, cx - radius, cy - radius);
    lv_obj_set_style_radius(obj, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
    setLook(obj, {ink, fill, 100, HAS_BG});
    apply(obj);
    if (glyph != nullptr)
        icon(obj, radius, radius, glyph, ink);
    pressable(obj);
    return obj;
}

// Text that is a control: no fill until it is pressed, its baseline where the design puts it.
static lv_obj_t *plainButton(lv_obj_t *parent, Type type, int cx, int baseline, int width, int height, const char *str, Tone fg) {
    const int inset = (height - font(type)->line_height) / 2;
    lv_obj_t *obj = filled(parent, type, fg, Tone::Surface0, str, width, height, inset + ascent(type), LV_RADIUS_CIRCLE);
    lv_obj_set_pos(obj, cx - width / 2, baseline - ascent(type) - inset);
    pressable(obj);
    return obj;
}

lv_obj_t *textButton(lv_obj_t *parent, int cx, int baseline, int width, const char *str, Tone fg) {
    return plainButton(parent, Type::Button, cx, baseline, width, tokens::DISPLAY_TOUCH, str, fg);
}

lv_obj_t *labelButton(lv_obj_t *parent, int cx, int baseline, int width, const char *str, Tone fg) {
    return plainButton(parent, Type::Label, cx, baseline, width, 44, str, fg);
}

lv_obj_t *group(lv_obj_t *parent, int x, int y, int width, int height) {
    lv_obj_t *obj = card(parent, x, y, width, height, LV_RADIUS_CIRCLE, Tone::Surface0);
    pressable(obj);
    return obj;
}

lv_obj_t *card(lv_obj_t *parent, int x, int y, int width, int height, int radius, Tone fill) {
    lv_obj_t *obj = bare(lv_obj_create(parent));
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, width, height);
    lv_obj_set_style_radius(obj, radius, 0);
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
    setLook(obj, {Tone::Ink, fill, 100, HAS_BG});
    apply(obj);
    return obj;
}

lv_obj_t *chip(lv_obj_t *parent, int x, int y, const char *str, Tone fill, Tone ink, int *width) {
    lv_obj_t *obj = filled(parent, Type::Label, ink, fill, str, LV_SIZE_CONTENT, 36, 25, 10);
    lv_obj_set_style_pad_hor(obj, 12, 0);
    lv_obj_set_pos(obj, x, y);
    if (width != nullptr) {
        lv_obj_update_layout(obj);
        *width = lv_obj_get_width(obj);
    }
    return obj;
}

void pressable(lv_obj_t *obj) {
    lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(obj, pressEvent, LV_EVENT_PRESSED, nullptr);
    lv_obj_add_event_cb(obj, pressEvent, LV_EVENT_RELEASED, nullptr);
    lv_obj_add_event_cb(obj, pressEvent, LV_EVENT_PRESS_LOST, nullptr);
}

void show(lv_obj_t *obj, bool visible, bool stepIn) {
    if (lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN) != visible)
        return;
    forgetStep(obj);
    if (!visible) {
        invalidate(obj);
        Quiet quiet;
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
        return;
    }
    // Set the first step before the part is drawn, so it never flashes at full strength.
    const bool stepping = stepIn && stepCount < sizeof(steps) / sizeof(steps[0]);
    setLevel(obj, stepping ? motion::EASE3[0] : 100);
    if (stepping)
        steps[stepCount++] = {obj, 0};
    // Whatever moved or resized the part while it was hidden lands first, so it appears in place, once.
    lv_obj_update_layout(obj);
    {
        Quiet quiet;
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
    }
    invalidate(obj);
}

bool shown(lv_obj_t *obj) { return !lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN); }

bool isReading(const lv_obj_t *obj) { return (look(obj).flags & CUSTOM) != 0; }

// ---- SegRow -------------------------------------------------------------------------------------------------

void SegRow::build(lv_obj_t *parent, int y, const char *const *labels, unsigned n, Chosen onChosen, void *ctx) {
    constexpr int WIDTH = 244, HEIGHT = 56, INSET = 4;
    count = n > 3 ? 3 : n;
    chosen = onChosen;
    context = ctx;
    track = card(parent, CENTRE - WIDTH / 2, y, WIDTH, HEIGHT, HEIGHT / 2);
    const int each = (WIDTH - INSET * 2) / static_cast<int>(count);
    for (unsigned i = 0; i < count; ++i) {
        const bool on = i == selected;
        // The label's baseline is 35 px under the track's top edge.
        items[i] = filled(track, Type::Label, on ? Tone::OnInk : Tone::Muted, on ? Tone::Ink : Tone::Surface1, labels[i], each,
                          HEIGHT - INSET * 2, 35 - INSET, LV_RADIUS_CIRCLE);
        lv_obj_set_pos(items[i], INSET + each * static_cast<int>(i), INSET);
        // A segment is drawn 48 px tall and answers on the track's full 56.
        lv_obj_set_ext_click_area(items[i], INSET);
        pressable(items[i]);
        lv_obj_add_event_cb(
            items[i],
            [](lv_event_t *e) {
                auto *row = static_cast<SegRow *>(lv_event_get_user_data(e));
                for (unsigned k = 0; k < row->count; ++k) {
                    if (row->items[k] == lv_event_get_current_target(e) && row->chosen != nullptr)
                        row->chosen(row->context, k);
                }
            },
            LV_EVENT_SHORT_CLICKED, this);
    }
}

void SegRow::select(unsigned index) {
    if (index >= count || index == selected)
        return;
    selected = index;
    for (unsigned i = 0; i < count; ++i) {
        setFill(items[i], i == selected ? Tone::Ink : Tone::Surface1);
        setTone(items[i], i == selected ? Tone::OnInk : Tone::Muted);
    }
}

void SegRow::relabel(unsigned index, const char *str) {
    if (index < count)
        setText(items[index], str);
}

// ---- Reading ------------------------------------------------------------------------------------------------

#ifdef GAGGIMATE_SIM
static Reading *readings = nullptr;
#endif

void Reading::build(lv_obj_t *parent, int cx, int baseline, Type type, Tone fg) {
    face = font(type);
    spacing = tracking(type);
    centre = cx;
    rise = ascent(type);
    top = baseline - rise;
    count = 0;
    chars[0] = '\0';
    box = bare(lv_obj_create(parent));
    lv_obj_set_size(box, 1, face->line_height);
    lv_obj_set_pos(box, centre, top);
    setLook(box, {fg, Tone::Surface0, 100, HAS_FG | CUSTOM});
    lv_obj_add_event_cb(box, drawEvent, LV_EVENT_DRAW_MAIN, this);
#ifdef GAGGIMATE_SIM
    bool listed = false;
    for (Reading *r = readings; r != nullptr; r = r->next)
        listed = listed || r == this;
    if (!listed) {
        next = readings;
        readings = this;
    }
    // The list outlives the box: a theme change deletes every screen's objects and builds only the one on the
    // glass again. Forget the box with its object, or the next object at that address is taken for this reading.
    lv_obj_add_event_cb(
        box, [](lv_event_t *e) { static_cast<Reading *>(lv_event_get_user_data(e))->box = nullptr; }, LV_EVENT_DELETE, this);
#endif
}

const char *Reading::textOf(const lv_obj_t *obj) {
#ifdef GAGGIMATE_SIM
    for (Reading *r = readings; r != nullptr; r = r->next) {
        if (r->box == obj)
            return r->chars;
    }
#else
    (void)obj;
#endif
    return nullptr;
}

void Reading::layout() {
    int x = 0;
    for (unsigned i = 0; i < count; ++i) {
        edges[i] = static_cast<lv_coord_t>(x);
        x += lv_font_get_glyph_width(face, letters[i], 0) + spacing;
    }
    edges[count] = static_cast<lv_coord_t>(x);
    // The box takes the glyphs' width. LVGL repaints the old and the new box at its next layout pass.
    width = count > 0 ? x - spacing : 1;
    lv_obj_set_width(box, width);
    lv_obj_set_x(box, centre - width / 2);
}

void Reading::moveTo(int cx, int baseline) {
    centre = cx;
    top = baseline - rise;
    lv_obj_set_pos(box, centre - width / 2, top);
}

void Reading::set(const char *str) {
    if (strcmp(str, chars) == 0)
        return;
    uint32_t incoming[MAX];
    unsigned n = 0;
    uint32_t offset = 0;
    while (str[offset] != '\0' && n < MAX)
        incoming[n++] = _lv_txt_encoded_next(str, &offset);
    strncpy(chars, str, sizeof(chars) - 1);
    chars[sizeof(chars) - 1] = '\0';

    // The same shape (as many glyphs, each as wide as the one it replaces) means only changed cells repaint.
    bool sameShape = n == count;
    for (unsigned i = 0; sameShape && i < n; ++i)
        sameShape = lv_font_get_glyph_width(face, incoming[i], 0) == lv_font_get_glyph_width(face, letters[i], 0);
    if (!sameShape) {
        memcpy(letters, incoming, sizeof(uint32_t) * n);
        count = n;
        layout();
        return;
    }
    lv_area_t coords;
    lv_obj_get_coords(box, &coords);
    // Tight tracking lets neighbouring glyphs touch; widen the cell by the overlap.
    const lv_coord_t slack = static_cast<lv_coord_t>((spacing < 0 ? -spacing : 0) + 2);
    for (unsigned i = 0; i < n; ++i) {
        if (incoming[i] == letters[i])
            continue;
        letters[i] = incoming[i];
        lv_area_t cell = {static_cast<lv_coord_t>(coords.x1 + edges[i] - slack), coords.y1,
                          static_cast<lv_coord_t>(coords.x1 + edges[i + 1] + slack), coords.y2};
        invalidate(box, &cell);
    }
}

void Reading::drawEvent(lv_event_t *e) {
    const auto *self = static_cast<const Reading *>(lv_event_get_user_data(e));
    lv_draw_ctx_t *ctx = lv_event_get_draw_ctx(e);
    lv_area_t coords;
    lv_obj_get_coords(self->box, &coords);
    const Look l = look(self->box);
    lv_draw_label_dsc_t dsc;
    lv_draw_label_dsc_init(&dsc);
    dsc.font = self->face;
    dsc.color = tone(l.fg, l.level);
    for (unsigned i = 0; i < self->count; ++i) {
        const lv_point_t at = {static_cast<lv_coord_t>(coords.x1 + self->edges[i]), coords.y1};
        lv_draw_letter(ctx, &dsc, &at, self->letters[i]);
    }
}

} // namespace bm::ui
