#ifndef BETTERMATE_FAULT_SCREEN_H
#define BETTERMATE_FAULT_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// A fault that blocks brewing (design/reference/product-states.md, DisplayStates card): no ring, an ERROR chip,
// the fault's name as the reading, one or two lines on what the machine did and what to check, and RESTART only
// when pressing it can help. `triangle-alert` in danger sits in the slot at 12 o'clock. The host shows it while
// the cause lasts; it cannot be dismissed, and nothing else on it answers a touch.
class FaultScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *glyph = nullptr;
    lv_obj_t *chip = nullptr;
    lv_obj_t *title = nullptr;
    lv_obj_t *lines[2]{};
    lv_obj_t *action = nullptr;
};

} // namespace bm

#endif // BETTERMATE_FAULT_SCREEN_H
