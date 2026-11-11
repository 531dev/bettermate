#ifndef BETTERMATE_STATUS_SCREEN_H
#define BETTERMATE_STATUS_SCREEN_H

#include "WorkingScreen.h"

namespace bm {
// The shot: one timer, the phase beneath it, live pressure on the rim and phase progress inside it.
class StatusScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void onShow(const UiState &state) override;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *hero = nullptr, *phaseName = nullptr, *pressureValue = nullptr;
    lv_obj_t *weight = nullptr, *temperature = nullptr, *summary = nullptr;
    lv_obj_t *action = nullptr;
    luxury::Rim pressureRim;
    luxury::PhaseTrack phases;
};
} // namespace bm
#endif
