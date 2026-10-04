#ifndef BETTERMATE_WORKING_SCREEN_H
#define BETTERMATE_WORKING_SCREEN_H

#include <display/ui/bettermate/Screen.h>
#include <display/ui/bettermate/TickRing.h>

namespace bm {

void formatTime(unsigned long milliseconds, char *buf, size_t size);

// Shared working-screen frame; remaining modes can use the same gauges, pairs and navigation.
class WorkingScreen : public Screen {
  public:
    using Screen::Screen;

  protected:
    void buildFrame(lv_obj_t *root, bool minimal = false);
    void updateFrame(const UiState &state, bool showWarnings = true);
    lv_obj_t *text(lv_obj_t *parent, int x, int y, Type type, Fg color, const char *value = "", int width = 0);
    lv_obj_t *button(lv_obj_t *parent, int x, int y, int size, const lv_img_dsc_t *glyph, Intent intent, Bg color = Bg::Surface2,
                     Fg foreground = Fg::Ink);
    void enable(lv_obj_t *obj, bool enabled);
    void showPairs(bool visible);
    void updatePairs(const UiState &state);

    lv_obj_t *modeLabel = nullptr;
    lv_obj_t *title = nullptr;
    lv_obj_t *menu = nullptr;
    lv_obj_t *pairs = nullptr;
    ui::Badge warning;

  private:
    Gauges gauges;
    bool minimal = false;
    lv_obj_t *singleTemperature = nullptr;
    lv_obj_t *connectivity = nullptr;
    lv_obj_t *wifi = nullptr;
    lv_obj_t *bluetooth = nullptr;
    lv_obj_t *updateIcon = nullptr;
    lv_obj_t *tempCaption = nullptr;
    lv_obj_t *tempValue = nullptr;
    lv_obj_t *tempTarget = nullptr;
    lv_obj_t *pressurePair = nullptr;
    lv_obj_t *pressureValue = nullptr;
    lv_obj_t *pressureTarget = nullptr;
};

} // namespace bm
#endif
