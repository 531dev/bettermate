#ifndef BETTERMATE_UI_H
#define BETTERMATE_UI_H

#include <display/ui/bettermate/screens/StandbyScreen.h>
#include <display/ui/default/DefaultUI.h>

class Controller;

// Ported screens share the stock event subscriptions and navigation until the display reaches parity.
class BetterMateUI : public DefaultUI, private bm::Host {
  public:
    BetterMateUI(Controller *controller, Driver *driver, PluginManager *pluginManager);

  protected:
    void onScreenShown(ScreensEnum screen) override;
    void onRendered() override;

  private:
    void wake() override;
    void gather();
    void applyBetterMateTheme();

    bm::UiState state;
    bm::Screen *active = nullptr;
    bm::StandbyScreen standby{*this};
};

#endif // BETTERMATE_UI_H
