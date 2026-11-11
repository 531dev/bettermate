#ifndef BETTERMATE_INFO_SCREEN_H
#define BETTERMATE_INFO_SCREEN_H

#include "WorkingScreen.h"
#include <string>

namespace bm {
// The connection QR is the one thing to look at; versions wait behind ABOUT.
class InfoScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void onShow(const UiState &state) override;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *address = nullptr;
    lv_obj_t *qr = nullptr;
    lv_obj_t *qrCaption = nullptr;
    lv_obj_t *offline = nullptr;
    lv_obj_t *about = nullptr;
    lv_obj_t *versions = nullptr;
    lv_obj_t *displayCaption = nullptr, *displayVersion = nullptr;
    lv_obj_t *controllerCaption = nullptr, *controllerVersion = nullptr;
    std::string qrContent;
    bool showingAbout = false;
};
} // namespace bm
#endif
