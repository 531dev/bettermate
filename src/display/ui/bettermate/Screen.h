#ifndef BETTERMATE_SCREEN_H
#define BETTERMATE_SCREEN_H

#include <display/ui/bettermate/Ui.h>
#include <display/ui/bettermate/UiState.h>
#include <lvgl.h>

namespace bm {

// What a screen may ask of the UI that owns it. A screen never reaches into the controller or another screen:
// it states an intent here and the owner carries it out.
class Host {
  public:
    // Leave standby and switch the machine on in brew mode.
    virtual void wake() = 0;

  protected:
    ~Host() = default;
};

// One full-screen view. Its objects are built on first use and kept; update() only touches what changed.
// Everything here runs on the UI task.
class Screen {
  public:
    explicit Screen(Host &host) : host(host) {}
    virtual ~Screen() = default;

    lv_obj_t *root() {
        if (rootObj == nullptr) {
            rootObj = ui::screen();
            build(rootObj);
        }
        return rootObj;
    }

    // The screen has just become the visible one.
    virtual void onShow(const UiState &state) { (void)state; }
    // Bring the screen in line with the snapshot.
    virtual void update(const UiState &state) = 0;

  protected:
    virtual void build(lv_obj_t *root) = 0;

    Host &host;

  private:
    lv_obj_t *rootObj = nullptr;
};

} // namespace bm

#endif // BETTERMATE_SCREEN_H
