#ifndef BETTERMATE_BREW_SCREEN_H
#define BETTERMATE_BREW_SCREEN_H

#include <display/ui/bettermate/Screen.h>
#include <string>

namespace bm {

// The idle Brew screen: boiler temperature as the reading, the profile under it, START as the action, on the
// split ring. Ready is the absence of a message; only an off-target boiler changes the label.
//
// A START the controller has not confirmed by the end of its 2-frame press turns the pill quiet (surface-2,
// STARTING in ink-muted) and hides the handle. The confirmation is a screen change (Shot, or the question on
// Warnings), which cuts it back; after 2 s with none, START returns and the host raises a warning.
class BrewScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tick(const UiState &state, uint32_t frame) override;
    void swiped(lv_dir_t direction) override {
        if (direction == LV_DIR_TOP && pending == Pending::None)
            host.act(Intent::Menu);
    }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    enum class Pending : uint8_t { None, Pressed, Waiting };
    static void started(lv_event_t *e);
    void settle(); // START as it rests

    Pending pending = Pending::None;
    uint32_t frameNow = 0;
    uint32_t pressedAt = 0;
    lv_obj_t *handle = nullptr;
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
