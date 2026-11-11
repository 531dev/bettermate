#ifndef BETTERMATE_PROFILES_SCREEN_H
#define BETTERMATE_PROFILES_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// One profile per screen. Placeholder until its lane lands.
class ProfilesScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_PROFILES_SCREEN_H
