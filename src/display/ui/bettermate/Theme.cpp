#include "Theme.h"

namespace bm {
namespace {
ThemeId current = ThemeId::Black;
bool applied = false;
lv_color_t colors[static_cast<size_t>(Tone::Count)];

void load(const tokens::Palette &p) {
    const uint32_t hex[static_cast<size_t>(Tone::Count)] = {
        p.surface0, p.surface1,  p.surface2, p.track,    p.ink,     p.onInk,       p.inkMuted, p.inkFaint,   p.primary, p.onPrimary,
        p.heat,     p.heatText,  p.heatSoft, p.warning,  p.warningSoft, p.danger,  p.dangerSoft, 0xffffff, 0x111111,
    };
    for (size_t i = 0; i < static_cast<size_t>(Tone::Count); ++i)
        colors[i] = lv_color_hex(hex[i]);
}

struct TypeStyle {
    const lv_font_t *font;
    int tracking;
};
const TypeStyle TYPES[static_cast<size_t>(Type::Count)] = {
    {&bm_font_hero, tokens::TRACKING_SCREEN_HERO},     {&bm_font_hero_sm, tokens::TRACKING_SCREEN_HERO_SM},
    {&bm_font_value, tokens::TRACKING_SCREEN_VALUE},   {&bm_font_title, tokens::TRACKING_SCREEN_TITLE},
    {&bm_font_body, tokens::TRACKING_SCREEN_BODY},     {&bm_font_label, tokens::TRACKING_SCREEN_LABEL},
    {&bm_font_button, tokens::TRACKING_SCREEN_BUTTON},
};
} // namespace

namespace theme {
bool set(ThemeId id) {
    if (applied && id == current)
        return false;
    applied = true;
    current = id;
    load(id == ThemeId::Light ? tokens::LIGHT : tokens::AMOLED);
    return true;
}

ThemeId id() { return current; }
} // namespace theme

lv_color_t tone(Tone t) { return colors[static_cast<size_t>(t)]; }

lv_color_t tone(Tone t, uint8_t level) {
    if (level >= 100)
        return tone(t);
    return lv_color_mix(tone(t), tone(Tone::Surface0), static_cast<uint8_t>(level * 255 / 100));
}

const lv_font_t *font(Type type) { return TYPES[static_cast<size_t>(type)].font; }
int tracking(Type type) { return TYPES[static_cast<size_t>(type)].tracking; }
int ascent(Type type) {
    const lv_font_t *f = font(type);
    return f->line_height - f->base_line;
}

} // namespace bm
