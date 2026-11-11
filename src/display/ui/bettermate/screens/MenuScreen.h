#ifndef BETTERMATE_MENU_SCREEN_H
#define BETTERMATE_MENU_SCREEN_H

#include <display/ui/bettermate/LuxuryUI.h>
#include <display/ui/bettermate/Screen.h>

namespace bm {
class MenuScreen : public Screen {
  public:
    using Screen::Screen;
    void onShow(const UiState &state) override;
    void update(const UiState &state) override;
    lv_obj_t *body() override { return pages; }

  protected:
    void build(lv_obj_t *root) override;

  private:
    void enter(int index);
    void layoutPicker();
    void renderPicker();
    lv_obj_t *pages = nullptr;
    lv_obj_t *content = nullptr;
    luxury::Indicators indicators;
    lv_obj_t *picker = nullptr;
    lv_obj_t *endSpace = nullptr;
    lv_obj_t *modes[5]{};
    lv_obj_t *modeLabels[5]{};
    int positions[5]{};
    lv_obj_t *standby = nullptr;
    lv_obj_t *overlay = nullptr;
    lv_obj_t *warningHeading = nullptr;
    lv_obj_t *warningSubtitle = nullptr;
    lv_obj_t *warningRows[WARNING_TYPE_COUNT]{};
    lv_obj_t *warningSeverities[WARNING_TYPE_COUNT]{};
    lv_obj_t *closeButton = nullptr;
    lv_obj_t *closeLabel = nullptr;
    int selected = 0;
    bool grindAvailable = false;
    bool canEnter = false;
};
} // namespace bm
#endif
