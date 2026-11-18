#include "WarningsScreen.h"

#include <cstdio>
#include <display/core/constants.h>

namespace bm {
namespace {
// The design draws two cards under a label at 112. Three need the room above: the label takes the label zone of
// every screen (86), the cards follow 4 px apart, and the line counting the rest sits over the pill at 340.
constexpr int LABEL_BASELINE = 86;
constexpr int CARD_X = 48;
constexpr int CARD_Y = 104;
constexpr int CARD_WIDTH = 384;
constexpr int CARD_HEIGHT = 64;
constexpr int CARD_PITCH = 68;
constexpr int MORE_BASELINE = 328;
// Inside a card: the chip 14 px in, the sentence 14 px after it, its baseline 40 px down.
constexpr int CHIP_INSET = 14;
constexpr int CHIP_WIDTH[2] = {76, 90}; // WARN, ERROR
constexpr int SENTENCE_BASELINE = 40;
// Frames to wait for the host's screen change before taking a refused answer back.
constexpr uint8_t RETURN_AFTER = 4;

// Within a level: what stops a shot first, then what a person can put right, then what passes by itself.
const WarningType ORDER[] = {WARNING_WATER,         WARNING_SWITCH, WARNING_SCALE_CONNECTED,
                             WARNING_SCALE_BATTERY, WARNING_FLUSH,  WARNING_TEMPERATURE};
} // namespace

void WarningsScreen::build(lv_obj_t *root) {
    label = part(ui::text(root, 240, LABEL_BASELINE, Type::Label, Tone::Muted, "", 284), 0);
    for (unsigned i = 0; i < ROWS; ++i) {
        Row &row = rows[i];
        // A card a rank, from the top: the first comes with the label and the buttons. Two cards in one rank
        // would be a fifth of the panel, and with a reading still stepping in elsewhere over the step's budget.
        row.card = part(ui::card(root, CARD_X, CARD_Y + CARD_PITCH * static_cast<int>(i), CARD_WIDTH, CARD_HEIGHT), i);
        // The chip takes the design's width for its word, and its word never wraps inside it.
        row.chip = ui::chip(row.card, CHIP_INSET, CHIP_INSET, "WARN", Tone::WarningSoft, Tone::Warning);
        lv_obj_set_width(row.chip, CHIP_WIDTH[0]);
        lv_label_set_long_mode(row.chip, LV_LABEL_LONG_CLIP);
        row.sentence = ui::textLeft(row.card, CHIP_INSET + CHIP_WIDTH[0] + CHIP_INSET, SENTENCE_BASELINE, Type::Body, Tone::Ink);
        row.shown = EMPTY;
    }
    // More warnings than cards: the most severe are on the cards and this line counts the rest ("+1 more").
    more = part(ui::text(root, 240, MORE_BASELINE, Type::Body, Tone::Muted, "", 200), 2);
    // No warning left: say so in the middle of where the cards were.
    clear = part(ui::text(root, 240, 216, Type::Title, Tone::Ink, "All clear"), 1);

    pill = part(ui::pill(root, 240, 340, 168, "DONE", Tone::Ink), 0);
    lv_obj_add_event_cb(pill, clicked, LV_EVENT_SHORT_CLICKED, this);
    cancel = part(ui::textButton(root, 240, 440, 152, "CANCEL"), 0);
    lv_obj_add_event_cb(cancel, clicked, LV_EVENT_SHORT_CLICKED, this);
}

void WarningsScreen::onEnter(const UiState &state) {
    (void)state;
    departing = 0;
}

void WarningsScreen::clicked(lv_event_t *e) {
    auto *self = static_cast<WarningsScreen *>(lv_event_get_user_data(e));
    lv_obj_t *target = lv_event_get_current_target(e);
    if (target == self->cancel)
        self->depart(Intent::CancelConfirm, target);
    else
        self->depart(self->confirming ? Intent::Confirm : Intent::Back, target);
}

void WarningsScreen::fill(Row &row, WarningType type, bool error) {
    const uint8_t key = static_cast<uint8_t>(type | (error ? 0x80 : 0));
    if (row.shown == key)
        return;
    if (row.shown == EMPTY || ((row.shown ^ key) & 0x80)) {
        // Status is a word, never color alone: the chip says its level.
        ui::setText(row.chip, error ? "ERROR" : "WARN");
        ui::setFill(row.chip, error ? Tone::DangerSoft : Tone::WarningSoft);
        ui::setTone(row.chip, error ? Tone::Danger : Tone::Warning);
        lv_obj_set_width(row.chip, CHIP_WIDTH[error]);
        lv_obj_set_x(row.sentence, CHIP_INSET + CHIP_WIDTH[error] + CHIP_INSET);
    }
    ui::setText(row.sentence, warningName(type));
    row.shown = key;
}

// The label and the two buttons at rest: a list to read and DONE, or the question with START and CANCEL.
void WarningsScreen::dress(const UiState &s) {
    confirming = s.confirming;
    ui::setText(label, confirming ? "START ANYWAY?" : "BEFORE YOUR NEXT SHOT");
    ui::setPill(pill, confirming ? "START" : "DONE", confirming ? Tone::Primary : Tone::Ink);
    ui::setFill(cancel, Tone::Surface0);
    ui::setTone(cancel, Tone::Ink);
}

void WarningsScreen::update(const UiState &s) {
    TickRing &ring = host.ring();
    ring.pulse(false);
    ring.busy(false);
    ring.show(TickRing::Layout::None);
    // On the way out the cards are going one a frame: nothing here may bring one back.
    if (departing != 0)
        return;

    // The controller asks before it starts a shot despite an error. Both answers are here; one given
    // elsewhere ends the question and the host leaves this screen.
    dress(s);
    show(pill, !confirming || s.canWake);
    show(cancel, confirming);

    // Asleep, the boiler is off and no shot is next: what only matters then is left out, as the glyph on
    // Standby leaves it out (Screen.h, anyWarning).
    const bool asleep = s.mode == MODE_STANDBY;
    unsigned count = 0;
    const auto add = [&](WarningType type, bool error) {
        if (count < ROWS)
            fill(rows[count], type, error);
        ++count;
    };
    for (int error = 1; error >= 0; --error) {
        // A START the controller did not answer heads the warnings: it is what was just tried.
        if (!error && s.noAnswer)
            add(NO_ANSWER, false);
        for (const WarningType type : ORDER) {
            if (!(error ? s.error[type] : s.warn[type]))
                continue;
            if (asleep && (type == WARNING_TEMPERATURE || type == WARNING_FLUSH))
                continue;
            add(type, error != 0);
        }
    }
    for (unsigned i = 0; i < ROWS; ++i)
        show(rows[i].card, i < count);
    if (count > ROWS) {
        char buf[16];
        snprintf(buf, sizeof(buf), "+%u more", count - ROWS);
        ui::setText(more, buf);
    }
    show(more, count > ROWS);
    show(clear, count == 0);
}

void WarningsScreen::depart(Intent intent, lv_obj_t *pressed) {
    if (departing != 0)
        return;
    departFor = intent;
    departing = 1;
    // The button that was pressed stays pressed until the screen is gone: its resting colors become the
    // pressed ones, so letting go repaints nothing.
    if (pressed == pill) {
        ui::setFill(pill, confirming ? Tone::Ink : Tone::Surface2);
        ui::setTone(pill, confirming ? Tone::OnInk : Tone::Ink);
    } else if (pressed == cancel) {
        ui::setFill(cancel, Tone::Ink);
        ui::setTone(cancel, Tone::OnInk);
    }
}

// The cards leave the way they came, backwards: the lowest one and the count, then the middle one, then the top.
bool WarningsScreen::shed(unsigned group) {
    lv_obj_t *const groups[ROWS][2] = {{rows[2].card, more}, {rows[1].card, nullptr}, {rows[0].card, nullptr}};
    bool any = false;
    for (lv_obj_t *obj : groups[group - 1]) {
        if (obj == nullptr)
            continue;
        // Also when it is not on the glass yet: a rank the screen change has still to reveal stays away.
        any = any || ui::shown(obj);
        show(obj, false);
    }
    return any;
}

void WarningsScreen::tick(const UiState &state, uint32_t frame) {
    (void)frame;
    if (departing == 0)
        return;
    // One card a frame. The host hears the answer with the last one, so its cut finds the label and the
    // buttons, and the screen that follows has the frames to itself.
    while (departing <= ROWS) {
        const bool any = shed(departing);
        if (departing++ == ROWS) {
            host.act(departFor);
            return;
        }
        if (any)
            return;
    }
    // Still here: the machine refused. The button lets go now and the cards come back with the next
    // update, a frame later.
    if (++departing > ROWS + RETURN_AFTER) {
        dress(state);
        departing = 0;
        host.act(Intent::Refresh);
    }
}

} // namespace bm
