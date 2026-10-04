#ifndef BETTERMATE_MODE_SCREEN_H
#define BETTERMATE_MODE_SCREEN_H

#include "WorkingScreen.h"

namespace bm {

// Steam heats and starts automatically; Water and Grind expose their stock toggle actions.
class ModeScreen : public WorkingScreen {
  public:
    enum class Kind { Steam, Water, Grind };
    ModeScreen(Host &host, Kind kind) : WorkingScreen(host), kind(kind) {}
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    Kind kind;
    lv_obj_t *hero = nullptr;
    lv_obj_t *caption = nullptr;
    lv_obj_t *hint = nullptr;
    lv_obj_t *action = nullptr;
    lv_obj_t *actionIcon = nullptr;
    lv_obj_t *scale = nullptr;
    lv_obj_t *weight = nullptr;
};

} // namespace bm
#endif
