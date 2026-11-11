#ifndef BETTERMATE_MENU_SCREEN_H
#define BETTERMATE_MENU_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The mode menu. Placeholder until its lane lands.
class MenuScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_MENU_SCREEN_H
