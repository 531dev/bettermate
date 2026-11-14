#include "TickRing.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <display/ui/bettermate/Motion.h>
#include <display/ui/bettermate/Ui.h>

namespace bm {
namespace {
constexpr float DEG = 3.14159265358979323846f / 180.0f;
constexpr int CENTRE = tokens::DISPLAY_SIZE / 2;
constexpr int PAD = tokens::RING_TICK / 2 + 1; // round caps plus antialiasing

struct Geometry {
    float start, sweep;
};
constexpr Geometry ARCS[3] = {{110.0f, 140.0f}, {70.0f, -140.0f}, {120.0f, 300.0f}};

lv_point_t point(float degrees, int radius) {
    return {static_cast<lv_coord_t>(lroundf(CENTRE + radius * cosf(degrees * DEG))),
            static_cast<lv_coord_t>(lroundf(CENTRE + radius * sinf(degrees * DEG)))};
}

uint8_t code(Tone tone) { return static_cast<uint8_t>(tone) + 1; }
bool lit(uint8_t c) { return c != 0 && (c & 0x7f) != code(Tone::Track); }
} // namespace

constexpr TickRing::Span TickRing::SPANS[3];

float TickRing::fraction(float value, float max) {
    return std::isfinite(value) && max > 0 ? std::clamp(value / max, 0.0f, 1.0f) : 0.0f;
}

void TickRing::build(lv_obj_t *parent) {
    // The design's radii are for a 480 px panel. On a smaller one the stage overhangs the glass (7 px a side on
    // the 466 px AMOLED boards), and ticks drawn out to 234 would be cut by the round edge. There the outer ends
    // come in by the overhang, so the round caps keep their 3 px to the edge; the inner ends and the notch stay
    // where every screen is laid out against them.
    lv_disp_t *display = lv_obj_get_disp(parent);
    const int glass = std::min<int>(lv_disp_get_hor_res(display), lv_disp_get_ver_res(display));
    const int outer = tokens::RING_OUTER - std::max(0, (tokens::DISPLAY_SIZE - glass) / 2);
    for (unsigned a = 0; a < 3; ++a) {
        const Span &span = SPANS[a];
        for (unsigned i = 0; i < span.count; ++i) {
            const float degrees = ARCS[a].start + ARCS[a].sweep * i / (span.count - 1);
            ticks[span.first + i] = {point(degrees, outer), point(degrees, tokens::RING_INNER),
                                     point(degrees, tokens::RING_NOTCH)};
        }
    }
    obj = lv_obj_create(parent);
    lv_obj_remove_style_all(obj);
    lv_obj_set_size(obj, tokens::DISPLAY_SIZE, tokens::DISPLAY_SIZE);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_event_cb(obj, drawEvent, LV_EVENT_DRAW_MAIN, this);
}

void TickRing::show(Layout newLayout, const Arc &first, const Arc &second) {
    layout = newLayout;
    arcs[0] = first;
    arcs[1] = second;
    plan();
}

void TickRing::pulse(bool on) {
    if (pulsing == on)
        return;
    pulsing = on;
    soft = false;
    plan();
}

void TickRing::busy(bool on) {
    if (comet == on)
        return;
    comet = on;
    plan();
}

void TickRing::fill(const Span &span, const Arc &arc, bool pulse, uint8_t *out) const {
    const int n = span.count;
    const int on = std::clamp(static_cast<int>(lroundf(arc.value * n)), 0, n);
    const int notch = arc.target < 0 ? -1 : std::clamp(static_cast<int>(lroundf(arc.target * (n - 1))), 0, n - 1);
    for (int i = 0; i < n; ++i)
        out[span.first + i] = code(i < on ? arc.tone : Tone::Track) | (i == notch ? NOTCH : 0);
    if (pulse && soft && on > 0 && on - 1 != notch)
        out[span.first + on - 1] = code(Tone::HeatSoft);
}

void TickRing::plan() {
    uint8_t next[COUNT] = {};
    if (layout == Layout::Split) {
        fill(SPANS[0], arcs[0], pulsing, next);
        fill(SPANS[1], arcs[1], false, next);
    } else if (layout == Layout::Single) {
        if (comet) {
            Arc empty;
            fill(SPANS[2], empty, false, next);
            for (unsigned i = 0; i < 3; ++i)
                next[SPANS[2].first + (cometAt + i) % FULL] = code(Tone::Ink);
        } else {
            fill(SPANS[2], arcs[0], pulsing, next);
        }
    }
    for (unsigned a = 0; a < 3; ++a) {
        const Span &span = SPANS[a];
        if (memcmp(next + span.first, want + span.first, span.count) == 0)
            continue;
        memcpy(want + span.first, next + span.first, span.count);
        // A new target sets the pace: a few ticks a frame, more only when the walk must fit the sweep.
        int pending = 0, litNow = 0, litNext = 0;
        for (unsigned i = span.first; i < span.first + span.count; ++i) {
            pending += drawn[i] != want[i];
            litNow += lit(drawn[i]);
            litNext += lit(want[i]);
        }
        const Arc &arc = arcs[a == 1 ? 1 : 0];
        const int fitted = (pending + motion::SWEEP - 1) / motion::SWEEP;
        pace[a] = a == 2 && comet ? span.count : arc.pace ? arc.pace : static_cast<uint8_t>(std::max(4, fitted));
        down[a] = litNext < litNow;
    }
}

// The ticks are kept in the design's coordinates. The ring lies on the stage, which starts 7 px outside the
// glass on a 466 px panel: what is drawn and what is repainted both move with it.
lv_area_t TickRing::box(unsigned index, bool notch) const {
    const Tick &t = ticks[index];
    const lv_point_t &in = notch ? t.notch : t.inner;
    lv_area_t area = {
        static_cast<lv_coord_t>(std::min(in.x, t.outer.x) - PAD), static_cast<lv_coord_t>(std::min(in.y, t.outer.y) - PAD),
        static_cast<lv_coord_t>(std::max(in.x, t.outer.x) + PAD), static_cast<lv_coord_t>(std::max(in.y, t.outer.y) + PAD)};
    lv_area_move(&area, obj->coords.x1, obj->coords.y1);
    return area;
}

void TickRing::apply(unsigned index) {
    const lv_area_t area = box(index, (drawn[index] | want[index]) & NOTCH);
    drawn[index] = want[index];
    ui::invalidate(obj, &area);
}

void TickRing::step() {
    if (++phase >= motion::SWEEP) {
        phase = 0;
        if (pulsing) {
            soft = !soft;
            plan();
        }
    }
    if (comet && layout == Layout::Single) {
        cometAt = (cometAt + 1) % FULL;
        plan();
    }
    for (unsigned a = 0; a < 3; ++a) {
        const Span &span = SPANS[a];
        unsigned left = pace[a];
        for (unsigned n = 0; n < span.count && left > 0; ++n) {
            const unsigned i = span.first + (down[a] ? span.count - 1 - n : n);
            if (drawn[i] != want[i]) {
                apply(i);
                --left;
            }
        }
    }
}

void TickRing::settle() {
    memcpy(drawn, want, sizeof(drawn));
    ui::invalidate(obj);
}

void TickRing::drawEvent(lv_event_t *e) {
    static_cast<const TickRing *>(lv_event_get_user_data(e))->draw(lv_event_get_draw_ctx(e));
}

void TickRing::draw(lv_draw_ctx_t *ctx) const {
    const lv_area_t *clip = ctx->clip_area;
    lv_draw_line_dsc_t dsc;
    lv_draw_line_dsc_init(&dsc);
    dsc.width = tokens::RING_TICK;
    dsc.round_start = dsc.round_end = 1;
    for (unsigned i = 0; i < COUNT; ++i) {
        const uint8_t c = drawn[i];
        if (c == 0)
            continue;
        const bool notch = c & NOTCH;
        const lv_area_t area = box(i, notch);
        if (area.x2 < clip->x1 || area.x1 > clip->x2 || area.y2 < clip->y1 || area.y1 > clip->y2)
            continue;
        dsc.color = tone(notch ? Tone::Ink : static_cast<Tone>((c & 0x7f) - 1));
        const Tick &t = ticks[i];
        const lv_point_t &in = notch ? t.notch : t.inner;
        const lv_coord_t dx = obj->coords.x1, dy = obj->coords.y1;
        const lv_point_t from = {static_cast<lv_coord_t>(in.x + dx), static_cast<lv_coord_t>(in.y + dy)};
        const lv_point_t to = {static_cast<lv_coord_t>(t.outer.x + dx), static_cast<lv_coord_t>(t.outer.y + dy)};
        lv_draw_line(ctx, &dsc, &from, &to);
    }
}

TickRing::Shown TickRing::shown() const {
    Shown s{Layout::None, {0, 0}, {-1, -1}, {Tone::Track, Tone::Track}, false};
    const bool split = drawn[SPANS[0].first] != 0 || drawn[SPANS[1].first] != 0;
    const bool single = drawn[SPANS[2].first] != 0;
    s.layout = split ? Layout::Split : single ? Layout::Single : Layout::None;
    for (unsigned a = 0; a < 3; ++a) {
        if ((a == 2) != (s.layout == Layout::Single))
            continue;
        const Span &span = SPANS[a];
        const unsigned slot = a == 1 ? 1 : 0;
        for (unsigned i = 0; i < span.count; ++i) {
            const uint8_t c = drawn[span.first + i];
            if (c & NOTCH)
                s.notch[slot] = static_cast<int>(i);
            else if (lit(c)) {
                // The first lit tick carries the arc's tone; the last may be mid-pulse.
                if (s.lit[slot]++ == 0)
                    s.tone[slot] = static_cast<Tone>((c & 0x7f) - 1);
            }
        }
    }
    s.walking = memcmp(drawn, want, sizeof(drawn)) != 0;
    return s;
}

} // namespace bm
