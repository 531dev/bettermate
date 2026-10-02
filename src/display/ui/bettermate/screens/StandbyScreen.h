#ifndef BETTERMATE_STANDBY_SCREEN_H
#define BETTERMATE_STANDBY_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// What the machine shows while it is off: connectivity at the top, the clock as the one hero reading, the
// wordmark, and a badge that says the boiler temperature so a warm machine is obvious. The rim stays bare
// because no ring has anything to report. A tap anywhere wakes the machine.
class StandbyScreen : public Screen {
  public:
    using Screen::Screen;

    void onShow(const UiState &state) override;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    void updateHint(const UiState &state, bool visible);
    void updateRest(const UiState &state, bool resting);

    lv_obj_t *status = nullptr;
    lv_obj_t *wifi = nullptr;
    lv_obj_t *bluetooth = nullptr;
    lv_obj_t *update_ = nullptr;
    ui::Badge warning;

    lv_obj_t *center = nullptr;
    lv_obj_t *alert = nullptr;
    lv_obj_t *clockBlock = nullptr;
    lv_obj_t *date = nullptr;
    lv_obj_t *clock = nullptr;
    lv_obj_t *meridiem = nullptr;
    lv_obj_t *wordmark = nullptr;
    lv_obj_t *statusBlock = nullptr;
    ui::Badge badge;
    lv_obj_t *sentence = nullptr;

    lv_obj_t *hint = nullptr;
    lv_obj_t *hintIcon = nullptr;
    lv_obj_t *hintText = nullptr;

    unsigned long shownAt = 0;
    int restStep = -1; // which step of the drift is applied; -1 while the full screen is lit
};

} // namespace bm

#endif // BETTERMATE_STANDBY_SCREEN_H
