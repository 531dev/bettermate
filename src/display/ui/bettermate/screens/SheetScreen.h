#ifndef BETTERMATE_SHEET_SCREEN_H
#define BETTERMATE_SHEET_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// How to keep the edits made in Adjust: three choices, the most likely first. A sheet is a screen, never an
// overlay, and this is the only one with two filled pills.
class SheetScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void swiped(lv_dir_t direction) override {
        if (direction == LV_DIR_BOTTOM)
            host.act(Intent::Back);
    }

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *save = nullptr;
    lv_obj_t *saveAsNew = nullptr;
    lv_obj_t *useOnce = nullptr;
};

} // namespace bm

#endif // BETTERMATE_SHEET_SCREEN_H
