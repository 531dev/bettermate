#ifndef BETTERMATE_ADJUST_SCREEN_H
#define BETTERMATE_ADJUST_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The profile in use, one value at a time: a row picks temperature, pressure or the stop target, minus and plus
// change it, and the reading between them shows it. Every step goes straight to the machine and leaves the
// profile unsaved: the title says so and the pill, DONE until then, reads SAVE and opens the save sheet.
class AdjustScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void swiped(lv_dir_t direction) override {
        if (direction == LV_DIR_BOTTOM)
            host.act(Intent::Back);
    }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    // In the order of the row with all three.
    enum class Field : uint8_t { Temperature, Pressure, Target };
    void choose(unsigned index);
    void step(bool up);

    lv_obj_t *title = nullptr;
    // BAR needs a pressure sensor and a phase that can take a pressure target, so the row has two choices or
    // three. A SegRow keeps the number it was built with: there is one of each, and one of them shows.
    ui::SegRow twoWay;
    ui::SegRow threeWay;
    lv_obj_t *minus = nullptr;
    lv_obj_t *plus = nullptr;
    ui::Reading value;
    lv_obj_t *unit = nullptr;
    lv_obj_t *useTime = nullptr;
    lv_obj_t *unset = nullptr;
    lv_obj_t *action = nullptr;

    Field focus = Field::Temperature;
    bool withPressure = false;    // the row on the glass offers BAR
    bool byWeight = false;        // the stop target on the glass is the weight, not the time
    bool pressedByWeight = false; // and was when the finger came down on minus or plus
    bool changed = false;         // the pill reads SAVE
};

} // namespace bm

#endif // BETTERMATE_ADJUST_SCREEN_H
