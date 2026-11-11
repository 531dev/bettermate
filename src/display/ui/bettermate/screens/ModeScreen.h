#ifndef BETTERMATE_MODE_SCREEN_H
#define BETTERMATE_MODE_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// Steam, Water and Grind share one layout. Placeholder until its lane lands.
class ModeScreen : public Screen {
  public:
    enum class Kind : uint8_t { Steam, Water, Grind };
    ModeScreen(Host &host, Kind kind) : Screen(host), kind(kind) {}
    void update(const UiState &state) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    Kind kind;
    lv_obj_t *label = nullptr;
};

} // namespace bm

#endif // BETTERMATE_MODE_SCREEN_H
