#ifndef BETTERMATE_UI_H
#define BETTERMATE_UI_H

#include <display/ui/bettermate/screens/BrewScreen.h>
#include <display/ui/bettermate/screens/InfoScreen.h>
#include <display/ui/bettermate/screens/MenuScreen.h>
#include <display/ui/bettermate/screens/ModeScreen.h>
#include <display/ui/bettermate/screens/ProfileScreen.h>
#include <display/ui/bettermate/screens/StandbyScreen.h>
#include <display/ui/bettermate/screens/StatusScreen.h>
#include <display/ui/default/DefaultUI.h>

class Controller;

// Ported screens share the stock event subscriptions and navigation until the display reaches parity.
class BetterMateUI : public DefaultUI, private bm::Host {
  public:
    BetterMateUI(Controller *controller, Driver *driver, PluginManager *pluginManager);
#ifdef GAGGIMATE_SIM
    // Network-mode injection for QR validation; it changes UI state only.
    void simulateNetwork(bool accessPoint) {
        apActive = accessPoint;
        markDirty();
    }
#endif

  protected:
    void onScreenShown(ScreensEnum screen) override;
    void onRendered() override;

  private:
    void wake() override;
    void act(bm::Intent intent) override;
    void focusProfile(unsigned index) override;
    void gather();
    void applyBetterMateTheme();

    bm::UiState state;
    bool openWarnings = false;
    bm::Screen *active = nullptr;
    bm::StandbyScreen standby{*this};
    bm::BrewScreen brew{*this};
    bm::StatusScreen status{*this};
    bm::ModeScreen steam{*this, bm::ModeScreen::Kind::Steam};
    bm::ModeScreen water{*this, bm::ModeScreen::Kind::Water};
    bm::ModeScreen grind{*this, bm::ModeScreen::Kind::Grind};
    bm::MenuScreen menu{*this};
    bm::InfoScreen info{*this};
    bm::ProfileScreen profile{*this};
};

#endif // BETTERMATE_UI_H
