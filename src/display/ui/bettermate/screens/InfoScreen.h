#ifndef BETTERMATE_INFO_SCREEN_H
#define BETTERMATE_INFO_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// Network, QR code and versions. Placeholder until its lane lands.
class InfoScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_INFO_SCREEN_H
