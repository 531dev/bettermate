#include "StageBars.h"

#include <algorithm>
#include <cmath>
#include <cstring>
#include <display/ui/bettermate/Ui.h>

namespace bm::ui {
namespace {
// A bar is fully rounded, so the shortest bar and the first sign of a fill are both a dot of this size.
constexpr int HEIGHT = 8;
constexpr int GAP = 6;
// The rounded end of the filled part: it moves with the fill, so it is repainted with every step.
constexpr int CAP = HEIGHT / 2;
} // namespace

void StageBars::build(lv_obj_t *parent, int x, int y, int rowWidth) {
    span = rowWidth;
    box = lv_obj_create(parent);
    lv_obj_remove_style_all(box);
    lv_obj_clear_flag(box, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_pos(box, x, y);
    lv_obj_set_size(box, rowWidth, HEIGHT);
    lv_obj_add_event_cb(box, drawEvent, LV_EVENT_DRAW_MAIN, this);
}

void StageBars::plan(const float *seconds, unsigned n) {
    n = std::min(n, MAX);
    if (n == count && (n == 0 || memcmp(seconds, planned, n * sizeof(float)) == 0))
        return;
    count = n;
    memset(want, 0, sizeof(want));
    memset(drawn, 0, sizeof(drawn));
    if (n > 0) {
        memcpy(planned, seconds, n * sizeof(float));

        // Every bar gets its share of the row. A phase too short for a dot gets the dot, and the others share
        // what is left.
        float duration[MAX];
        bool dot[MAX] = {};
        float room = static_cast<float>(span - GAP * (static_cast<int>(n) - 1));
        float total = 0;
        unsigned sharing = n;
        for (unsigned i = 0; i < n; ++i) {
            duration[i] = std::isfinite(seconds[i]) && seconds[i] > 0 ? seconds[i] : 0;
            total += duration[i];
        }
        const auto share = [&](unsigned i) {
            return total > 0 ? room * duration[i] / total : room / static_cast<float>(sharing);
        };
        for (bool again = true; again && sharing > 0;) {
            again = false;
            for (unsigned i = 0; i < n && !again; ++i) {
                if (dot[i] || share(i) >= HEIGHT)
                    continue;
                dot[i] = again = true;
                room -= HEIGHT;
                total -= duration[i];
                --sharing;
            }
        }
        float at = 0;
        for (unsigned i = 0; i < n; ++i) {
            const float wide = dot[i] ? static_cast<float>(HEIGHT) : share(i);
            left[i] = static_cast<int16_t>(lroundf(at));
            width[i] = static_cast<int16_t>(lroundf(at + wide) - left[i]);
            at += wide + GAP;
        }
    }
    invalidate(box);
}

void StageBars::set(unsigned phase, float progress) {
    for (unsigned i = 0; i < count; ++i) {
        int fill = 0;
        if (i < phase)
            fill = width[i];
        else if (i == phase)
            fill = std::max(HEIGHT, static_cast<int>(lroundf(width[i] * std::clamp(progress, 0.0f, 1.0f))));
        want[i] = static_cast<int16_t>(fill);
    }
}

void StageBars::step() {
    for (unsigned i = 0; i < count; ++i) {
        const int from = drawn[i], to = want[i];
        if (from == to)
            continue;
        // A pixel a frame keeps up with any phase of a real shot; a jump (a phase that ended early, the end of
        // the shot) closes a quarter of what is left each frame.
        const int move = std::max(1, (std::abs(to - from) + 3) / 4);
        int next = to > from ? from + move : from - move;
        // Nothing is shorter than a dot.
        if (next > 0 && next < HEIGHT)
            next = to > from ? HEIGHT : 0;
        repaint(i, from, next);
        drawn[i] = static_cast<int16_t>(next);
    }
}

void StageBars::settle() {
    if (memcmp(drawn, want, sizeof(drawn)) == 0)
        return;
    memcpy(drawn, want, sizeof(drawn));
    invalidate(box);
}

// The columns between two fills, and the rounded end the shorter one had.
void StageBars::repaint(unsigned bar, int from, int to) const {
    lv_area_t coords;
    lv_obj_get_coords(box, &coords);
    const int first = std::max(0, std::min(from, to) - CAP);
    const int last = std::max(from, to) - 1;
    const lv_area_t area = {static_cast<lv_coord_t>(coords.x1 + left[bar] + first), coords.y1,
                            static_cast<lv_coord_t>(coords.x1 + left[bar] + last), coords.y2};
    invalidate(box, &area);
}

void StageBars::drawEvent(lv_event_t *e) {
    static_cast<const StageBars *>(lv_event_get_user_data(e))->draw(lv_event_get_draw_ctx(e));
}

void StageBars::draw(lv_draw_ctx_t *ctx) const {
    const lv_area_t *clip = ctx->clip_area;
    lv_area_t coords;
    lv_obj_get_coords(box, &coords);
    lv_draw_rect_dsc_t dsc;
    lv_draw_rect_dsc_init(&dsc);
    dsc.radius = LV_RADIUS_CIRCLE;
    for (unsigned i = 0; i < count; ++i) {
        lv_area_t bar = {static_cast<lv_coord_t>(coords.x1 + left[i]), coords.y1,
                         static_cast<lv_coord_t>(coords.x1 + left[i] + width[i] - 1), coords.y2};
        if (bar.x2 < clip->x1 || bar.x1 > clip->x2)
            continue;
        // A full bar is its fill alone.
        if (drawn[i] < width[i]) {
            dsc.bg_color = tone(Tone::Track);
            lv_draw_rect(ctx, &dsc, &bar);
        }
        if (drawn[i] > 0) {
            bar.x2 = static_cast<lv_coord_t>(bar.x1 + drawn[i] - 1);
            dsc.bg_color = tone(Tone::Ink);
            lv_draw_rect(ctx, &dsc, &bar);
        }
    }
}

} // namespace bm::ui
