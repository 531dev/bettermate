#include "InfoScreen.h"

namespace bm {

void InfoScreen::build(lv_obj_t *root) {
    buildFrame(root, true);
    ui::setText(modeLabel, "INFORMATION");
    ui::setText(title, "BetterMate");
    network = text(root, 0, 111, Type::Body, Fg::Ink, "", 300);
    address = text(root, 0, 139, Type::Label, Fg::Muted);
    // Always black on white, including a quiet zone, so every display theme remains scannable.
    qr = lv_qrcode_create(root, 160, lv_color_black(), lv_color_white());
    lv_obj_remove_style_all(qr);
    lv_obj_clear_flag(qr, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_border_width(qr, 8, 0);
    lv_obj_set_style_border_color(qr, lv_color_white(), 0);
    lv_obj_set_style_border_opa(qr, LV_OPA_COVER, 0);
    lv_obj_align(qr, LV_ALIGN_TOP_MID, 0, 166);
    qrCaption = text(root, 0, 342, Type::Label, Fg::Primary);
    displayVersion = text(root, 0, 371, Type::Label, Fg::Muted, "", 300);
    controllerVersion = text(root, 0, 394, Type::Label, Fg::Muted, "", 300);
}

void InfoScreen::update(const UiState &state) {
    updateFrame(state, false);
    ui::setText(network, state.network.c_str());
    ui::setText(address, ("IP: " + state.address).c_str());
    ui::setVisible(qr, !state.qrContent.empty());
    ui::setVisible(qrCaption, !state.qrContent.empty());
    ui::setText(qrCaption, state.accessPoint ? "JOIN WIFI" : "OPEN WEB UI");
    if (qrContent != state.qrContent) {
        qrContent = state.qrContent;
        if (!qrContent.empty())
            lv_qrcode_update(qr, qrContent.data(), qrContent.size());
    }
    ui::setText(displayVersion, ("DISPLAY " + state.displayVersion).c_str());
    ui::setText(controllerVersion, ("CONTROLLER " + state.controllerVersion).c_str());
}

} // namespace bm
