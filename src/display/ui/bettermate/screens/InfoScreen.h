#ifndef BETTERMATE_INFO_SCREEN_H
#define BETTERMATE_INFO_SCREEN_H

#include "WorkingScreen.h"
#include <string>

namespace bm {
class InfoScreen : public WorkingScreen {
  public:
    using WorkingScreen::WorkingScreen;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    lv_obj_t *network = nullptr;
    lv_obj_t *address = nullptr;
    lv_obj_t *qr = nullptr;
    lv_obj_t *qrCaption = nullptr;
    lv_obj_t *displayVersion = nullptr;
    lv_obj_t *controllerVersion = nullptr;
    std::string qrContent;
};
} // namespace bm
#endif
