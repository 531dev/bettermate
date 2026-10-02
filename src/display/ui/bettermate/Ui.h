#ifndef BETTERMATE_UI_HELPERS_H
#define BETTERMATE_UI_HELPERS_H

#include <display/ui/bettermate/Theme.h>
#include <lvgl.h>

// The few building blocks every screen is made of. Each one starts from a bare object (no library theme
// styles) and takes its colors and type from the shared theme styles, never from literals.
namespace bm::ui {

constexpr lv_coord_t DISPLAY = tokens::DISPLAY; // the panel is 480 x 480, round

// A full-screen root on surface-0. Text inside defaults to ink in the body style.
lv_obj_t *screen();

// An invisible container that hugs its children and takes no input.
lv_obj_t *box(lv_obj_t *parent);

// Flex containers that hug their children, which are centered across the flow.
lv_obj_t *column(lv_obj_t *parent, lv_coord_t gap);
lv_obj_t *row(lv_obj_t *parent, lv_coord_t gap, lv_flex_align_t cross = LV_FLEX_ALIGN_CENTER);

lv_obj_t *label(lv_obj_t *parent, Type type, Fg color, const char *text = "");
// A pixel glyph or the wordmark: an alpha map filled with the role's color.
lv_obj_t *icon(lv_obj_t *parent, const lv_img_dsc_t *glyph, Fg color);

// A filled, rounded shape (a disc, a card, a badge ground).
lv_obj_t *fill(lv_obj_t *parent, Bg color, lv_coord_t radius);

// Setters that leave the object alone when nothing changes, so an unchanged reading costs no redraw.
void setText(lv_obj_t *label, const char *text);
void setIcon(lv_obj_t *icon, const lv_img_dsc_t *glyph);
void setFg(lv_obj_t *obj, Fg color);
void setBg(lv_obj_t *obj, Bg color);
void setVisible(lv_obj_t *obj, bool visible);

// Status as an uppercase word on a soft tint. The word does the work; the color only supports it.
enum class Tone : uint8_t { Neutral, Ready, Heating, Brewing, Warning, Danger };
struct Badge {
    lv_obj_t *root = nullptr;
    lv_obj_t *text = nullptr;
};
Badge badge(lv_obj_t *parent);
void setBadge(const Badge &badge, Tone tone, const char *text);

} // namespace bm::ui

#endif // BETTERMATE_UI_HELPERS_H
