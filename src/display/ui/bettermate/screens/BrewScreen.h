#ifndef BETTERMATE_BREW_SCREEN_H
#define BETTERMATE_BREW_SCREEN_H

#include <display/ui/bettermate/LuxuryUI.h>
#include <display/ui/bettermate/Screen.h>

namespace bm {
class BrewScreen : public Screen {
  public:
    using Screen::Screen;
    void onShow(const UiState &state) override;
    void update(const UiState &state) override;
    lv_obj_t *body() override { return idle; }

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *idle = nullptr, *overlay = nullptr, *menu = nullptr;
    lv_obj_t *status = nullptr, *statusDot = nullptr, *profile = nullptr, *profileName = nullptr, *chevron = nullptr;
    lv_obj_t *hero = nullptr, *unit = nullptr, *unsaved = nullptr;
    lv_obj_t *scale = nullptr, *scaleWeight = nullptr, *start = nullptr;
    lv_obj_t *warningTitle = nullptr, *warningBack = nullptr, *warningConfirm = nullptr;
    lv_obj_t *warningRows[WARNING_TYPE_COUNT]{};
    luxury::Readout temperature;
    luxury::Rim temperatureRim, pressureRim;
    luxury::Indicators indicators;
    bool wasStable = true;
};
} // namespace bm
#endif
