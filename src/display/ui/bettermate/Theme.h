#ifndef BETTERMATE_THEME_H
#define BETTERMATE_THEME_H

#include <display/ui/bettermate/gen/bm_assets.h>
#include <display/ui/bettermate/gen/bm_tokens.h>
#include <lvgl.h>

namespace bm {

// Display black ships on every panel: a black ground hides the round bezel. Light remains a setting.
enum class ThemeId : uint8_t { Black, Light };

// The color tokens the display draws with. Ink selects, cobalt (Primary) acts, orange (Heat) is the boiler.
enum class Tone : uint8_t {
    Surface0, // the face
    Surface1, // cards, the row track
    Surface2, // discs
    Track,    // unlit ticks and bars
    Ink,
    OnInk,
    Muted,
    Faint,
    Primary,
    OnPrimary,
    Heat,     // temperature marks
    HeatText, // temperature as words
    HeatSoft, // the dim phase of the heating pulse
    Warning,
    WarningSoft,
    Danger,
    DangerSoft,
    QrGround, // the QR card is white with black modules in every theme
    QrInk,
    Count
};

// The seven type styles of the round display. Nothing is smaller than Label (20 px).
enum class Type : uint8_t { Hero, HeroSm, Value, Title, Body, Label, Button, Count };

namespace theme {
// Returns true when the theme actually changed; the caller then rebuilds what it drew.
bool set(ThemeId id);
ThemeId id();
} // namespace theme

lv_color_t tone(Tone tone);
// A tone mixed toward the face: how the display fades without compositing (level 0..100).
lv_color_t tone(Tone tone, uint8_t level);
const lv_font_t *font(Type type);
int tracking(Type type);
// Distance from the top of a line of this type to its baseline: layouts are given in baselines.
int ascent(Type type);

} // namespace bm

#endif // BETTERMATE_THEME_H
