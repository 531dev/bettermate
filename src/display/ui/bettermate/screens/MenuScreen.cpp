#include "MenuScreen.h"

#include <cmath>
#include <display/core/constants.h>

namespace bm {
namespace {
constexpr float DEG = 3.14159265358979323846f / 180.0f;
constexpr int CENTRE = tokens::DISPLAY_SIZE / 2;
constexpr int ORBIT = 134;       // the circle the mode discs sit on
constexpr int RADIUS = 58;       // a 116 px disc
constexpr int POWER_RADIUS = 44; // the power disc at the centre
constexpr int GLYPH_RISE = 14;   // the icon's centre above the disc's
constexpr int NAME_DROP = 32;    // the name's baseline below it
// The exception slot is a 56 px touch disc (Screen::addException). Here it sits at 6 o'clock, where the other
// screens keep the handle, so nothing crowds the top disc.
constexpr int SLOT_Y = 446;
constexpr int SLOT_RADIUS = tokens::DISPLAY_TOUCH / 2;
// Frames to wait for the host's screen change before taking a refused tap back.
constexpr uint8_t RETURN_AFTER = 4;

struct Entry {
    const char *name;
    const lv_img_dsc_t *glyph;
    Intent intent;
    int mode; // the machine mode this disc stands for, or -1
    // Top and centre first, then the sides, then the bottom: two discs a frame at most.
    uint8_t rank;
};
// Clockwise from 12 o'clock, as the design orders them.
const Entry ENTRIES[] = {
    {"BREW", &bm_icon_coffee_36, Intent::BrewMode, MODE_BREW, 0},   {"STEAM", &bm_icon_wind_36, Intent::SteamMode, MODE_STEAM, 1},
    {"WATER", &bm_icon_droplet_36, Intent::WaterMode, MODE_WATER, 2}, {"GRIND", &bm_icon_bean_36, Intent::GrindMode, MODE_GRIND, 2},
    {"INFO", &bm_icon_info_36, Intent::Info, -1, 1},
};

constexpr uint8_t only(unsigned item) { return static_cast<uint8_t>(1u << item); }
} // namespace

void MenuScreen::build(lv_obj_t *root) {
    // The slot goes in first, so a disc at 6 o'clock (four discs, no grinder) is drawn over the upper edge of
    // the slot's touch disc: the disc ends at y 431 and the 28 px glyph starts at y 432, and nothing of either
    // is covered. Five discs leave the slot clear.
    addException(SLOT_Y);
    for (unsigned i = 0; i < ItemCount; ++i) {
        const Entry &entry = ENTRIES[i];
        Disc &disc = discs[i];
        disc.obj = part(ui::disc(root, CENTRE, CENTRE - ORBIT, RADIUS, nullptr, Tone::Surface1), entry.rank);
        disc.glyph = ui::icon(disc.obj, RADIUS, RADIUS - GLYPH_RISE, entry.glyph, Tone::Ink);
        disc.name = ui::text(disc.obj, CENTRE, RADIUS + NAME_DROP, Type::Label, Tone::Muted, entry.name);
        lv_obj_add_flag(disc.obj, LV_OBJ_FLAG_ADV_HITTEST);
        lv_obj_add_event_cb(disc.obj, hitTest, LV_EVENT_HIT_TEST, this);
        lv_obj_add_event_cb(disc.obj, clicked, LV_EVENT_SHORT_CLICKED, this);
    }
    power = part(ui::disc(root, CENTRE, CENTRE, POWER_RADIUS, &bm_icon_power_36, Tone::Surface2), 0);
    powerGlyph = lv_obj_get_child(power, 0);
    lv_obj_add_event_cb(power, clicked, LV_EVENT_SHORT_CLICKED, this);
    placed = UNPLACED;
}

void MenuScreen::onEnter(const UiState &state) {
    (void)state;
    entering = true;
    regroup = 0;
    departing = 0;
    departWith = NONE;
}

// A disc answers inside its circle, not in the corners of its box. Where a bottom disc runs under the slot's
// touch disc the slot answers: a finger that lands low on the glyph still opens what the glyph stands for.
void MenuScreen::hitTest(lv_event_t *e) {
    const auto *self = static_cast<const MenuScreen *>(lv_event_get_user_data(e));
    lv_hit_test_info_t *info = lv_event_get_hit_test_info(e);
    lv_area_t box;
    lv_obj_get_coords(lv_event_get_target(e), &box);
    const auto within = [info](int cx, int cy, int radius) {
        const int dx = info->point->x - cx;
        const int dy = info->point->y - cy;
        return dx * dx + dy * dy <= radius * radius;
    };
    info->res = within(box.x1 + RADIUS, box.y1 + RADIUS, RADIUS) && !(self->slotShown && within(CENTRE, SLOT_Y, SLOT_RADIUS));
}

void MenuScreen::clicked(lv_event_t *e) {
    auto *self = static_cast<MenuScreen *>(lv_event_get_user_data(e));
    const lv_obj_t *target = lv_event_get_current_target(e);
    if (target == self->power) {
        self->depart(Intent::Standby, POWER);
        return;
    }
    for (unsigned i = 0; i < ItemCount; ++i) {
        if (target == self->discs[i].obj)
            self->depart(ENTRIES[i].intent, static_cast<int8_t>(i));
    }
}

// Spaces the discs of `set` evenly on the circle, the first at 12 o'clock.
void MenuScreen::place(uint8_t set) {
    unsigned count = 0;
    for (unsigned i = 0; i < ItemCount; ++i)
        count += (set >> i) & 1;
    unsigned at = 0;
    for (unsigned i = 0; i < ItemCount; ++i) {
        if (!(set & only(i)))
            continue;
        const float angle = (-90.0f + 360.0f * static_cast<float>(at++) / static_cast<float>(count)) * DEG;
        const int cx = static_cast<int>(lroundf(CENTRE + ORBIT * cosf(angle)));
        const int cy = static_cast<int>(lroundf(CENTRE + ORBIT * sinf(angle)));
        lv_obj_set_pos(discs[i].obj, cx - RADIUS, cy - RADIUS);
    }
    placed = set;
}

void MenuScreen::update(const UiState &s) {
    TickRing &ring = host.ring();
    ring.pulse(false);
    ring.busy(false);
    ring.show(TickRing::Layout::None);
    // On the way out the discs are going one rank a frame: nothing here may bring one back.
    if (departing != 0)
        return;

    // Rule 4: a mode that cannot be entered is away, not greyed. Info and Standby always answer.
    uint8_t set = only(Info);
    if (s.canWake)
        set |= only(Brew) | only(Steam) | only(Water) | (s.grindAvailable ? only(Grind) : 0);
    asked = set;
    if (entering) {
        // Every part is still hidden: the discs take their places before the first one shows.
        entering = false;
        if (set != placed)
            place(set);
    } else if (set != placed && regroup == 0) {
        // The set changed on the glass. The discs that move leave now, in one frame, and tick() brings
        // them back re-spaced a rank a frame, like a screen change.
        conceal(1);
        conceal(2);
        regroup = 1;
    }

    // Ink is the mode the menu was opened from. Reached from Standby by way of Information, there is none.
    active = NONE;
    for (unsigned i = 0; i < ItemCount && s.mode != MODE_STANDBY; ++i) {
        if (ENTRIES[i].mode == s.menuOrigin && (set & only(i)))
            active = static_cast<int8_t>(i);
    }
    for (unsigned i = 0; i < ItemCount; ++i) {
        dress(static_cast<int8_t>(i), false);
        show(discs[i].obj, set & only(i));
    }
    dress(POWER, false);
    // While the outer ranks are away show() only notes what is wanted; the one top-rank disc leaves by hand.
    if (!(set & only(Brew)))
        ui::show(discs[Brew].obj, false);

    // The glyph follows the list it opens: asleep, both leave out what only matters before a shot.
    const bool asleep = s.mode == MODE_STANDBY;
    updateException(s, asleep);
    slotShown = anyWarning(s, asleep) || s.updateAvailable;
}

// A disc at rest (the ink one inverted, the power disc on surface-2), or as a press leaves it: ink for a
// resting disc, a plain disc for the ink one (Ui.cpp, press).
void MenuScreen::dress(int8_t item, bool pressed) {
    if (item == POWER) {
        ui::setFill(power, pressed ? Tone::Ink : Tone::Surface2);
        ui::setTone(powerGlyph, pressed ? Tone::OnInk : Tone::Ink);
        return;
    }
    if (item == NONE)
        return;
    const Disc &disc = discs[item];
    const bool on = item == active;
    // Inverted either by being the ink disc or by the press, not by both.
    const bool inverted = on != pressed;
    ui::setFill(disc.obj, inverted ? Tone::Ink : pressed ? Tone::Surface2 : Tone::Surface1);
    ui::setTone(disc.glyph, inverted ? Tone::OnInk : Tone::Ink);
    ui::setTone(disc.name, inverted ? Tone::OnInk : pressed ? Tone::Ink : Tone::Muted);
}

void MenuScreen::depart(Intent intent, int8_t pressed) {
    if (departing != 0 || regroup != 0)
        return;
    departFor = intent;
    departWith = pressed;
    departing = 1;
    // The disc that was pressed stays as it is, pressed, until it leaves: its resting colors become the
    // pressed ones, so letting go repaints nothing.
    dress(pressed, true);
}

// Group 1 is the bottom rank, group 2 the sides: the way they came, backwards. The pressed disc waits for
// the last group. Returns whether anything left the glass.
bool MenuScreen::shed(unsigned group) {
    bool any = false;
    for (unsigned i = 0; i < ItemCount; ++i) {
        const bool pressed = static_cast<int8_t>(i) == departWith;
        const unsigned rank = ENTRIES[i].rank;
        if (group == 1 ? rank == 2 && !pressed : rank == 1 || (rank == 2 && pressed)) {
            // Also when it is not on the glass yet: a rank the screen change has still to reveal stays away.
            any = any || ui::shown(discs[i].obj);
            show(discs[i].obj, false);
        }
    }
    return any;
}

void MenuScreen::tick(const UiState &state, uint32_t frame) {
    (void)state;
    (void)frame;
    if (departing != 0) {
        // One group a frame. The host hears of the change with the last one, so its cut finds only the
        // top rank left: the top disc, the power disc and the slot.
        while (departing <= 2) {
            const bool any = shed(departing);
            if (departing++ == 2) {
                host.act(departFor);
                return;
            }
            if (any)
                return;
        }
        // Still here: the machine refused. The pressed disc lets go now and the rest come back with the
        // next update, a frame later.
        if (++departing > 2 + RETURN_AFTER) {
            dress(departWith, false);
            departing = 0;
            departWith = NONE;
            host.act(Intent::Refresh);
        }
        return;
    }
    switch (regroup) {
    case 0:
        return;
    case 1:
        place(asked);
        reveal(0);
        break;
    case 2:
        reveal(1);
        break;
    default:
        reveal(2);
        regroup = 0;
        return;
    }
    ++regroup;
}

void MenuScreen::swiped(lv_dir_t direction) {
    // Down puts the menu away: back to the mode it was opened from, as a tap on the ink disc does.
    if (direction == LV_DIR_BOTTOM)
        depart(active != NONE ? ENTRIES[active].intent : Intent::Back, NONE);
}

} // namespace bm
