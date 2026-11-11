#ifndef BETTERMATE_SCREEN_H
#define BETTERMATE_SCREEN_H

#include <display/ui/bettermate/TickRing.h>
#include <display/ui/bettermate/Ui.h>
#include <display/ui/bettermate/UiState.h>
#include <lvgl.h>

namespace bm {

enum class ScreenId : uint8_t { Standby, Brew, Shot, Steam, Water, Grind, Menu, Profiles, Adjust, Sheet, Warnings, Info, Count };

enum class Intent : uint8_t {
    Refresh, // something the screen keeps to itself changed: update on the next frame
    Wake,    // leave standby for the mode menu
    Menu,    // open the mode menu; this stops whatever is running
    Back,    // leave a sub screen for the one it was opened from
    Profiles,
    Adjust,    // edit the focused profile
    SaveSheet, // choose how to keep the edits
    Warnings,
    Info,
    Start,
    Flush, // held: runs until the finger lifts
    Tare,
    ToggleTarget, // grind by time or by weight
    TempDown,
    TempUp,
    PressureDown,
    PressureUp,
    TargetDown,
    TargetUp,
    DeleteWeight, // drop the profile's weight target: stop by time
    Save,
    SaveAsNew,
    UseOnce,
    Confirm, // start the shot despite the warnings
    CancelConfirm,
    Finish, // stop a running shot, or acknowledge a finished one
    BrewMode,
    SteamMode,
    WaterMode,
    GrindMode,
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
    virtual void act(Intent intent) = 0;
    // Browse a profile without changing the machine's selected recipe.
    virtual void focusProfile(unsigned index) = 0;
    // The ring on the rim. A screen says what it should show from update(); screens without a ring say None.
    virtual TickRing &ring() = 0;

  protected:
    ~Host() = default;
};

// One screen: a set of parts on the single LVGL screen. Its parts are built on first use and kept.
//
// A screen change is a cut that settles (motion rule 4). Each part has a rank: 0 for the label and the reading,
// 1 for second-rank values, 2 for the action and the handle. The screen being left gives up one rank a frame
// while the new one takes it, so no frame redraws more than a quarter of the panel. Everything runs on the
// UI task.
class Screen {
  public:
    explicit Screen(Host &host) : host(host) {}
    virtual ~Screen() = default;

    // Become the visible screen: build if needed, start with every part hidden, then update().
    void enter(const UiState &state);
    void reveal(unsigned rank);
    void conceal(unsigned rank);
    // Drop the LVGL objects (theme change); the next enter() builds them again.
    void destroy();

    // Bring the screen in line with the snapshot: texts, tones, which parts show, what the ring carries.
    virtual void update(const UiState &state) = 0;
    // Every frame while visible, for anything that moves between snapshots (a timer, a growing bar).
    virtual void tick(const UiState &state, uint32_t frame) {
        (void)state;
        (void)frame;
    }
    // A tap that hit no control, and a swipe anywhere.
    virtual void tapped() {}
    virtual void swiped(lv_dir_t direction) { (void)direction; }

  protected:
    // Create the parts on `root`. Every object put straight on the root must be registered with part().
    virtual void build(lv_obj_t *root) = 0;
    virtual void onEnter(const UiState &state) { (void)state; }

    // Registers a part with its rank and returns it. A part starts wanted, and hidden until its rank is revealed.
    lv_obj_t *part(lv_obj_t *obj, unsigned rank);
    // Rule 4 of the display: a control that cannot be used is hidden, not greyed. A part that appears once the
    // screen has settled steps in by recolour; one that leaves is cut.
    void show(lv_obj_t *part, bool wanted);
    void bind(lv_obj_t *obj, Intent intent, lv_event_code_t event = LV_EVENT_SHORT_CLICKED);

    // The parts most screens share, each registered with its rank.
    // The handle at 6 o'clock opens the mode menu (rank 2).
    lv_obj_t *addHandle();
    // The exception slot at 12 o'clock: a warning glyph, or an arrow when an update waits (rank 0). Empty when
    // all is normal, and while a process runs so a stray tap at the top can never stop it.
    void addException();
    void updateException(const UiState &state, bool standby = false, bool running = false);

    Host &host;
    lv_obj_t *root = nullptr; // set once the parts exist

  private:
    struct Part {
        lv_obj_t *obj;
        uint8_t rank;
        bool wanted;
    };
    struct Binding {
        Host *host;
        Intent intent;
    };
    Part parts[40]{};
    unsigned partCount = 0;
    Binding bindings[24]{};
    unsigned bindingCount = 0;
    unsigned revealed = 0; // ranks below this are on the glass
    lv_obj_t *warningSlot = nullptr;
    lv_obj_t *updateSlot = nullptr;
};

// Which warnings raise the glyph. Temperature never does: the label and the ring already show heating.
// Standby also leaves out the flush reminder, which only matters before a shot.
bool anyWarning(const UiState &state, bool standby = false);
bool anyError(const UiState &state, bool standby = false);
const char *warningName(WarningType type);

// "m:ss" for a duration in milliseconds.
void formatTime(unsigned long ms, char *buf, size_t size);
// Uppercases ASCII and Latin-1 letters in place: the label and button faces carry capitals only.
void upper(char *utf8);

} // namespace bm

#endif // BETTERMATE_SCREEN_H
