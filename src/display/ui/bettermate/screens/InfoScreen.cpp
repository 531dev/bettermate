#include "InfoScreen.h"

namespace bm {
namespace {
// The QR card: white with black modules in every theme. The card's own margin is the code's quiet zone;
// nothing decorative is drawn around it.
constexpr int CARD_X = 166;
constexpr int CARD_Y = 142;
constexpr int CARD_SIZE = 148;
constexpr int CARD_RADIUS = 14;
constexpr int QUIET = 11;
constexpr int CODE_SIZE = CARD_SIZE - 2 * QUIET;
} // namespace

void InfoScreen::build(lv_obj_t *root) {
    label = part(ui::text(root, 240, 84, Type::Label, Tone::Muted, "", 200), 0);
    title = part(ui::text(root, 240, 122, Type::Title, Tone::Ink, "", tokens::DISPLAY_SQUARE), 0);
    ui::clamp(title, tokens::DISPLAY_SQUARE);
    // The caption goes ahead of the code it names: the card's frame then carries the card alone.
    caption = part(ui::text(root, 240, 350, Type::Label, Tone::Muted), 0);

    card = part(ui::card(root, CARD_X, CARD_Y, CARD_SIZE, CARD_SIZE, CARD_RADIUS, Tone::QrGround), 1);
    qr = lv_qrcode_create(card, CODE_SIZE, tone(Tone::QrInk), tone(Tone::QrGround));
    lv_obj_set_pos(qr, QUIET, QUIET);
    // Nothing to scan: one sentence on the code's centre line (sized to its text, so "Wi-Fi" never breaks).
    offline = part(ui::text(root, 240, 224, Type::Body, Tone::Muted, "The machine is not on Wi-Fi."), 1);

    // ABOUT: the two versions take the code's place. A development build's version runs to a second line.
    displayCaption = part(ui::text(root, 240, 170, Type::Label, Tone::Muted, "DISPLAY"), 1);
    displayVersion = part(ui::text(root, 240, 200, Type::Body, Tone::Ink, "", tokens::DISPLAY_SQUARE), 1);
    controllerCaption = part(ui::text(root, 240, 266, Type::Label, Tone::Muted, "CONTROLLER"), 1);
    controllerVersion = part(ui::text(root, 240, 296, Type::Body, Tone::Ink, "", tokens::DISPLAY_SQUARE), 1);

    address = part(ui::text(root, 240, 322, Type::Label, Tone::Ink), 2);
    about = part(ui::textButton(root, 240, 400, 152, "ABOUT"), 2);
    lv_obj_add_event_cb(
        about,
        [](lv_event_t *e) {
            auto *self = static_cast<InfoScreen *>(lv_event_get_user_data(e));
            self->aboutAsked = !self->aboutAsked;
            self->swap = 2;
            self->host.act(Intent::Refresh);
        },
        LV_EVENT_SHORT_CLICKED, this);

    // The design draws no way back. The handle of every other screen stands in, and leads to the menu as
    // it does there; Back keeps the menu's ink disc where it was.
    lv_obj_t *handle =
        part(ui::disc(root, 240, 446, tokens::DISPLAY_TOUCH / 2, &bm_icon_chevron_up_32, Tone::Surface0, Tone::Muted), 2);
    bind(handle, Intent::Back);

    network.clear();
    code.clear();
    scannable = false;
}

void InfoScreen::onEnter(const UiState &state) {
    (void)state;
    aboutAsked = false;
    swap = 0;
}

void InfoScreen::update(const UiState &state) { present(state, false); }

void InfoScreen::tick(const UiState &state, uint32_t frame) {
    (void)frame;
    if (swap != 0 && --swap == 0)
        present(state, true);
}

void InfoScreen::present(const UiState &s, bool arriving) {
    TickRing &ring = host.ring();
    ring.pulse(false);
    ring.busy(false);
    ring.show(TickRing::Layout::None);

    // The host prepares the code's content; the setup network's password is in it and never in a label.
    if (code != s.qrContent) {
        code = s.qrContent;
        scannable = !code.empty() && lv_qrcode_update(qr, code.data(), code.size()) == LV_RES_OK;
    }
    const bool scan = scannable;

    ui::setText(label, s.accessPoint ? "SETUP NETWORK" : scan ? "CONNECTED TO" : "OFFLINE");
    // A clamped label no longer holds its own text, so the name is compared here.
    if (network != s.network) {
        network = s.network;
        ui::setText(title, network.c_str());
    }
    ui::setText(address, s.address.c_str());
    ui::setText(caption, s.accessPoint ? "SCAN TO JOIN" : "SCAN TO OPEN");
    ui::setText(displayVersion, s.displayVersion.c_str());
    ui::setText(controllerVersion, s.controllerVersion.c_str());
    ui::setText(about, aboutAsked ? "NETWORK" : "ABOUT");

    // ABOUT swaps the code for the versions. The face being left is cut at once and the one asked for
    // arrives a frame later, so the swap never repaints both in one frame.
    const bool networkFace = !aboutAsked && swap == 0;
    const bool aboutFace = aboutAsked && swap == 0;
    show(title, scan);
    // The card comes back with a cut: its code cannot step in with it.
    if (arriving && networkFace && scan)
        ui::show(card, true, false);
    show(card, networkFace && scan);
    show(offline, networkFace && !scan);
    show(address, networkFace && scan);
    show(caption, networkFace && scan);
    // A version the display does not know yet is left out with its caption.
    show(displayCaption, aboutFace && !s.displayVersion.empty());
    show(displayVersion, aboutFace && !s.displayVersion.empty());
    show(controllerCaption, aboutFace && !s.controllerVersion.empty());
    show(controllerVersion, aboutFace && !s.controllerVersion.empty());
}

} // namespace bm
