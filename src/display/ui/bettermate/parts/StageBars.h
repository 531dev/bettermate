#ifndef BETTERMATE_STAGE_BARS_H
#define BETTERMATE_STAGE_BARS_H

#include <cstdint>
#include <lvgl.h>

namespace bm::ui {

// The stages of a shot under its timer: one bar per phase, as wide as the phase's planned duration, in track,
// with the part that has run in ink (design: stageBars). One object draws every bar.
//
// The filled part grows toward what was set a little each frame and repaints only the columns that changed
// (motion: Stage advance), so a running shot spends a few dozen pixels a frame here, never the bar.
class StageBars {
  public:
    static constexpr unsigned MAX = 8;

    // The row starts at x, y and is `width` wide; a bar is 8 px tall.
    void build(lv_obj_t *parent, int x, int y, int width);
    // The plan: seconds per phase. A different plan lays the bars out again, empty. None clears the row.
    void plan(const float *seconds, unsigned count);
    // Where the shot is: the phases before `phase` have run and `phase` is `progress` (0..1) of the way. The
    // running phase always shows at least a dot. A `phase` past the last one fills every bar.
    void set(unsigned phase, float progress);
    // Advance one frame toward what was set.
    void step();
    // Jump to what was set (first paint).
    void settle();
    lv_obj_t *obj() const { return box; }

  private:
    static void drawEvent(lv_event_t *e);
    void draw(lv_draw_ctx_t *ctx) const;
    void repaint(unsigned bar, int from, int to) const;

    lv_obj_t *box = nullptr;
    int span = 0;
    unsigned count = 0;
    float planned[MAX]{};
    int16_t left[MAX]{};  // px from the row's left edge
    int16_t width[MAX]{}; // px
    int16_t want[MAX]{};  // filled px: 0, or from a dot up to the bar's width
    int16_t drawn[MAX]{};
};

} // namespace bm::ui

#endif // BETTERMATE_STAGE_BARS_H
