#ifndef BETTERMATE_PROFILE_SCREEN_H
#define BETTERMATE_PROFILE_SCREEN_H

#include "WorkingScreen.h"

namespace bm {
class ProfileScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *temperature = nullptr;
    lv_obj_t *target = nullptr;
    lv_obj_t *counts = nullptr;
    lv_obj_t *position = nullptr;
    lv_obj_t *previous = nullptr;
    lv_obj_t *next = nullptr;
};
} // namespace bm
#endif
