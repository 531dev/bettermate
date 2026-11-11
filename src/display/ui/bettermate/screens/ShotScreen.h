#ifndef BETTERMATE_SHOT_SCREEN_H
#define BETTERMATE_SHOT_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// A shot in progress and its result. Placeholder until its lane lands.
class ShotScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_SHOT_SCREEN_H
