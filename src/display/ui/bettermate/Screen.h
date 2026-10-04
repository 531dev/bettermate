#ifndef BETTERMATE_SCREEN_H
#define BETTERMATE_SCREEN_H

#include <display/ui/bettermate/Ui.h>
#include <display/ui/bettermate/UiState.h>
#include <lvgl.h>

namespace bm {

enum class Intent : uint8_t {
    Refresh,
    Menu,
    Profile,
    Adjust,
    Start,
    Flush,
    Tare,
    ToggleTarget,
    TempDown,
    TempUp,
    TargetDown,
    TargetUp,
    DeleteWeight,
    Accept,
    Save,
    SaveAsNew,
    CancelConfirm,
    Confirm,
    Finish,
    BrewMode,
    SteamMode,
    WaterMode,
    GrindMode,
    Info,
    Standby,
    ToggleWater,
    ToggleGrind,
    GrindDown,
    GrindUp,
    PreviousProfile,
    NextProfile,
    SelectProfile
};

// What a screen may ask of the UI that owns it. A screen never reaches into the controller or another screen:
// it states an intent here and the owner carries it out.
class Host {
  public:
    // Leave standby and switch the machine on in brew mode.
    virtual void wake() = 0;
    virtual void act(Intent intent) = 0;

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

    // Bindings belong to the screen, not LVGL object's user data (which Ui uses for color roles).
    void bind(lv_obj_t *obj, Intent intent, lv_event_code_t event = LV_EVENT_SHORT_CLICKED) {
        LV_ASSERT(bindingCount < sizeof(bindings) / sizeof(bindings[0]));
        Binding &binding = bindings[bindingCount++];
        binding = {&host, intent};
        lv_obj_add_event_cb(
            obj,
            [](lv_event_t *e) {
                const auto *b = static_cast<Binding *>(lv_event_get_user_data(e));
                b->host->act(b->intent);
            },
            event, &binding);
    }

    Host &host;

  private:
    struct Binding {
        Host *host;
        Intent intent;
    };
    Binding bindings[32]{};
    size_t bindingCount = 0;
    lv_obj_t *rootObj = nullptr;
};

} // namespace bm

#endif // BETTERMATE_SCREEN_H
