#ifndef BETTERMATE_MENU_SCREEN_H
#define BETTERMATE_MENU_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The mode menu: up to five discs on a circle starting at 12 o'clock, the mode the menu was opened from in
// ink, and the power disc at the centre for Standby. No list and no scrolling. A disc that cannot act is
// away and the rest are spaced evenly; a swipe down or a tap on the ink disc goes back to that mode.
//
// The discs are a third of the panel, so they never come or go in one frame. They arrive over the three
// ranks of a screen change (top and centre, sides, bottom). When a tap leaves the menu the outer discs go
// first, a rank a frame, and only then is the host asked for the change: the screen that follows brings a
// reading that repaints on each of its three frames, and the two would not fit a quarter of the panel.
class MenuScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tick(const UiState &state, uint32_t frame) override;
    void swiped(lv_dir_t direction) override;

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    enum Item : uint8_t { Brew, Steam, Water, Grind, Info, ItemCount };
    struct Disc {
        lv_obj_t *obj = nullptr;
        lv_obj_t *glyph = nullptr;
        lv_obj_t *name = nullptr;
    };
    static constexpr uint8_t UNPLACED = 0xff;
    static constexpr int8_t NONE = -1;
    static constexpr int8_t POWER = ItemCount; // the centre disc, where an Item is expected

    static void hitTest(lv_event_t *e);
    static void clicked(lv_event_t *e);
    void place(uint8_t set);
    void dress(int8_t item, bool pressed);
    void depart(Intent intent, int8_t pressed);
    bool shed(unsigned group);

    Disc discs[ItemCount];
    lv_obj_t *power = nullptr;
    lv_obj_t *powerGlyph = nullptr;
    uint8_t placed = UNPLACED; // the discs the positions on the glass are for, one bit an Item
    uint8_t asked = 0;         // the discs the last snapshot allows
    uint8_t regroup = 0;       // 0, or the step of a re-spacing under way
    int8_t active = NONE;      // the Item drawn in ink
    bool entering = false;     // the next update is the first of this visit: nothing is on the glass yet
    bool slotShown = false;    // the exception slot above the top disc is on the glass

    // Leaving by touch: what the host will be asked for, the disc that was pressed, and the step reached.
    Intent departFor = Intent::Refresh;
    int8_t departWith = NONE;
    uint8_t departing = 0;
};

} // namespace bm

#endif // BETTERMATE_MENU_SCREEN_H
