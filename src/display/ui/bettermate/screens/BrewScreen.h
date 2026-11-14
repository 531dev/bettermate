#ifndef BETTERMATE_BREW_SCREEN_H
#define BETTERMATE_BREW_SCREEN_H

#include <display/ui/bettermate/Screen.h>
#include <string>

namespace bm {

// The idle Brew screen: boiler temperature as the reading, the profile under it, START as the action, on the
// split ring. Ready is the absence of a message; only an off-target boiler changes the label.
class BrewScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void swiped(lv_dir_t direction) override {
        if (direction == LV_DIR_TOP)
            host.act(Intent::Menu);
    }

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *label = nullptr;
    ui::Reading temperature;
    lv_obj_t *unit = nullptr;
    lv_obj_t *profile = nullptr;
    lv_obj_t *profileName = nullptr;
    lv_obj_t *chevron = nullptr;
    lv_obj_t *scale = nullptr;
    lv_obj_t *start = nullptr;
    std::string shownName;
    bool withScale = false;
};

} // namespace bm

#endif // BETTERMATE_BREW_SCREEN_H
