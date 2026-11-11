#ifndef BETTERMATE_INFO_SCREEN_H
#define BETTERMATE_INFO_SCREEN_H

#include <display/ui/bettermate/Screen.h>
#include <string>

namespace bm {

// Information: the network the display is on, a QR code that opens the web app (or joins the setup network),
// and the address. ABOUT swaps the code for the display and controller versions. The handle leads back to
// the menu.
class InfoScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tick(const UiState &state, uint32_t frame) override;
    void swiped(lv_dir_t direction) override {
        // Down puts the screen away; up is how every other screen reaches the menu.
        if (direction == LV_DIR_BOTTOM || direction == LV_DIR_TOP)
            host.act(Intent::Back);
    }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    void present(const UiState &state, bool arriving);

    lv_obj_t *label = nullptr;
    lv_obj_t *title = nullptr;
    lv_obj_t *card = nullptr;
    lv_obj_t *qr = nullptr;
    lv_obj_t *address = nullptr;
    lv_obj_t *caption = nullptr;
    lv_obj_t *offline = nullptr;
    lv_obj_t *displayCaption = nullptr;
    lv_obj_t *displayVersion = nullptr;
    lv_obj_t *controllerCaption = nullptr;
    lv_obj_t *controllerVersion = nullptr;
    lv_obj_t *about = nullptr;

    std::string network;     // the name the title was last given
    std::string code;        // the content the card was last asked to draw
    bool scannable = false;  // the card holds a code for `code`
    bool aboutAsked = false; // ABOUT was chosen: versions instead of the code
    uint8_t swap = 0;        // frames until the face that was asked for may appear
};

} // namespace bm

#endif // BETTERMATE_INFO_SCREEN_H
