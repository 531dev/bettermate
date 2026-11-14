#include "AdjustScreen.h"

#include <cmath>
#include <cstdio>
#include <cstring>

namespace bm {
namespace {
#define BM_DEGREE "\xC2\xB0"
#define BM_MIDDOT "\xC2\xB7"
#define BM_UNSAVED " " BM_MIDDOT " UNSAVED"

// The label face is fixed width, so a glyph count is a width: 21 glyphs are 272 px, as wide as a title gets at
// this height before it nears the rim.
constexpr unsigned TITLE_GLYPHS = 21;
constexpr unsigned UNSAVED_GLYPHS = 10;
constexpr int TITLE_WIDTH = tokens::DISPLAY_SQUARE;

bool startsGlyph(char c) { return (static_cast<unsigned char>(c) & 0xC0) != 0x80; }

unsigned glyphs(const char *utf8) {
    unsigned count = 0;
    for (; *utf8 != '\0'; ++utf8)
        count += startsGlyph(*utf8);
    return count;
}

// How many bytes the first `count` glyphs take.
size_t prefix(const char *utf8, unsigned count) {
    size_t length = 0;
    for (; utf8[length] != '\0'; ++length) {
        if (startsGlyph(utf8[length]) && count-- == 0)
            break;
    }
    return length;
}

// The profile in capitals, and the word that matters once anything changed: "CLASSIC · UNSAVED". The word
// always fits; a name too long for the room that is left ends in "...".
struct Title {
    char text[TITLE_GLYPHS * 4 + sizeof("..." BM_UNSAVED)];

    Title(const char *name, bool unsaved) {
        const unsigned room = unsaved ? TITLE_GLYPHS - UNSAVED_GLYPHS : TITLE_GLYPHS;
        const bool cut = glyphs(name) > room;
        size_t length = prefix(name, cut ? room - 3 : room);
        memcpy(text, name, length);
        while (cut && length > 0 && text[length - 1] == ' ')
            --length;
        text[length] = '\0';
        upper(text);
        snprintf(text + length, sizeof(text) - length, "%s%s", cut ? "..." : "", unsaved ? BM_UNSAVED : "");
    }
};

// "36" or "36.5": grams and seconds carry a decimal only when the recipe has one.
void amount(float value, char *buf, size_t size) {
    snprintf(buf, size, value >= 999.95f || fabsf(value - roundf(value)) < 0.05f ? "%.0f" : "%.1f", value);
}
} // namespace

void AdjustScreen::build(lv_obj_t *root) {
    title = part(ui::text(root, 240, 86, Type::Label, Tone::Muted, "", TITLE_WIDTH), 0);

    static const char *const TWO[] = {"TEMP", "TIME"};
    static const char *const THREE[] = {"TEMP", "BAR", "TIME"};
    const ui::SegRow::Chosen chosen = [](void *context, unsigned index) { static_cast<AdjustScreen *>(context)->choose(index); };
    twoWay.build(root, 106, TWO, 2, chosen, this);
    part(twoWay.obj(), 1);
    threeWay.build(root, 106, THREE, 3, chosen, this);
    part(threeWay.obj(), 1);

    minus = part(ui::disc(root, 82, 250, 30, &bm_icon_minus_28), 2);
    plus = part(ui::disc(root, 398, 250, 30, &bm_icon_plus_28), 2);
    // A tap is one step. Held, a disc steps again once the press counts as long, then keeps repeating.
    for (lv_obj_t *disc : {minus, plus}) {
        for (const lv_event_code_t event :
             {LV_EVENT_PRESSED, LV_EVENT_SHORT_CLICKED, LV_EVENT_LONG_PRESSED, LV_EVENT_LONG_PRESSED_REPEAT}) {
            lv_obj_add_event_cb(
                disc,
                [](lv_event_t *e) {
                    auto *screen = static_cast<AdjustScreen *>(lv_event_get_user_data(e));
                    if (lv_event_get_code(e) == LV_EVENT_PRESSED)
                        screen->pressedByWeight = screen->byWeight;
                    else
                        screen->step(lv_event_get_current_target(e) == screen->plus);
                },
                event, this);
        }
    }

    value.build(root, 240, 284, Type::HeroSm, Tone::Ink);
    part(value.obj(), 0);
    unit = part(ui::text(root, 240, 318, Type::Label, Tone::Muted, "", 48), 0);
    // With the weight focused the unit line is also a control, as the scale line is on Brew: it drops the
    // profile's weight target, and the shot then stops by time.
    useTime = part(ui::labelButton(root, 240, 318, 164, "G " BM_MIDDOT " USE TIME"), 1);
    bind(useTime, Intent::DeleteWeight);
    // A pump-power phase has no pressure to show until the first step gives it one.
    unset = part(ui::text(root, 240, 258, Type::Body, Tone::Muted, "No pressure target"), 0);

    // One pill: DONE while nothing changed, SAVE once something did.
    action = part(ui::pill(root, 240, 344, 176, "DONE", Tone::Ink), 2);
    lv_obj_add_event_cb(
        action,
        [](lv_event_t *e) {
            auto *screen = static_cast<AdjustScreen *>(lv_event_get_user_data(e));
            screen->host.act(screen->changed ? Intent::SaveSheet : Intent::UseOnce);
        },
        LV_EVENT_SHORT_CLICKED, this);
}

void AdjustScreen::onEnter(const UiState &state) {
    // A fresh edit starts on temperature. Coming back from the save sheet keeps the value being edited.
    if (!state.profileDirty)
        focus = Field::Temperature;
}

void AdjustScreen::choose(unsigned index) {
    // Without BAR the stop target is the row's second choice.
    const Field picked = index == 0 ? Field::Temperature : withPressure && index == 1 ? Field::Pressure : Field::Target;
    if (picked == focus)
        return;
    focus = picked;
    host.act(Intent::Refresh);
}

void AdjustScreen::step(bool up) {
    switch (focus) {
    case Field::Temperature:
        host.act(up ? Intent::TempUp : Intent::TempDown);
        break;
    case Field::Pressure:
        host.act(up ? Intent::PressureUp : Intent::PressureDown);
        break;
    case Field::Target:
        // The machine steps the weight when the profile has one and the time otherwise. A weight held down to
        // nothing leaves a timed profile: the press that did it must not go on to shorten the time.
        if (byWeight == pressedByWeight)
            host.act(up ? Intent::TargetUp : Intent::TargetDown);
        break;
    }
}

void AdjustScreen::update(const UiState &s) {
    TickRing &ring = host.ring();
    ring.busy(false);
    ring.pulse(false);
    ring.show(TickRing::Layout::None);

    ui::setText(title, Title(s.profileName.c_str(), s.profileDirty).text);

    // The stop target is the weight when the profile has one and a scale can measure it, otherwise the time.
    // The row calls the weight the yield: WEIGHT is as wide as a third of the row, end to end.
    byWeight = s.profileVolumetric && s.volumetricAvailable;
    withPressure = s.profilePressureEditable;
    if (focus == Field::Pressure && !withPressure)
        focus = Field::Temperature;
    const char *target = byWeight ? "YIELD" : "TIME";
    twoWay.relabel(1, target);
    threeWay.relabel(2, target);
    twoWay.select(focus == Field::Temperature ? 0 : 1);
    threeWay.select(static_cast<unsigned>(focus));
    show(twoWay.obj(), !withPressure);
    show(threeWay.obj(), withPressure);

    char number[12];
    const char *suffix = "";
    bool set = true;
    switch (focus) {
    case Field::Temperature:
        snprintf(number, sizeof(number), "%ld", lroundf(s.targetTemp));
        suffix = BM_DEGREE "C";
        break;
    case Field::Pressure:
        set = s.profilePressureSet;
        snprintf(number, sizeof(number), "%.1f", s.profilePressure);
        suffix = "BAR";
        break;
    case Field::Target:
        amount(byWeight ? s.profileWeight : s.profileDuration, number, sizeof(number));
        suffix = byWeight ? "G" : "S";
        break;
    }
    if (set) {
        value.set(number);
        ui::setText(unit, suffix);
    }

    // Rule 4: a control that cannot act is hidden. Leaving is always possible, so the pill stays.
    const bool usable = s.canWake && !s.active;
    const bool removable = usable && byWeight && focus == Field::Target;
    show(value.obj(), set);
    show(unit, set && !removable);
    show(useTime, removable);
    show(unset, !set);
    show(minus, usable);
    show(plus, usable);
    changed = s.profileDirty;
    ui::setPill(action, changed ? "SAVE" : "DONE", changed ? Tone::Primary : Tone::Ink);
}

} // namespace bm
