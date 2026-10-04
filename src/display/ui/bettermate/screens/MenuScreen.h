#ifndef BETTERMATE_MENU_SCREEN_H
#define BETTERMATE_MENU_SCREEN_H

#include "WorkingScreen.h"

namespace bm {
class MenuScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *brew = nullptr;
    lv_obj_t *steam = nullptr;
    lv_obj_t *water = nullptr;
    lv_obj_t *grind = nullptr;
    lv_obj_t *brewLabel = nullptr;
    lv_obj_t *steamLabel = nullptr;
    lv_obj_t *waterLabel = nullptr;
    lv_obj_t *grindLabel = nullptr;
};
} // namespace bm
#endif
