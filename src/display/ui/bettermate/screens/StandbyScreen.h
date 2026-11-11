#ifndef BETTERMATE_STANDBY_SCREEN_H
#define BETTERMATE_STANDBY_SCREEN_H

#include <display/ui/bettermate/LuxuryUI.h>
#include <display/ui/bettermate/Screen.h>

namespace bm {

// Quiet clock face with a bare rim. A tap anywhere opens mode selection;
// wake guards, scheduled wake, faults and AMOLED clock drift remain active.
class StandbyScreen : public Screen {
  public:
    using Screen::Screen;

    void onShow(const UiState &state) override;
    void update(const UiState &state) override;
    lv_obj_t *body() override { return center; }

  protected:
    void build(lv_obj_t *root) override;

  private:
    void updateRest(const UiState &state, bool resting);

    lv_obj_t *center = nullptr;
    lv_obj_t *eyebrow = nullptr;
    lv_obj_t *clockBlock = nullptr;
    lv_obj_t *date = nullptr;
    lv_obj_t *clock = nullptr;
    lv_obj_t *meridiem = nullptr;
    lv_obj_t *wordmark = nullptr;
    lv_obj_t *divider = nullptr;
    lv_obj_t *boiler = nullptr;
    lv_obj_t *sentence = nullptr;
    lv_obj_t *wakeButton = nullptr;
    lv_obj_t *wakeLabel = nullptr;
    lv_obj_t *activity = nullptr;
    luxury::Indicators indicators;

    unsigned long shownAt = 0;
    int restStep = -1; // which step of the drift is applied; -1 while the full screen is lit
};

} // namespace bm

#endif // BETTERMATE_STANDBY_SCREEN_H
