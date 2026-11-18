#ifndef BETTERMATE_UPDATE_SCREEN_H
#define BETTERMATE_UPDATE_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// The firmware update (DisplayStates card): progress on the single ring in ink, walking a tick per 1.3%, the
// percentage as the reading with % under it, UPDATING above, "Keep the machine on" and the version below. No
// pill and no handle: the host shows it for as long as the update runs and it cannot be left. Nothing else on
// it moves, and it never dims.
class UpdateScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
    ui::Reading percent;
    lv_obj_t *unit = nullptr;
    lv_obj_t *line = nullptr;
    lv_obj_t *version = nullptr;
};

} // namespace bm

#endif // BETTERMATE_UPDATE_SCREEN_H
