#ifndef BETTERMATE_MODE_SCREEN_H
#define BETTERMATE_MODE_SCREEN_H

#include "WorkingScreen.h"

namespace bm {

// Steam heats and starts automatically; Water and Grind expose their stock toggle actions.
// As on the stock screens, the large reading is the target, set with the −/+ beside it. The live
// temperature sits under the mode name and on the rim.
class ModeScreen : public WorkingScreen {
  public:
    enum class Kind { Steam, Water, Grind };
    ModeScreen(Host &host, Kind kind) : WorkingScreen(host), kind(kind) {}
    void onShow(const UiState &state) override;
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    static constexpr int CENTER_Y = 240;
    Kind kind;
    lv_obj_t *hero = nullptr, *unit = nullptr, *current = nullptr;
    lv_obj_t *nudge[2]{};
    lv_obj_t *action = nullptr;
    lv_obj_t *targetSwitch = nullptr, *switchTime = nullptr, *switchWeight = nullptr, *switchDot = nullptr;
    lv_obj_t *scale = nullptr, *weight = nullptr;
    luxury::Readout reading, currentReading;
    luxury::Rim temperatureRim, pressureRim, progressRim;
    luxury::Indicators indicators;
    bool wasStable = true;
};

} // namespace bm
#endif
