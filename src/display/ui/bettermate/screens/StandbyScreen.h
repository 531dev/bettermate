#ifndef BETTERMATE_STANDBY_SCREEN_H
#define BETTERMATE_STANDBY_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The display at rest: the clock as the one reading and the boiler's residual heat greyed on a single ring. There
// is no control on the glass: a tap anywhere wakes the machine. While the machine is busy or blocked the reason
// takes the line under the clock. On the 12-hour clock AM or PM stands beside the reading in screen-label: the hero
// face has figures only, and the pair is centred as one.
class StandbyScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tapped() override { host.act(Intent::Wake); }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    void place(const UiState &state, bool resting, int tail);

    lv_obj_t *label = nullptr;
    ui::Reading clock;
    lv_obj_t *meridiem = nullptr;
    int meridiemWidth = 0;
    lv_obj_t *line = nullptr;
    unsigned long enteredAt = 0;
    int restStep = -2;
    int placedClock = -1; // the clock's width and the room its AM or PM took when the pair was last placed
    int placedTail = -1;
    bool wasResting = false;
};

} // namespace bm

#endif // BETTERMATE_STANDBY_SCREEN_H
