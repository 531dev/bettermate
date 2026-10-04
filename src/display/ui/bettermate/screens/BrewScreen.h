#ifndef BETTERMATE_BREW_SCREEN_H
#define BETTERMATE_BREW_SCREEN_H

#include "WorkingScreen.h"

namespace bm {
class BrewScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void onShow(const UiState &state) override {
        viewingWarnings = false;
        update(state);
    }
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *idle = nullptr, *adjust = nullptr, *overlay = nullptr;
    lv_obj_t *hero = nullptr, *targetHint = nullptr;
    lv_obj_t *scale = nullptr, *scaleIcon = nullptr, *weight = nullptr;
    lv_obj_t *start = nullptr;
    lv_obj_t *temperature = nullptr, *target = nullptr, *targetCaption = nullptr, *deleteWeight = nullptr;
    lv_obj_t *deleteCaption = nullptr;
    lv_obj_t *save = nullptr, *saveAsNew = nullptr;
    lv_obj_t *warningTitle = nullptr, *warningBack = nullptr, *warningConfirm = nullptr;
    lv_obj_t *warningRows[WARNING_TYPE_COUNT]{};
    bool viewingWarnings = false;
};
} // namespace bm
#endif
