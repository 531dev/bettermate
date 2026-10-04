#ifndef BETTERMATE_STATUS_SCREEN_H
#define BETTERMATE_STATUS_SCREEN_H

#include "WorkingScreen.h"

namespace bm {
class StatusScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void onShow(const UiState &state) override { update(state); }
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *phaseType = nullptr, *hero = nullptr, *shotTarget = nullptr;
    lv_obj_t *progress = nullptr, *progressFill = nullptr, *phaseProgress = nullptr;
    lv_obj_t *weight = nullptr, *action = nullptr, *actionIcon = nullptr;
};
} // namespace bm
#endif
