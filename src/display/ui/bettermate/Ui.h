#ifndef BETTERMATE_UI_PARTS_H
#define BETTERMATE_UI_PARTS_H

#include <display/ui/bettermate/Theme.h>
#include <lvgl.h>

// The parts every display screen is built from (design/reference/round-display.md, Controls). Positions are
// panel pixels in the 480 box, text by its baseline, exactly as the design gives them. Nothing here uses a
// layout engine, a style opacity or a transform: a part is a flat color on the face, so showing, hiding or
// recolouring it repaints its own box and nothing else.
namespace bm::ui {

// The stage every screen puts its parts on: the design's 480 px box, centred on the one LVGL screen (the AMOLED
// panels are 466 px, so there it overhangs by 7 px a side). It is never shown, hidden or restyled, so changing
// screen never repaints the panel: only the parts that come and go are redrawn.
lv_obj_t *root();
// Paints the LVGL screen itself in the theme's face color.
void paintFace();

// Text centred on cx with its baseline at y. Give a changing label a width sized for its longest value, so
// a new digit redraws the same box every time; 0 sizes the box to the text.
lv_obj_t *text(lv_obj_t *parent, int cx, int baseline, Type type, Tone tone, const char *str = "", int width = 0);
// Text starting at x.
lv_obj_t *textLeft(lv_obj_t *parent, int x, int baseline, Type type, Tone tone, const char *str = "", int width = 0);
// Keep a name on one line of the given width, ending in an ellipsis when it is longer.
void clamp(lv_obj_t *label, int width);
// The setters skip unchanged values: in LVGL 8 every style or text set repaints the object.
void setText(lv_obj_t *label, const char *str);
void setTone(lv_obj_t *obj, Tone tone);
void setFill(lv_obj_t *obj, Tone fill);

lv_obj_t *icon(lv_obj_t *parent, int cx, int cy, const lv_img_dsc_t *glyph, Tone tone);
void setIcon(lv_obj_t *icon, const lv_img_dsc_t *glyph);

// The action: 64 px tall, fully rounded. Primary starts something, Ink stops or dismisses, Surface2 is the
// save sheet's second choice. The label color follows the fill.
lv_obj_t *pill(lv_obj_t *parent, int cx, int y, int width, const char *label, Tone fill, int height = tokens::DISPLAY_ACTION);
void setPill(lv_obj_t *pill, const char *label, Tone fill);
// A disc with a glyph: radius 30 for minus and plus, 28 for chevrons and secondary actions.
lv_obj_t *disc(lv_obj_t *parent, int cx, int cy, int radius, const lv_img_dsc_t *glyph, Tone fill = Tone::Surface2,
               Tone ink = Tone::Ink);
// screen-button text with no fill and a 56 px tall hit area.
lv_obj_t *textButton(lv_obj_t *parent, int cx, int baseline, int width, const char *label, Tone tone = Tone::Ink);
// The same in screen-label, for a line that is also a control ("0.0 G · TARE"). 44 px tall.
lv_obj_t *labelButton(lv_obj_t *parent, int cx, int baseline, int width, const char *label, Tone tone = Tone::Muted);
// A see-through box that answers a touch as one control (a name with its chevron). It inverts when pressed.
lv_obj_t *group(lv_obj_t *parent, int x, int y, int width, int height);
// A flat card for facts and warning rows. Never a border.
lv_obj_t *card(lv_obj_t *parent, int x, int y, int width, int height, int radius = tokens::RADIUS_LG,
               Tone fill = Tone::Surface1);
// A status word in a tinted box, 36 px tall, starting at x. Returns its width through `width` when asked.
lv_obj_t *chip(lv_obj_t *parent, int x, int y, const char *label, Tone fill, Tone ink, int *width = nullptr);

// Repaints exactly this part, or exactly `area` of it. LVGL 8.4 grows every area an object invalidates by 5 px
// a side in case the object is transformed. Nothing here ever is, and on a 26 px tick box that doubles the
// cost, so every part repaints through this instead.
void invalidate(const lv_obj_t *obj, const lv_area_t *area = nullptr);

// Makes any part answer a touch: it swaps to ink and on-ink for at least two frames (motion: Press).
void pressable(lv_obj_t *obj);
// Shows or hides a part. One that appears steps in by recolour over three frames; one that leaves is cut.
void show(lv_obj_t *obj, bool visible, bool stepIn = true);
bool shown(lv_obj_t *obj);
// True for the box of a Reading (below).
bool isReading(const lv_obj_t *obj);

// A row choosing between two or three values: a 56 px track in surface-1, the chosen segment in ink.
class SegRow {
  public:
    using Chosen = void (*)(void *context, unsigned index);
    void build(lv_obj_t *parent, int y, const char *const *labels, unsigned count, Chosen chosen, void *context);
    void select(unsigned index);
    void relabel(unsigned index, const char *label);
    lv_obj_t *obj() const { return track; }

  private:
    lv_obj_t *track = nullptr;
    lv_obj_t *items[3]{};
    unsigned count = 0;
    unsigned selected = 0;
    Chosen chosen = nullptr;
    void *context = nullptr;
};

// A numeral drawn glyph by glyph. When a digit changes only its own cell is repainted (motion: digit snap),
// and tabular figures keep every other cell where it was. The box always fits the glyphs, so showing, hiding
// or stepping the reading in costs its ink and no more.
class Reading {
  public:
    void build(lv_obj_t *parent, int cx, int baseline, Type type, Tone tone);
    void set(const char *text);
    // Keeps the text centred on a new point.
    void moveTo(int cx, int baseline);
    const char *text() const { return chars; }
    lv_obj_t *obj() const { return box; }
    // For the simulator's checks: the text this object shows, or nullptr when it is not a Reading.
    static const char *textOf(const lv_obj_t *obj);

  private:
    static constexpr unsigned MAX = 8;
    static void drawEvent(lv_event_t *e);
    void layout();

    lv_obj_t *box = nullptr;
    const lv_font_t *face = nullptr;
    int spacing = 0;
    int centre = 0;
    int rise = 0;
    int top = 0;
    int width = 1;
    char chars[MAX * 2 + 1]{};
    uint32_t letters[MAX]{};
    lv_coord_t edges[MAX + 1]{};
    unsigned count = 0;
#ifdef GAGGIMATE_SIM
    Reading *next = nullptr;
#endif
};

// Internal: advances step-ins and presses by one frame, and forgets every part before a rebuild.
namespace fx {
void step();
void reset();
} // namespace fx

} // namespace bm::ui

#endif // BETTERMATE_UI_PARTS_H
