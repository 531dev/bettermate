#ifndef BETTERMATE_UI_H
#define BETTERMATE_UI_H

#include <atomic>
#include <display/core/PluginManager.h>
#include <display/core/utils.h>
#include <display/drivers/Driver.h>
#include <display/models/profile.h>
#include <display/ui/bettermate/Screen.h>
#include <display/ui/bettermate/screens/AdjustScreen.h>
#include <display/ui/bettermate/screens/BrewScreen.h>
#include <display/ui/bettermate/screens/FaultScreen.h>
#include <display/ui/bettermate/screens/InfoScreen.h>
#include <display/ui/bettermate/screens/MenuScreen.h>
#include <display/ui/bettermate/screens/ModeScreen.h>
#include <display/ui/bettermate/screens/ProfilesScreen.h>
#include <display/ui/bettermate/screens/SheetScreen.h>
#include <display/ui/bettermate/screens/ShotScreen.h>
#include <display/ui/bettermate/screens/StandbyScreen.h>
#include <display/ui/bettermate/screens/UpdateScreen.h>
#include <display/ui/bettermate/screens/WarningsScreen.h>
#include <mutex>
#include <vector>

class Controller;

// The round display's UI. It subscribes to the machine's events like any other plugin, snapshots the machine a
// few times a second on its own task, and owns the one LVGL screen: the tick ring plus the parts of each screen.
//
// Time is counted in frames of the panel (Motion.h). Each frame the UI advances what is moving, lets the active
// screen bring itself in line with the snapshot, and then asks LVGL to repaint what changed, once.
class BetterMateUI : private bm::Host {
  public:
    BetterMateUI(Controller *controller, Driver *driver, PluginManager *pluginManager);
    virtual ~BetterMateUI() = default;

    // Subscribes to the machine's events. Controller::setup() calls it once everything else exists.
    void init();
    // One pass of the UI task. The simulator, which has no tasks, calls it from its main loop.
    void loop();
    // One pass of the task that loads favourite profiles from flash, kept off the UI task.
    void loopProfiles();

    void markDirty() { dirty = true; }
    void setBrightness(int brightness) {
        if (panelDriver)
            panelDriver->setBrightness(brightness);
    }
    bool isTaskHealthy() const {
        return is_task_healthy(eTaskGetState(taskHandle)) && is_task_healthy(eTaskGetState(profileTaskHandle));
    }

    // What is on the glass, for the simulator's scripted checks.
    bm::ScreenId screen() const { return current; }
    bool settled() const { return settle >= 3; }
    const bm::TickRing &ringState() const { return tickRing; }
#ifdef GAGGIMATE_SIM
    // Network-mode and panel injection; they change UI state only.
    void simulateNetwork(bool accessPoint) {
        apActive = accessPoint;
        markDirty();
    }
    void simulatePanel(bool amoled) {
        amoledPanel = amoled;
        markDirty();
    }
    // A START the controller never answers (a lost link between the snapshot and the press).
    void simulateUnanswered(bool on) { ignoreStart = on; }
    // What the OTA plugin reports: an update found by the check, and progress while one installs.
    void simulateUpdateReady(const char *version);
    void simulateUpdateProgress(int percent);
    void simulateUpdateStart(int parts);
    void simulateUpdatePhase(int phase);
#endif

  private:
    // bm::Host
    void act(bm::Intent intent) override;
    void focusProfile(unsigned index) override;
    bm::TickRing &ring() override { return tickRing; }

    void request(bm::ScreenId id) {
        requested = static_cast<uint8_t>(id);
        dirty = true;
    }
    void runFrame(unsigned long now);
    // The screen to show for the one asked for: an update or a fault takes the glass while it lasts, and the
    // Wi-Fi setup screen stands in for Standby while the access point is up.
    bm::ScreenId route(bm::ScreenId asked) const;
    // Works out the fault that blocks brewing, if any (currentFault).
    void watchFault(unsigned long now);
    void beginChange(bm::ScreenId next);
    void applyTheme();
    void gather(unsigned long now, bm::ScreenId target);
    void gatherProfile();
    void gatherProcess();
    void gatherNetwork();
    void wake();
    void reloadProfiles() {
        profileLoaded = 0;
        previewDirty = true;
    }

    Controller *controller;
    Driver *panelDriver;
    PluginManager *pluginManager;

    bm::TickRing tickRing;
    bm::UiState state;
    bm::StandbyScreen standby{*this};
    bm::BrewScreen brew{*this};
    bm::ShotScreen shot{*this};
    bm::ModeScreen steam{*this, bm::ModeScreen::Kind::Steam};
    bm::ModeScreen water{*this, bm::ModeScreen::Kind::Water};
    bm::ModeScreen grind{*this, bm::ModeScreen::Kind::Grind};
    bm::MenuScreen menu{*this};
    bm::ProfilesScreen profiles{*this};
    bm::AdjustScreen adjust{*this};
    bm::SheetScreen sheet{*this};
    bm::WarningsScreen warnings{*this};
    bm::InfoScreen info{*this};
    bm::FaultScreen fault{*this};
    bm::UpdateScreen updating{*this};
    bm::InfoScreen setup{*this, true};
    bm::Screen *const screens[static_cast<size_t>(bm::ScreenId::Count)] = {
        &standby, &brew, &shot, &steam, &water, &grind, &menu, &profiles, &adjust, &sheet, &warnings, &info, &fault, &updating, &setup};

    // Screen change: the requested screen may be set from any task; everything else is the UI task's.
    std::atomic<uint8_t> requested{static_cast<uint8_t>(bm::ScreenId::Standby)};
    bm::ScreenId current = bm::ScreenId::Standby;
    bm::ScreenId returnTo = bm::ScreenId::Brew; // where Back leads from Warnings
    bm::Screen *active = nullptr;
    bm::Screen *leaving = nullptr;
    uint8_t settle = 3; // the rank the running change reveals next; 3 once settled
    bool rankConcealed = false; // the old screen has given that rank up already

    // Frames
    uint32_t frame = 0;
    unsigned long nextFrameAt = 0;
    uint32_t lastSnapshot = 0;
    std::atomic<bool> dirty{true};

    // Set by event callbacks on other tasks, read on the UI task.
    std::atomic<bool> updateAvailable{false};
    std::atomic<bool> apActive{false};
    std::atomic<bool> initialized{false};
    std::atomic<bool> confirming{false};
    std::atomic<bool> previewDirty{true};
    std::atomic<float> scaleWeight{0.0f};
    std::atomic<int> updateProgress{-1};
    std::atomic<int> updateParts{1}; // how many parts this update installs (the controller's firmware, the display's)
    std::atomic<int> updatePart{0};  // the one installing now, from 0
    std::mutex versionMutex;
    std::string updateVersion; // under versionMutex: the OTA plugin's task writes it

    // Command pending: START raised a warning when the controller did not answer it.
    std::atomic<bool> noAnswer{false};
    bool ignoreStart = false; // the simulator's stand-in for a controller that does not answer
    // The controller has been missing since this time (0 while it is there): after 5 s it is a fault.
    static constexpr unsigned long MISSING_FAULT_MS = 5000;
    unsigned long missingSince = 0;
    bm::Fault currentFault = bm::Fault::None;

    bool touchFlushHeld = false;
    bool profileDirty = false;
    bool amoledPanel = false;
    int themeMode = -1;
    int menuOrigin = 0;

    // Favourite profiles: the profile task rebuilds these while the UI task reads them.
    std::atomic<int> profileLoaded{0};
    std::mutex profilesMutex;
    std::vector<String> favoritedProfileIds;
    std::vector<Profile> favoritedProfiles;
    int currentProfileIdx = 0;

    // Standby dims the panel after a while.
    unsigned long standbyEnterTime = 0;
    bool dimmed = false;

    xTaskHandle taskHandle = nullptr;
    xTaskHandle profileTaskHandle = nullptr;
    static void loopTask(void *arg);
    static void profileLoopTask(void *arg);
};

#endif // BETTERMATE_UI_H
