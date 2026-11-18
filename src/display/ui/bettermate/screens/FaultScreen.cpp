#include "FaultScreen.h"

namespace bm {
namespace {
// The ERROR chip as the design draws it: 90 x 36 at y 84, centred.
constexpr int CHIP_WIDTH = 90;
constexpr int CHIP_Y = 84;
constexpr int TITLE_BASELINE = 178;
constexpr int LINE_BASELINE[2] = {222, 252};
constexpr int ACTION_Y = 330;
constexpr int ACTION_WIDTH = 188;

// Title at most 20 characters, naming the part and what happened to it; each line at most 25, first what the
// machine has done, then what to check (DisplayStates, Content). Codes and addresses stay in the web app.
struct Words {
    const char *title;
    const char *lines[2];
    const char *action; // nullptr when no button can help
};

Words words(Fault fault) {
    switch (fault) {
    case Fault::ControllerMissing:
        return {"Controller not found", {"Check power and cable.", "Still trying to connect."}, nullptr};
    case Fault::Runaway:
        // The controller keeps the heater off until it is switched off: restarting the display changes nothing.
        return {"Temperature runaway", {"Heating is off.", "Switch the machine off."}, nullptr};
    case Fault::Link:
        // The link itself failed: a restart of the display builds it again.
        return {"Connection error", {"Brewing is stopped.", "Restart to reconnect."}, "RESTART"};
    case Fault::DisplayOutdated:
        return {"Version mismatch", {"Brewing is blocked.", "Update the display."}, nullptr};
    case Fault::ControllerOutdated:
        return {"Version mismatch", {"Brewing is blocked.", "Update the controller."}, nullptr};
    case Fault::Controller:
    case Fault::None:
    default:
        return {"Controller error", {"Brewing is stopped.", "Switch the machine off."}, nullptr};
    }
}
} // namespace

void FaultScreen::build(lv_obj_t *root) {
    // In the slot at 12 o'clock, as a warning's glyph is, but in danger and not a control: there is nothing to open.
    glyph = part(ui::icon(root, 240, 34, &bm_icon_triangle_alert_28, Tone::Danger), 0);
    chip = part(ui::chip(root, 240 - CHIP_WIDTH / 2, CHIP_Y, "ERROR", Tone::DangerSoft, Tone::Danger), 0);
    lv_obj_set_width(chip, CHIP_WIDTH);
    lv_label_set_long_mode(chip, LV_LABEL_LONG_CLIP);
    // A 20-character title is wider than the text square ("Temperature runaway" is about 290 px), and above the
    // centre the face has room for it: one line across the content width, never wrapped onto the lines below.
    title = part(ui::text(root, 240, TITLE_BASELINE, Type::Title, Tone::Ink, "", tokens::DISPLAY_CONTENT), 0);
    ui::clamp(title, tokens::DISPLAY_CONTENT);
    for (int i = 0; i < 2; ++i)
        lines[i] = part(ui::text(root, 240, LINE_BASELINE[i], Type::Body, Tone::Muted, "", tokens::DISPLAY_SQUARE), 1);
    action = part(ui::pill(root, 240, ACTION_Y, ACTION_WIDTH, "RESTART", Tone::Primary), 2);
    bind(action, Intent::Restart);
}

void FaultScreen::update(const UiState &s) {
    TickRing &ring = host.ring();
    ring.pulse(false);
    ring.busy(false);
    ring.show(TickRing::Layout::None);

    const Words w = words(s.fault);
    ui::setText(title, w.title);
    for (int i = 0; i < 2; ++i) {
        ui::setText(lines[i], w.lines[i] != nullptr ? w.lines[i] : "");
        show(lines[i], w.lines[i] != nullptr);
    }
    if (w.action != nullptr)
        ui::setText(action, w.action);
    show(action, w.action != nullptr);
}

} // namespace bm
