#ifndef BETTERMATE_STANDBY_SCREEN_H
#define BETTERMATE_STANDBY_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The display at rest: the clock as the one reading, the boiler's residual heat greyed on a single ring, and
// WAKE as the one action. While the machine is busy or blocked the reason takes the line under the clock.
class StandbyScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tapped() override { host.act(Intent::Wake); }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    void place(const UiState &state, bool resting);

    lv_obj_t *label = nullptr;
    ui::Reading clock;
    lv_obj_t *line = nullptr;
    lv_obj_t *wake = nullptr;
    unsigned long enteredAt = 0;
    int restStep = -2;
};

} // namespace bm

#endif // BETTERMATE_STANDBY_SCREEN_H
