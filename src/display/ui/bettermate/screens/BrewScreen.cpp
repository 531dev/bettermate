#include "BrewScreen.h"

#include <cmath>
#include <cstdio>
#include <display/ui/bettermate/Motion.h>

namespace bm {
namespace {
// 18 characters of screen-title are about 263 px (the design's 14.6 px a character), and 17 with the ellipsis,
// which is wider than a letter, up to about 280: the name gets 284 px, the chevron 4 px after it.
constexpr int PROFILE_WIDTH = 312;
constexpr int PROFILE_HEIGHT = tokens::DISPLAY_TOUCH;
// The name beside its chevron: at most 18 characters (a longer one is cut at 17), and never wider than the
// group leaves it.
constexpr int NAME_LIMIT = PROFILE_WIDTH - 4 - 24;
constexpr unsigned NAME_GLYPHS = 18;
// The name's baseline and the pill's top edge, without and with the scale line between them.
constexpr int NAME_BASELINE[2] = {300, 292};
constexpr int START_Y[2] = {334, 340};
} // namespace

void BrewScreen::build(lv_obj_t *root) {
    // Nothing is laid out yet: forget what the last set of parts showed (a theme change builds again).
    shownName = "\x01";
    withScale = false;
    addException();
    label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "BREW", 216), 0);
    temperature.build(root, 240, 222, Type::Hero, Tone::Ink);
    part(temperature.obj(), 0);
    unit = part(ui::text(root, 240, 254, Type::Label, Tone::Muted, "\xC2\xB0"
                                                                    "C"),
                0);

    // The profile name is a button: it opens Profiles. The chevron beside it says so.
    profile = part(ui::group(root, 240 - PROFILE_WIDTH / 2, NAME_BASELINE[0] - 37, PROFILE_WIDTH, PROFILE_HEIGHT), 1);
    profileName = ui::textLeft(profile, 0, 37, Type::Title, Tone::Ink);
    chevron = ui::icon(profile, 0, PROFILE_HEIGHT / 2, &bm_icon_chevron_right_24, Tone::Muted);
    bind(profile, Intent::Profiles);

    scale = part(ui::labelButton(root, 240, 324, 228, ""), 1);
    bind(scale, Intent::Tare);

    start = part(ui::pill(root, 240, START_Y[0], 188, "START", Tone::Primary), 2);
    lv_obj_add_event_cb(start, started, LV_EVENT_SHORT_CLICKED, this);
    // Held, the same pill flushes until the finger lifts.
    bind(start, Intent::Flush, LV_EVENT_LONG_PRESSED);
    handle = addHandle();
    pending = Pending::None;
}

void BrewScreen::onEnter(const UiState &state) {
    (void)state;
    if (pending != Pending::None)
        settle();
}

void BrewScreen::started(lv_event_t *e) {
    auto *self = static_cast<BrewScreen *>(lv_event_get_user_data(e));
    if (self->pending != Pending::None)
        return; // STARTING is not a second START
    self->pending = Pending::Pressed;
    self->pressedAt = self->frameNow;
    self->host.act(Intent::Start);
}

void BrewScreen::settle() {
    pending = Pending::None;
    ui::setPill(start, "START", Tone::Primary);
    show(handle, true);
}

void BrewScreen::tick(const UiState &state, uint32_t frame) {
    (void)state;
    frameNow = frame;
    if (pending == Pending::None)
        return;
    const uint32_t since = frame - pressedAt;
    if (pending == Pending::Pressed && since >= motion::PRESS_FRAMES) {
        // The press is over and nothing has answered yet: the quiet pill, in one frame of its own box (motion:
        // Pending pill). The handle goes a frame later, so neither frame repaints more than the pill.
        pending = Pending::Waiting;
        ui::setPill(start, "STARTING", Tone::Surface2);
        ui::setTone(start, Tone::Muted);
    } else if (pending == Pending::Waiting && since >= motion::PRESS_FRAMES + motion::ANSWER_FRAMES) {
        // Nothing waits forever (product-states.md, Time limits): START comes back and a warning says why.
        settle();
        host.act(Intent::Unanswered);
    } else if (pending == Pending::Waiting) {
        show(handle, false);
    }
}

void BrewScreen::update(const UiState &s) {
    char buf[48];
    const bool heating = !s.temperatureStable && s.targetTemp > 0;

    TickRing &ring = host.ring();
    const TickRing::Arc boiler{TickRing::fraction(s.currentTemp, TickRing::MAX_TEMPERATURE),
                               s.targetTemp > 0 ? TickRing::fraction(s.targetTemp, TickRing::MAX_TEMPERATURE) : -1.0f, Tone::Heat};
    ring.busy(false);
    ring.pulse(heating && s.currentTemp < s.targetTemp);
    // Without a pressure sensor temperature keeps the whole ring.
    if (s.pressureAvailable)
        ring.show(TickRing::Layout::Split, boiler, {TickRing::fraction(s.pressure, TickRing::MAX_PRESSURE), -1.0f, Tone::Primary});
    else
        ring.show(TickRing::Layout::Single, boiler);

    if (heating)
        snprintf(buf, sizeof(buf), "%s TO %ld\xC2\xB0", s.currentTemp < s.targetTemp ? "HEATING" : "COOLING", lroundf(s.targetTemp));
    else
        snprintf(buf, sizeof(buf), "BREW");
    ui::setText(label, buf);
    ui::setTone(label, heating ? Tone::HeatText : Tone::Muted);

    snprintf(buf, sizeof(buf), "%ld", lroundf(s.currentTemp));
    temperature.set(buf);

    // Name and chevron read as one centred group, the chevron 4 px after the name. A name too long for the
    // group is cut and ends in an ellipsis.
    if (shownName != s.profileName || withScale != s.bluetoothScale) {
        shownName = s.profileName;
        withScale = s.bluetoothScale;
        char fitted[64];
        const int width = ui::fit(Type::Title, shownName.c_str(), NAME_LIMIT, fitted, sizeof(fitted), NAME_GLYPHS);
        ui::setText(profileName, fitted);
        const int left = (PROFILE_WIDTH - (width + 4 + 24)) / 2;
        lv_obj_set_x(profileName, left);
        lv_obj_set_x(chevron, left + width + 4);
        lv_obj_set_y(profile, NAME_BASELINE[withScale] - 37);
        lv_obj_set_y(start, START_Y[withScale]);
    }

    // With a scale connected one line carries its weight; a tap tares it.
    snprintf(buf, sizeof(buf), "%.1f G \xC2\xB7 TARE", s.weight);
    ui::setText(scale, buf);
    show(scale, s.bluetoothScale);
    show(start, s.canWake);
    updateException(s);
}

} // namespace bm
