#include "MenuScreen.h"

namespace bm {

void MenuScreen::build(lv_obj_t *root) {
    buildFrame(root, true);
    ui::setText(modeLabel, "MENU");
    ui::setText(title, "Choose a mode");
    ui::setVisible(menu, false);
    brew = button(root, 145, 155, 72, &bm_icon_coffee_48, Intent::BrewMode, Bg::Primary, Fg::OnPrimary);
    steam = button(root, 335, 155, 72, &bm_icon_wind_48, Intent::SteamMode, Bg::Heat, Fg::OnHeat);
    water = button(root, 335, 330, 72, &bm_icon_droplet_48, Intent::WaterMode);
    grind = button(root, 145, 330, 72, &bm_icon_bean_48, Intent::GrindMode);
    brewLabel = text(root, -95, 201, Type::Label, Fg::Ink, "BREW");
    steamLabel = text(root, 95, 201, Type::Label, Fg::Ink, "STEAM");
    waterLabel = text(root, 95, 376, Type::Label, Fg::Ink, "WATER");
    grindLabel = text(root, -95, 376, Type::Label, Fg::Ink, "GRIND");
    button(root, 240, 260, 56, &bm_icon_info_24, Intent::Info);
    button(root, 240, 450, 56, &bm_icon_power_24, Intent::Standby, Bg::Surface0, Fg::Muted);
}

void MenuScreen::update(const UiState &state) {
    updateFrame(state);
    ui::setVisible(grind, state.grindAvailable);
    ui::setVisible(grindLabel, state.grindAvailable);
    // Keep the three modes balanced when there is no configured grinder.
    lv_obj_set_pos(water, (state.grindAvailable ? 335 : 240) - 36, 330 - 36);
    lv_obj_align(waterLabel, LV_ALIGN_TOP_MID, state.grindAvailable ? 95 : 0, 376);
    enable(brew, state.canWake);
    enable(steam, state.canWake);
    enable(water, state.canWake);
    enable(grind, state.canWake);
}

} // namespace bm
