#include "Theme.h"

namespace bm {

Theme &Theme::get() {
    static Theme instance;
    return instance;
}

static Palette toPalette(const tokens::Palette &t) {
    Palette p;
    p.surface0 = lv_color_hex(t.surface0);
    p.surface1 = lv_color_hex(t.surface1);
    p.surface2 = lv_color_hex(t.surface2);
    p.line = lv_color_hex(t.line);
    p.lineStrong = lv_color_hex(t.lineStrong);
    p.ink = lv_color_hex(t.ink);
    p.inkMuted = lv_color_hex(t.inkMuted);
    p.inkFaint = lv_color_hex(t.inkFaint);
    p.primary = lv_color_hex(t.primary);
    p.primaryHover = lv_color_hex(t.primaryHover);
    p.primarySoft = lv_color_hex(t.primarySoft);
    p.onPrimary = lv_color_hex(t.onPrimary);
    p.heat = lv_color_hex(t.heat);
    p.heatText = lv_color_hex(t.heatText);
    p.heatSoft = lv_color_hex(t.heatSoft);
    p.onHeat = lv_color_hex(t.onHeat);
    p.success = lv_color_hex(t.success);
    p.successSoft = lv_color_hex(t.successSoft);
    p.warning = lv_color_hex(t.warning);
    p.warningSoft = lv_color_hex(t.warningSoft);
    p.danger = lv_color_hex(t.danger);
    p.dangerSoft = lv_color_hex(t.dangerSoft);
    p.onDanger = lv_color_hex(t.onDanger);
    return p;
}

void Theme::init() {
    if (initialized)
        return;
    initialized = true;

    for (auto &style : fgStyles)
        lv_style_init(&style);
    for (auto &style : bgStyles)
        lv_style_init(&style);
    for (auto &style : typeStyles)
        lv_style_init(&style);

    // Letter spacing is whole pixels in LVGL: -0.02em of 64 px is -1, +0.1em of 14 px is 1.
    lv_style_t *metric = type(Type::Metric);
    lv_style_set_text_font(metric, &bm_font_mono_64);
    lv_style_set_text_letter_space(metric, -1);

    lv_style_set_text_font(type(Type::MetricSm), &bm_font_mono_28);
    lv_style_set_text_font(type(Type::Title), &bm_font_sans_24);
    lv_style_set_text_font(type(Type::Body), &bm_font_sans_18);

    lv_style_t *label = type(Type::Label);
    lv_style_set_text_font(label, &bm_font_mono_14);
    lv_style_set_text_letter_space(label, 1);

    current = ThemeId::Light; // anything but the theme applied next, so the first apply() takes effect
    apply(ThemeId::Dark);
}

bool Theme::apply(ThemeId id) {
    if (initialized && id == current)
        return false;
    current = id;
    colors = toPalette(id == ThemeId::Light ? tokens::LIGHT : id == ThemeId::Amoled ? tokens::AMOLED : tokens::DARK);

    const lv_color_t fgColors[static_cast<size_t>(Fg::Count)] = {
        colors.ink,       // Ink
        colors.inkMuted,  // Muted
        colors.inkFaint,  // Faint
        colors.primary,   // Primary
        colors.heatText,  // Heat: words use heat-text, the mark shade is too light to read as text
        colors.success,   // Success
        colors.warning,   // Warning
        colors.danger,    // Danger
        colors.onPrimary, // OnPrimary
        colors.onHeat,    // OnHeat
        colors.onDanger,  // OnDanger
    };
    for (size_t i = 0; i < static_cast<size_t>(Fg::Count); i++) {
        lv_style_set_text_color(&fgStyles[i], fgColors[i]);
        lv_style_set_img_recolor(&fgStyles[i], fgColors[i]);
        lv_style_set_img_recolor_opa(&fgStyles[i], LV_OPA_COVER);
    }

    const lv_color_t bgColors[static_cast<size_t>(Bg::Count)] = {
        colors.surface0,     // Surface0
        colors.surface1,     // Surface1
        colors.surface2,     // Surface2
        colors.line,         // Line
        colors.primary,      // Primary
        colors.primaryHover, // PrimaryHover
        colors.primarySoft,  // PrimarySoft
        colors.heat,         // Heat
        colors.heatSoft,     // HeatSoft
        colors.successSoft,  // SuccessSoft
        colors.warningSoft,  // WarningSoft
        colors.dangerSoft,   // DangerSoft
        colors.danger,       // Danger
    };
    for (size_t i = 0; i < static_cast<size_t>(Bg::Count); i++) {
        lv_style_set_bg_color(&bgStyles[i], bgColors[i]);
        lv_style_set_bg_opa(&bgStyles[i], LV_OPA_COVER);
    }

    lv_obj_report_style_change(nullptr);
    return true;
}

} // namespace bm
