#ifndef BETTERMATE_SHEET_SCREEN_H
#define BETTERMATE_SHEET_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// How to keep the edits. Placeholder until its lane lands.
class SheetScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_SHEET_SCREEN_H
