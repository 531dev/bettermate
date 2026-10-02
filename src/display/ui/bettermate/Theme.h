#ifndef BETTERMATE_THEME_H
#define BETTERMATE_THEME_H

#include <display/ui/bettermate/gen/bm_assets.h>
#include <display/ui/bettermate/gen/bm_tokens.h>
#include <lvgl.h>

namespace bm {

enum class ThemeId : uint8_t { Light, Dark, Amoled };

// Foreground roles: the color of text and of an icon (icons are alpha maps recolored by the same style).
enum class Fg : uint8_t { Ink, Muted, Faint, Primary, Heat, Success, Warning, Danger, OnPrimary, OnHeat, OnDanger, Count };

// Fill roles: the background of a surface, a disc or a badge.
enum class Bg : uint8_t {
    Surface0,
    Surface1,
    Surface2,
    Line,
    Primary,
    PrimaryHover,
    PrimarySoft,
    Heat,
    HeatSoft,
    SuccessSoft,
    WarningSoft,
    DangerSoft,
    Danger,
    Count
};

// The five type styles of the round display.
enum class Type : uint8_t { Metric, MetricSm, Title, Body, Label, Count };

// The active theme's colors, for code that draws by hand (the tick rings).
struct Palette {
    lv_color_t surface0, surface1, surface2, line, lineStrong;
    lv_color_t ink, inkMuted, inkFaint;
    lv_color_t primary, primaryHover, primarySoft, onPrimary;
    lv_color_t heat, heatText, heatSoft, onHeat;
    lv_color_t success, successSoft, warning, warningSoft, danger, dangerSoft, onDanger;
};

// Every object on the display takes its colors from the shared styles below, so switching theme rewrites
// a handful of styles and repaints once. No object is touched individually.
class Theme {
  public:
    static Theme &get();

    void init();
    // Returns true when the theme actually changed.
    bool apply(ThemeId id);
    ThemeId id() const { return current; }
    const Palette &palette() const { return colors; }

    lv_style_t *fg(Fg role) { return &fgStyles[static_cast<size_t>(role)]; }
    lv_style_t *bg(Bg role) { return &bgStyles[static_cast<size_t>(role)]; }
    lv_style_t *type(Type style) { return &typeStyles[static_cast<size_t>(style)]; }

  private:
    Theme() = default;

    bool initialized = false;
    ThemeId current = ThemeId::Dark;
    Palette colors{};
    lv_style_t fgStyles[static_cast<size_t>(Fg::Count)];
    lv_style_t bgStyles[static_cast<size_t>(Bg::Count)];
    lv_style_t typeStyles[static_cast<size_t>(Type::Count)];
};

inline Theme &theme() { return Theme::get(); }

} // namespace bm

#endif // BETTERMATE_THEME_H
