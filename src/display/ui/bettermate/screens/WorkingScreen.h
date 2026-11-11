#ifndef BETTERMATE_WORKING_SCREEN_H
#define BETTERMATE_WORKING_SCREEN_H

#include <display/ui/bettermate/Screen.h>
#include <display/ui/bettermate/LuxuryUI.h>

namespace bm {

void formatTime(unsigned long milliseconds, char *buf, size_t size);

// Shared luxury headings and bottom-edge navigation.
class WorkingScreen : public Screen {
  public:
    using Screen::Screen;
    void onShow(const UiState &state) override;
    lv_obj_t *body() override { return content; }

  protected:
    void buildFrame(lv_obj_t *root);
    void updateFrame(const UiState &state, bool allowModeNavigation = true, bool showStopCaption = true);
    lv_obj_t *stepper(lv_obj_t *parent, int x, int y, const char *value, Intent intent);

    lv_obj_t *content = nullptr;
    lv_obj_t *modeLabel = nullptr;
    lv_obj_t *title = nullptr;
    lv_obj_t *menu = nullptr;

  private:
    bool processActive = false;
    bool modeNavigationEnabled = true;
};

} // namespace bm
#endif
