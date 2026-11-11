#ifndef BETTERMATE_ADJUST_SCREEN_H
#define BETTERMATE_ADJUST_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The focused value between minus and plus. Placeholder until its lane lands.
class AdjustScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_ADJUST_SCREEN_H
