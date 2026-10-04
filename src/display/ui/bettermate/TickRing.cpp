#include "TickRing.h"
#include "UiState.h"

#include <Arduino.h>
#include <algorithm>
#include <cmath>

namespace bm {
namespace {
constexpr float DEG = 3.14159265358979323846f / 180.0f;
constexpr float RADIUS = 214.0f;
float bounded(float value, float maximum) { return std::isfinite(value) ? std::clamp(value, 0.0f, maximum) : 0.0f; }
} // namespace

TickRing::~TickRing() {
    if (timer)
        lv_timer_del(timer);
}

TickRing::Segment TickRing::segment(float angle, float radius, bool tangent, float length, int width) {
    const float ux = cosf(angle * DEG), uy = sinf(angle * DEG);
    const float dx = (tangent ? -uy : ux) * length / 2.0f;
    const float dy = (tangent ? ux : uy) * length / 2.0f;
    Segment s;
    s.a = {static_cast<lv_coord_t>(lroundf(240 + ux * radius - dx)), static_cast<lv_coord_t>(lroundf(240 + uy * radius - dy))};
    s.b = {static_cast<lv_coord_t>(lroundf(240 + ux * radius + dx)), static_cast<lv_coord_t>(lroundf(240 + uy * radius + dy))};
    const int pad = width / 2 + 2; // caps plus antialiasing
    s.bounds = {static_cast<lv_coord_t>(std::min(s.a.x, s.b.x) - pad), static_cast<lv_coord_t>(std::min(s.a.y, s.b.y) - pad),
                static_cast<lv_coord_t>(std::max(s.a.x, s.b.x) + pad), static_cast<lv_coord_t>(std::max(s.a.y, s.b.y) + pad)};
    return s;
}

void TickRing::build(lv_obj_t *parent, Kind newKind, bool minimal) {
    kind = newKind;
    stroke = minimal ? 6 : tokens::GAUGE_STROKE;
    start = kind == Kind::Pressure ? 70.0f : kind == Kind::FullTemperature ? 120.0f : 110.0f;
    sweep = kind == Kind::Pressure ? -140.0f : kind == Kind::FullTemperature ? 300.0f : 140.0f;
    maximum = kind == Kind::Pressure ? 16.0f : 160.0f;
    count = kind == Kind::FullTemperature ? 52 : 24;
    for (unsigned i = 0; i < count; ++i)
        ticks[i] = segment(start + sweep * i / (count - 1), RADIUS, true, 4.0f, stroke);
    obj = ui::box(parent);
    lv_obj_set_size(obj, 480, 480);
    lv_obj_set_pos(obj, 0, 0);
    lv_obj_add_event_cb(
        obj, [](lv_event_t *e) { static_cast<TickRing *>(lv_event_get_user_data(e))->draw(e); }, LV_EVENT_DRAW_MAIN, this);
    if (kind != Kind::Pressure) {
        timer = lv_timer_create([](lv_timer_t *t) { static_cast<TickRing *>(t->user_data)->pulse(); }, 500, this);
    }
}

void TickRing::invalidate(const Segment &s) {
    lv_area_t area = s.bounds;
    lv_area_t coords;
    lv_obj_get_coords(obj, &coords);
    lv_area_move(&area, coords.x1, coords.y1);
    lv_obj_invalidate_area(obj, &area);
}

void TickRing::update(float current, float target, bool newHeating, bool visible) {
    ui::setVisible(obj, visible);
    current = bounded(current, maximum);
    const unsigned nextLit = current <= 0 ? 0 : std::min(count, static_cast<unsigned>(current / maximum * (count - 1)) + 1);
    const bool nextSoft = newHeating && (millis() / 500) % 2;
    for (unsigned i = 0; i < count; ++i) {
        if ((i < lit) != (i < nextLit) || (i < nextLit && soft != nextSoft))
            invalidate(ticks[i]);
    }
    lit = nextLit;
    heating = newHeating;
    soft = nextSoft;
    target = bounded(target, maximum);
    if (target != targetValue) {
        if (targetValue >= 0)
            invalidate(marker);
        targetValue = target;
        marker = segment(start + sweep * target / maximum, 199.0f, false, 8.0f, 3);
        invalidate(marker);
    }
}

void TickRing::pulse() {
    if (!heating || lv_obj_get_screen(obj) != lv_scr_act() || !lv_obj_is_visible(obj))
        return;
    const bool nextSoft = (millis() / 500) % 2;
    if (soft == nextSoft)
        return;
    soft = nextSoft;
    for (unsigned i = 0; i < lit; ++i)
        invalidate(ticks[i]);
}

void TickRing::draw(lv_event_t *event) {
    lv_draw_ctx_t *ctx = lv_event_get_draw_ctx(event);
    const Palette &p = theme().palette();
    lv_area_t coords;
    lv_obj_get_coords(obj, &coords);
    lv_draw_line_dsc_t dsc;
    lv_draw_line_dsc_init(&dsc);
    dsc.width = stroke;
    dsc.round_start = dsc.round_end = 1;
    const auto drawSegment = [&](const Segment &s) {
        lv_point_t a = {static_cast<lv_coord_t>(coords.x1 + s.a.x), static_cast<lv_coord_t>(coords.y1 + s.a.y)};
        lv_point_t b = {static_cast<lv_coord_t>(coords.x1 + s.b.x), static_cast<lv_coord_t>(coords.y1 + s.b.y)};
        lv_draw_line(ctx, &dsc, &a, &b);
    };
    for (unsigned i = 0; i < count; ++i) {
        dsc.color = i >= lit ? p.line : kind == Kind::Pressure ? p.primary : soft ? p.heatSoft : p.heat;
        drawSegment(ticks[i]);
    }
    if (targetValue >= 0) {
        dsc.width = 3;
        dsc.color = p.ink;
        drawSegment(marker);
    }
}

void Gauges::build(lv_obj_t *parent, bool minimal) {
    temperature.build(parent, TickRing::Kind::Temperature, minimal);
    pressure.build(parent, TickRing::Kind::Pressure, minimal);
    full.build(parent, TickRing::Kind::FullTemperature, minimal);
}

void Gauges::update(const UiState &state) {
    const bool heating = state.currentTemp < state.targetTemp;
    temperature.update(state.currentTemp, state.targetTemp, heating, state.pressureAvailable);
    pressure.update(state.pressure, state.targetPressure, false, state.pressureAvailable);
    full.update(state.currentTemp, state.targetTemp, heating, !state.pressureAvailable);
}

} // namespace bm
