#ifndef BETTERMATE_WARNINGS_SCREEN_H
#define BETTERMATE_WARNINGS_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// One card per warning. Placeholder until its lane lands.
class WarningsScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_WARNINGS_SCREEN_H
