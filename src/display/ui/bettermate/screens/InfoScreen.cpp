#include "InfoScreen.h"

namespace bm {

void InfoScreen::build(lv_obj_t *root) {
    buildFrame(root);
    lv_obj_align(modeLabel, LV_ALIGN_TOP_MID, 0, 62);
    lv_obj_set_style_text_font(title, &bm_luxury_mode, 0);
    lv_obj_set_height(title, 38);
    lv_obj_align(title, LV_ALIGN_TOP_MID, 0, 84);
    address = luxury::label(content, 0, 124, &bm_luxury_detail, "", 300, 1);
    // Keep a real white quiet zone in every theme; decorative borders impair scanning.
    qr = lv_qrcode_create(content, 152, lv_color_black(), lv_color_white());
    lv_obj_remove_style_all(qr);
    lv_obj_clear_flag(qr, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_border_width(qr, 8, 0);
    lv_obj_set_style_border_color(qr, lv_color_white(), 0);
    lv_obj_set_style_border_opa(qr, LV_OPA_COVER, 0);
    lv_obj_align(qr, LV_ALIGN_TOP_MID, 0, 156);
    qrCaption = luxury::label(content, 0, 336, &bm_luxury_detail, "", 300, 2);
    offline = luxury::label(content, 0, 222, &bm_luxury_body, "Connect to Wi-Fi to show a code", 260);
    lv_label_set_long_mode(offline, LV_LABEL_LONG_WRAP);

    versions = ui::box(content);
    lv_obj_set_size(versions, 300, 150);
    lv_obj_align(versions, LV_ALIGN_TOP_MID, 0, 166);
    displayCaption = luxury::label(versions, 0, 0, &bm_luxury_detail, "DISPLAY", 280, 2);
    displayVersion = luxury::label(versions, 0, 22, &bm_luxury_body, "", 280);
    controllerCaption = luxury::label(versions, 0, 72, &bm_luxury_detail, "CONTROLLER", 280, 2);
    controllerVersion = luxury::label(versions, 0, 94, &bm_luxury_body, "", 280);
    lv_obj_add_flag(versions, LV_OBJ_FLAG_HIDDEN);

    about = luxury::textButton(content, 240, 386, 140, "ABOUT");
    lv_obj_add_event_cb(about, [](lv_event_t *e) {
        auto *screen = static_cast<InfoScreen *>(lv_event_get_user_data(e));
        screen->showingAbout = !screen->showingAbout;
        screen->host.act(Intent::Refresh);
    }, LV_EVENT_SHORT_CLICKED, this);
}

void InfoScreen::onShow(const UiState &state) {
    showingAbout = false;
    luxury::Instant now;
    update(state);
}

void InfoScreen::update(const UiState &s) {
    updateFrame(s);
    const auto p = luxury::palette();
    const bool online = !s.qrContent.empty();
    ui::setText(modeLabel, s.accessPoint ? "SETUP NETWORK" : online ? "CONNECTED TO" : "OFFLINE");
    ui::setText(title, online ? s.network.c_str() : "Not connected");
    ui::setText(address, s.address.c_str());
    ui::setText(qrCaption, s.accessPoint ? "SCAN TO JOIN" : "SCAN TO OPEN");
    if (qrContent != s.qrContent) {
        qrContent = s.qrContent;
        if (!qrContent.empty())
            lv_qrcode_update(qr, qrContent.data(), qrContent.size());
    }
    luxury::fade(address, online && !showingAbout, luxury::MOTION_STATE);
    luxury::fade(qr, online && !showingAbout, luxury::MOTION_STATE);
    luxury::fade(qrCaption, online && !showingAbout, luxury::MOTION_STATE);
    luxury::fade(offline, !online && !showingAbout, luxury::MOTION_STATE);
    luxury::fade(versions, showingAbout, luxury::MOTION_STATE);
    ui::setText(displayVersion, s.displayVersion.c_str());
    ui::setText(controllerVersion, s.controllerVersion.c_str());
    ui::setText(lv_obj_get_child(about, 0), showingAbout ? "NETWORK" : "ABOUT");

    luxury::color(address, p.muted);
    luxury::color(qrCaption, p.accent);
    luxury::color(offline, p.muted);
    luxury::color(displayCaption, p.faint);
    luxury::color(controllerCaption, p.faint);
    luxury::color(displayVersion, p.ink);
    luxury::color(controllerVersion, p.ink);
    luxury::color(lv_obj_get_child(about, 0), p.muted);
}

} // namespace bm
