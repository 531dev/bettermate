#include "ProfilesScreen.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>

namespace bm {
namespace {
#define BM_DEGREE "\xC2\xB0"

constexpr int NAME_WIDTH = 312;
// Three fact cards with 8 px between them, centred on the panel.
constexpr int CARD_WIDTH = 96;
constexpr int CARD_HEIGHT = 44;
constexpr int CARD_PITCH = 104;
constexpr int CARDS_Y = 194;
constexpr int CARDS_WIDTH = 3 * CARD_PITCH - (CARD_PITCH - CARD_WIDTH);
constexpr int STAGES_WIDTH = tokens::DISPLAY_SQUARE;
constexpr int STAGES_BASELINE = 278;
// Up to seven dots of radius 5, 20 px apart, centred on y 308.
constexpr int DOT_SIZE = 10;
constexpr int DOT_PITCH = 20;
constexpr int DOTS_WIDTH = 6 * DOT_PITCH + DOT_SIZE;
constexpr int DOTS_Y = 308;
constexpr int CHEVRON = tokens::DISPLAY_TOUCH / 2;

// A see-through box on the face. What a page brings or takes away sits inside one: a child comes and goes with
// ui::show(child, visible, false), one repaint of its own box, where a ranked part would step in over three frames.
lv_obj_t *holder(lv_obj_t *root, int x, int y, int width, int height) {
    lv_obj_t *obj = lv_obj_create(root);
    lv_obj_remove_style_all(obj);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_pos(obj, x, y);
    lv_obj_set_size(obj, width, height);
    return obj;
}

// A label of one centred line in a box of fixed width. Its text is cut to fit by setFitted, so LVGL neither
// wraps it nor adds dots of its own.
void oneLine(lv_obj_t *label, Type type, int width) {
    lv_obj_set_size(label, width, font(type)->line_height);
    lv_obj_set_style_text_align(label, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(label, LV_LABEL_LONG_CLIP);
}

// Sets the text of a one-line label, ending in "..." where it stops fitting. LVGL's own dots cut at the last
// whole word, "Blooming..." in room for twice that, and leave the cut text in the label, where a later setText of
// the full name would repaint it on every snapshot. Cut here, the label holds exactly what was set.
void setFitted(lv_obj_t *label, const char *text, Type type, int width) {
    const lv_font_t *face = font(type);
    const int spacing = tracking(type);
    const int dots = 3 * (lv_font_get_glyph_width(face, '.', '.') + spacing);
    int x = 0;
    uint32_t next = 0;
    uint32_t keep = 0; // bytes that leave room for the dots
    while (text[next] != '\0') {
        const uint32_t start = next;
        const uint32_t letter = _lv_txt_encoded_next(text, &next);
        if (x + dots - spacing <= width)
            keep = start;
        x += lv_font_get_glyph_width(face, letter, _lv_txt_encoded_next(&text[next], nullptr)) + spacing;
    }
    if (x - spacing <= width) {
        ui::setText(label, text);
        return;
    }
    char cut[128];
    keep = std::min<uint32_t>(keep, sizeof(cut) - 4);
    while (keep > 0 && ((text[keep] & 0xC0) == 0x80 || text[keep - 1] == ' '))
        --keep;
    memcpy(cut, text, keep);
    memcpy(cut + keep, "...", 4);
    ui::setText(label, cut);
}

// "36" or "36.5": grams and seconds carry a decimal only when the recipe has one.
const char *amount(float value, char *buf, size_t size) {
    snprintf(buf, size, value >= 999.95f || fabsf(value - roundf(value)) < 0.05f ? "%.0f" : "%.1f", value);
    return buf;
}
} // namespace

void ProfilesScreen::build(lv_obj_t *root) {
    cardsPlaced = FACTS;
    dotsPlaced = DOTS;

    // The ranks spread a screen change over its three frames by area. Brew's first frame is its heaviest (its
    // reading goes, and the name that was pressed turns back), so only the label and the chevrons share it:
    // the name comes with the stages and the dots, the facts with the actions.
    label = part(ui::text(root, 240, 86, Type::Label, Tone::Muted, "", 216), 0);
    name = part(ui::text(root, 240, 168, Type::Value, Tone::Ink), 1);
    oneLine(name, Type::Value, NAME_WIDTH);

    lv_obj_t *row = part(holder(root, 240 - CARDS_WIDTH / 2, CARDS_Y, CARDS_WIDTH, CARD_HEIGHT), 2);
    for (unsigned i = 0; i < FACTS; ++i) {
        cards[i] = ui::card(row, static_cast<int>(i) * CARD_PITCH, 0, CARD_WIDTH, CARD_HEIGHT, tokens::RADIUS_MD);
        facts[i] = ui::textLeft(cards[i], 0, 223 - CARDS_Y, Type::Label, Tone::Ink, "", CARD_WIDTH);
        lv_obj_set_style_text_align(facts[i], LV_TEXT_ALIGN_CENTER, 0);
        ui::show(cards[i], false);
    }

    lv_obj_t *line = part(holder(root, 240 - STAGES_WIDTH / 2, STAGES_BASELINE - ascent(Type::Body), STAGES_WIDTH,
                                 font(Type::Body)->line_height),
                          1);
    stages = ui::textLeft(line, 0, ascent(Type::Body), Type::Body, Tone::Muted);
    oneLine(stages, Type::Body, STAGES_WIDTH);
    ui::show(stages, false);

    lv_obj_t *pages = part(holder(root, 240 - DOTS_WIDTH / 2, DOTS_Y - DOT_SIZE / 2, DOTS_WIDTH, DOT_SIZE), 1);
    for (unsigned i = 0; i < DOTS; ++i) {
        dots[i] = ui::card(pages, static_cast<int>(i) * DOT_PITCH, 0, DOT_SIZE, DOT_SIZE, LV_RADIUS_CIRCLE, Tone::Track);
        ui::show(dots[i], false);
    }

    // The chevrons leave at the ends of the list, with the page, so each sits in a holder of its own.
    lv_obj_t *left = part(holder(root, 56 - CHEVRON, 240 - CHEVRON, CHEVRON * 2, CHEVRON * 2), 0);
    previous = ui::disc(left, CHEVRON, CHEVRON, CHEVRON, &bm_icon_chevron_left_28);
    bind(previous, Intent::PreviousProfile);
    lv_obj_t *right = part(holder(root, 424 - CHEVRON, 240 - CHEVRON, CHEVRON * 2, CHEVRON * 2), 0);
    next = ui::disc(right, CHEVRON, CHEVRON, CHEVRON, &bm_icon_chevron_right_28);
    bind(next, Intent::NextProfile);

    select = part(ui::pill(root, 206, 340, 152, "SELECT", Tone::Primary), 2);
    bind(select, Intent::SelectProfile);
    edit = part(ui::disc(root, 322, 372, CHEVRON, &bm_icon_pencil_28), 2);
    bind(edit, Intent::Adjust);
}

void ProfilesScreen::update(const UiState &s) {
    TickRing &ring = host.ring();
    ring.busy(false);
    ring.pulse(false);
    ring.show(TickRing::Layout::None);

    const auto &entries = s.preview.entries;
    const unsigned count = static_cast<unsigned>(entries.size());
    const unsigned index = count > 0 ? std::min(s.preview.index, count - 1) : 0;
    const UiState::ProfilePreview::Entry blank;
    const UiState::ProfilePreview::Entry &entry = count > 0 ? entries[index] : blank;

    char buf[32];
    snprintf(buf, sizeof(buf), "PROFILE %u / %u", index + 1, count);
    ui::setText(label, buf);
    show(label, count > 1);

    setFitted(name, entry.name.c_str(), Type::Value, NAME_WIDTH);
    setFacts(entry);
    // A single phase needs no stage list: the host leaves the summary empty.
    setFitted(stages, entry.summary.c_str(), Type::Body, STAGES_WIDTH);
    ui::show(stages, !entry.summary.empty(), false);
    setDots(index, count);

    ui::show(previous, index > 0, false);
    ui::show(next, index + 1 < count, false);
    // Browsing never touches the machine. Choosing does, so it needs a machine that can take the profile.
    const bool usable = s.canWake && !s.active && !entry.name.empty();
    show(select, usable);
    show(edit, usable);
}

void ProfilesScreen::setFacts(const UiState::ProfilePreview::Entry &entry) {
    // Only what the recipe defines: a timed profile has no yield, and a card never shows a dash.
    char text[FACTS][16];
    char number[12];
    unsigned count = 0;
    if (entry.temperature > 0)
        snprintf(text[count++], sizeof(text[0]), "%ld" BM_DEGREE, lroundf(entry.temperature));
    if (entry.volumetric && entry.weight > 0)
        snprintf(text[count++], sizeof(text[0]), "%s G", amount(entry.weight, number, sizeof(number)));
    if (entry.duration > 0)
        snprintf(text[count++], sizeof(text[0]), "%s S", amount(entry.duration, number, sizeof(number)));

    // The cards are centred as a group. When their number changes each one moves while it is hidden, so it
    // repaints the box it leaves and the box it lands in, once.
    if (count != cardsPlaced) {
        cardsPlaced = count;
        const int left = static_cast<int>(FACTS - count) * CARD_PITCH / 2;
        for (unsigned i = 0; i < FACTS; ++i) {
            ui::show(cards[i], false);
            lv_obj_set_x(cards[i], left + static_cast<int>(i) * CARD_PITCH);
        }
    }
    for (unsigned i = 0; i < FACTS; ++i) {
        if (i < count)
            ui::setText(facts[i], text[i]);
        ui::show(cards[i], i < count, false);
    }
}

void ProfilesScreen::setDots(unsigned index, unsigned count) {
    // One dot a profile and none for a single one. Past seven the row is a window that follows the page.
    const unsigned shown = count > 1 ? std::min(count, DOTS) : 0;
    const unsigned first = count > DOTS ? std::min(index > DOTS / 2 ? index - DOTS / 2 : 0, count - DOTS) : 0;
    if (shown != dotsPlaced) {
        dotsPlaced = shown;
        const int left = (DOTS_WIDTH - DOT_SIZE) / 2 - (static_cast<int>(shown) - 1) * DOT_PITCH / 2;
        for (unsigned i = 0; i < DOTS; ++i) {
            ui::show(dots[i], false);
            lv_obj_set_x(dots[i], left + static_cast<int>(i) * DOT_PITCH);
        }
    }
    for (unsigned i = 0; i < DOTS; ++i) {
        ui::setFill(dots[i], first + i == index ? Tone::Ink : Tone::Track);
        ui::show(dots[i], i < shown, false);
    }
}

void ProfilesScreen::swiped(lv_dir_t direction) {
    if (direction == LV_DIR_LEFT)
        host.act(Intent::NextProfile);
    else if (direction == LV_DIR_RIGHT)
        host.act(Intent::PreviousProfile);
    else if (direction == LV_DIR_BOTTOM)
        host.act(Intent::Back);
}

} // namespace bm
