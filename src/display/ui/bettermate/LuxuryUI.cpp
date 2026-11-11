#include "LuxuryUI.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace bm::luxury {
namespace {
constexpr float DEG = 3.14159265358979323846f / 180.0f;
constexpr lv_obj_flag_t STEADY = LV_OBJ_FLAG_USER_1;
int instantDepth = 0;

void pulseOpacity(void *obj, int32_t opacity) { lv_obj_set_style_opa(static_cast<lv_obj_t *>(obj), opacity, 0); }
void fadeOpacity(void *obj, int32_t opacity) { lv_obj_set_style_opa(static_cast<lv_obj_t *>(obj), opacity, 0); }
void riseOffset(void *obj, int32_t offset) { lv_obj_set_style_translate_y(static_cast<lv_obj_t *>(obj), offset, 0); }

lv_point_t polar(float angle, float radius) {
    return {static_cast<lv_coord_t>(lroundf(240 + cosf(angle * DEG) * radius)),
            static_cast<lv_coord_t>(lroundf(240 + sinf(angle * DEG) * radius))};
}

void startShared(lv_anim_t &animation, void *var, lv_anim_exec_xcb_t exec, int32_t from, int32_t to, uint32_t ms,
                 bool entering) {
    lv_anim_init(&animation);
    lv_anim_set_var(&animation, var);
    lv_anim_set_exec_cb(&animation, exec);
    lv_anim_set_values(&animation, from, to);
    lv_anim_set_time(&animation, ms);
    lv_anim_set_path_cb(&animation, entering ? lv_anim_path_ease_out : lv_anim_path_ease_in);
}
} // namespace

Instant::Instant() { ++instantDepth; }
Instant::~Instant() { --instantDepth; }
bool instant() { return instantDepth > 0; }

void pulse(lv_obj_t *obj, bool active) {
    if (!active) {
        lv_anim_del(obj, pulseOpacity);
        lv_obj_set_style_opa(obj, LV_OPA_COVER, 0);
        return;
    }
    if (lv_anim_get(obj, pulseOpacity))
        return;
    lv_anim_t animation;
    lv_anim_init(&animation);
    lv_anim_set_var(&animation, obj);
    lv_anim_set_exec_cb(&animation, pulseOpacity);
    lv_anim_set_values(&animation, LV_OPA_COVER, LV_OPA_30);
    lv_anim_set_time(&animation, 900);
    lv_anim_set_playback_time(&animation, 900);
    lv_anim_set_path_cb(&animation, lv_anim_path_ease_in_out);
    lv_anim_set_repeat_count(&animation, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&animation);
}

void fade(lv_obj_t *obj, bool visible, uint32_t ms) {
    if (obj == nullptr)
        return;
    const bool hidden = lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN);
    lv_anim_t *running = lv_anim_get(obj, fadeOpacity);
    if (instant() || ms == 0) {
        if (running)
            lv_anim_del(obj, fadeOpacity);
        lv_obj_set_style_opa(obj, LV_OPA_COVER, 0);
        ui::setVisible(obj, visible);
        return;
    }
    if (running) {
        if ((running->end_value == LV_OPA_COVER) == visible)
            return;
        lv_anim_del(obj, fadeOpacity);
    } else if (visible != hidden) {
        return;
    }
    const int32_t from = hidden ? LV_OPA_TRANSP : lv_obj_get_style_opa(obj, 0);
    lv_obj_set_style_opa(obj, from, 0);
    if (visible)
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);
    lv_anim_t animation;
    startShared(animation, obj, fadeOpacity, from, visible ? LV_OPA_COVER : LV_OPA_TRANSP, ms, visible);
    if (!visible) {
        lv_anim_set_ready_cb(&animation, [](lv_anim_t *a) {
            auto *target = static_cast<lv_obj_t *>(a->var);
            lv_obj_add_flag(target, LV_OBJ_FLAG_HIDDEN);
            lv_obj_set_style_opa(target, LV_OPA_COVER, 0);
        });
    }
    lv_anim_start(&animation);
}

namespace {
// A plain container only positions its children, so its parts can enter one by one.
bool layoutOnly(lv_obj_t *obj) {
    return lv_obj_check_type(obj, &lv_obj_class) && lv_obj_get_child_cnt(obj) > 0 &&
           lv_obj_get_style_bg_opa(obj, 0) == LV_OPA_TRANSP && lv_obj_get_style_border_width(obj, 0) == 0;
}

void enterPart(lv_obj_t *part, bool rise) {
    lv_anim_t animation;
    // The fade ends at the part's own opacity; an earlier enter that is still running already holds it, and a
    // part already fading out keeps doing so.
    const lv_anim_t *fading = lv_anim_get(part, fadeOpacity);
    const int32_t opacity = fading ? fading->end_value : lv_obj_get_style_opa(part, 0);
    if (opacity != LV_OPA_TRANSP && !lv_anim_get(part, pulseOpacity)) {
        lv_anim_del(part, fadeOpacity);
        startShared(animation, part, fadeOpacity, LV_OPA_TRANSP, opacity, MOTION_STATE, true);
        lv_obj_set_style_opa(part, LV_OPA_TRANSP, 0);
        lv_anim_start(&animation);
    }
    if (rise) {
        const lv_anim_t *rising = lv_anim_get(part, riseOffset);
        const int32_t offset = rising ? rising->end_value : lv_obj_get_style_translate_y(part, 0);
        lv_anim_del(part, riseOffset);
        startShared(animation, part, riseOffset, offset + 12, offset, MOTION_STATE, true);
        lv_obj_set_style_translate_y(part, offset + 12, 0);
        lv_anim_start(&animation);
    }
}
} // namespace

void enter(lv_obj_t *body, bool rise) {
    if (body == nullptr)
        return;
    // Animating each part instead of the body keeps every frame to the parts' own areas. Fading the body
    // would repaint all of it, empty space and rim included, on each frame.
    const uint32_t count = lv_obj_get_child_cnt(body);
    for (uint32_t i = 0; i < count; ++i) {
        lv_obj_t *part = lv_obj_get_child(body, i);
        if (lv_obj_has_flag(part, LV_OBJ_FLAG_HIDDEN) || lv_obj_has_flag(part, STEADY))
            continue;
        if (layoutOnly(part))
            enter(part, rise);
        else
            enterPart(part, rise);
    }
}

void steady(lv_obj_t *obj) { lv_obj_add_flag(obj, STEADY); }

void opacity(lv_obj_t *obj, lv_opa_t value) {
    if (lv_anim_t *fading = lv_anim_get(obj, fadeOpacity)) {
        fading->end_value = value;
        return;
    }
    if (lv_obj_get_style_opa(obj, 0) != value)
        lv_obj_set_style_opa(obj, value, 0);
}

void Readout::attach(lv_obj_t *label, int places, const char *unit) {
    text = label;
    decimals = places;
    suffix = unit;
    scale = 1;
    for (int i = 0; i < decimals; ++i)
        scale *= 10;
}

void Readout::reset() {
    lv_anim_del(this, step);
    valid = false;
}

void Readout::render(float value) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%.*f%s", decimals, value, suffix);
    ui::setText(text, buf);
}

void Readout::step(void *self, int32_t value) {
    auto *readout = static_cast<Readout *>(self);
    readout->current = static_cast<float>(value) / readout->scale;
    readout->render(readout->current);
}

void Readout::set(float value, uint32_t ms) {
    if (!std::isfinite(value))
        value = 0;
    // Compare at display precision so sensor noise below the last digit costs nothing.
    const float rounded = roundf(value * scale) / scale;
    if (valid && rounded == target)
        return;
    lv_anim_del(this, step);
    if (!valid || instant() || ms == 0) {
        valid = true;
        current = target = rounded;
        render(rounded);
        return;
    }
    target = rounded;
    lv_anim_t animation;
    startShared(animation, this, step, lroundf(current * scale), lroundf(rounded * scale), ms, true);
    lv_anim_start(&animation);
}

float rimFraction(float value, float max) {
    if (!std::isfinite(value) || max <= 0)
        return 0;
    return std::clamp(value / max, 0.0f, 1.0f);
}

void Rim::build(lv_obj_t *parent, Shape kind, int r) {
    radius = r;
    arc = lv_arc_create(parent);
    lv_obj_remove_style_all(arc);
    lv_obj_set_size(arc, radius * 2, radius * 2);
    lv_obj_set_pos(arc, 240 - radius, 240 - radius);
    lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_arc_width(arc, 1, LV_PART_MAIN);
    lv_obj_set_style_arc_width(arc, 3, LV_PART_INDICATOR);
    lv_obj_set_style_arc_rounded(arc, true, LV_PART_INDICATOR);
    lv_arc_set_range(arc, 0, 1000);
    notch = lv_line_create(parent);
    lv_obj_remove_style_all(notch);
    lv_obj_clear_flag(notch, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_line_width(notch, 2, 0);
    lv_obj_set_style_line_rounded(notch, true, 0);
    lv_obj_add_flag(notch, LV_OBJ_FLAG_HIDDEN);
    steady(arc);
    steady(notch);
    reshape(kind);
    lv_arc_set_value(arc, 0);
}

void Rim::reshape(Shape kind) {
    shape = kind;
    switch (shape) {
    case Shape::Left:
        lv_arc_set_bg_angles(arc, 110, 250);
        lv_arc_set_mode(arc, LV_ARC_MODE_NORMAL);
        break;
    case Shape::Right:
        lv_arc_set_bg_angles(arc, 290, 70);
        lv_arc_set_mode(arc, LV_ARC_MODE_REVERSE);
        break;
    case Shape::Dial:
        lv_arc_set_bg_angles(arc, 135, 45);
        lv_arc_set_mode(arc, LV_ARC_MODE_NORMAL);
        break;
    }
    if (notchValue >= 0)
        placeNotch(notchValue / 1000.0f);
}

float Rim::angleAt(float fraction) const {
    switch (shape) {
    case Shape::Left:
        return 110 + 140 * fraction;
    case Shape::Right:
        return 70 - 140 * fraction;
    case Shape::Dial:
    default:
        return 135 + 270 * fraction;
    }
}

void Rim::placeNotch(float fraction) {
    const float angle = angleAt(fraction);
    const lv_point_t inner = polar(angle, radius - 13);
    const lv_point_t outer = polar(angle, radius + 4);
    const lv_coord_t x = std::min(inner.x, outer.x) - 2;
    const lv_coord_t y = std::min(inner.y, outer.y) - 2;
    notchPoints[0] = {static_cast<lv_coord_t>(inner.x - x), static_cast<lv_coord_t>(inner.y - y)};
    notchPoints[1] = {static_cast<lv_coord_t>(outer.x - x), static_cast<lv_coord_t>(outer.y - y)};
    lv_obj_set_pos(notch, x, y);
    lv_line_set_points(notch, notchPoints, 2);
}

void Rim::valueStep(void *self, int32_t v) {
    auto *rim = static_cast<Rim *>(self);
    lv_arc_set_value(rim->arc, v);
}

void Rim::notchStep(void *self, int32_t v) {
    auto *rim = static_cast<Rim *>(self);
    rim->placeNotch(v / 1000.0f);
}

void Rim::set(float fraction, float target, bool animate) {
    const int next = lroundf(std::clamp(fraction, 0.0f, 1.0f) * 1000);
    const bool glide = animate && !instant() && value >= 0;
    if (next != value) {
        lv_anim_del(this, valueStep);
        if (glide && std::abs(next - value) > 4) {
            lv_anim_t animation;
            startShared(animation, this, valueStep, lv_arc_get_value(arc), next, MOTION_PAGE, true);
            lv_anim_start(&animation);
        } else {
            lv_arc_set_value(arc, next);
        }
        value = next;
    }
    const bool hasTarget = target >= 0;
    if (hasTarget) {
        const int nextNotch = lroundf(std::clamp(target, 0.0f, 1.0f) * 1000);
        if (nextNotch != notchValue) {
            lv_anim_del(this, notchStep);
            if (glide && notchShown && notchValue >= 0) {
                lv_anim_t animation;
                startShared(animation, this, notchStep, notchValue, nextNotch, MOTION_PAGE, true);
                lv_anim_start(&animation);
            } else {
                placeNotch(nextNotch / 1000.0f);
            }
            notchValue = nextNotch;
        }
    }
    if (hasTarget != notchShown) {
        notchShown = hasTarget;
        fade(notch, hasTarget && !lv_obj_has_flag(arc, LV_OBJ_FLAG_HIDDEN), MOTION_STATE);
    }
}

void Rim::colors(lv_color_t track, lv_color_t valueTint, lv_color_t notchTint) {
    if (lv_obj_get_style_arc_color(arc, LV_PART_MAIN).full != track.full)
        lv_obj_set_style_arc_color(arc, track, LV_PART_MAIN);
    valueColor = valueTint;
    notchColor = notchTint;
    swellColor = palette().ink;
    if (!lv_anim_get(this, swellStep)) {
        if (lv_obj_get_style_arc_color(arc, LV_PART_INDICATOR).full != valueTint.full)
            lv_obj_set_style_arc_color(arc, valueTint, LV_PART_INDICATOR);
        if (lv_obj_get_style_line_color(notch, 0).full != notchTint.full)
            lv_obj_set_style_line_color(notch, notchTint, 0);
    }
}

void Rim::swellStep(void *self, int32_t v) {
    auto *rim = static_cast<Rim *>(self);
    lv_obj_set_style_arc_color(rim->arc, lv_color_mix(rim->swellColor, rim->valueColor, v), LV_PART_INDICATOR);
    lv_obj_set_style_line_width(rim->notch, 2 + v / 128, 0);
}

void Rim::swell() {
    if (instant() || lv_anim_get(this, swellStep))
        return;
    lv_anim_t animation;
    startShared(animation, this, swellStep, 0, 255, MOTION_PAGE, true);
    lv_anim_set_playback_time(&animation, MOTION_PAGE);
    lv_anim_set_path_cb(&animation, lv_anim_path_ease_in_out);
    lv_anim_set_ready_cb(&animation, [](lv_anim_t *a) {
        auto *rim = static_cast<Rim *>(a->var);
        lv_obj_set_style_arc_color(rim->arc, rim->valueColor, LV_PART_INDICATOR);
        lv_obj_set_style_line_width(rim->notch, 2, 0);
    });
    lv_anim_start(&animation);
}

void Rim::show(bool visible) {
    fade(arc, visible, MOTION_PAGE);
    fade(notch, visible && notchShown, MOTION_PAGE);
}

void PhaseTrack::build(lv_obj_t *parent, int radius) {
    for (auto *&segment : segments) {
        segment = lv_arc_create(parent);
        lv_obj_remove_style_all(segment);
        lv_obj_set_size(segment, radius * 2, radius * 2);
        lv_obj_set_pos(segment, 240 - radius, 240 - radius);
        lv_obj_clear_flag(segment, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_style_arc_width(segment, 2, LV_PART_MAIN);
        lv_obj_set_style_arc_width(segment, 2, LV_PART_INDICATOR);
        lv_arc_set_range(segment, 0, 1000);
        lv_arc_set_value(segment, 0);
        lv_obj_add_flag(segment, LV_OBJ_FLAG_HIDDEN);
        steady(segment);
    }
}

void PhaseTrack::plan(const float *durations, int phases) {
    phases = std::clamp(phases, 1, MAX);
    float total = 0, signature = phases;
    for (int i = 0; i < phases; ++i) {
        total += std::max(0.0f, durations[i]);
        signature = signature * 31 + durations[i];
    }
    if (signature == plannedSignature && phases == count)
        return;
    plannedSignature = signature;
    count = phases;
    const float gap = count > 1 ? 4.0f : 0.0f;
    const float sweep = 270.0f - gap * (count - 1);
    float angle = 135;
    for (int i = 0; i < MAX; ++i) {
        if (i >= count) {
            lv_obj_add_flag(segments[i], LV_OBJ_FLAG_HIDDEN);
            continue;
        }
        const float share = total > 0 ? std::max(0.0f, durations[i]) / total : 1.0f / count;
        const float length = std::max(2.0f, sweep * share);
        lv_arc_set_bg_angles(segments[i], lroundf(angle), lroundf(angle + length));
        angle += length + gap;
    }
}

void PhaseTrack::set(int index, float progress, bool complete) {
    for (int i = 0; i < count; ++i) {
        const int value = complete || i < index ? 1000 : i == index ? lroundf(std::clamp(progress, 0.0f, 1.0f) * 1000) : 0;
        if (lv_arc_get_value(segments[i]) != value)
            lv_arc_set_value(segments[i], value);
    }
}

void PhaseTrack::colors(lv_color_t track, lv_color_t valueTint) {
    for (auto *segment : segments) {
        if (lv_obj_get_style_arc_color(segment, LV_PART_MAIN).full != track.full)
            lv_obj_set_style_arc_color(segment, track, LV_PART_MAIN);
        if (lv_obj_get_style_arc_color(segment, LV_PART_INDICATOR).full != valueTint.full)
            lv_obj_set_style_arc_color(segment, valueTint, LV_PART_INDICATOR);
    }
}

void PhaseTrack::show(bool visible) {
    for (int i = 0; i < MAX; ++i)
        fade(segments[i], visible && i < count, MOTION_PAGE);
}

lv_obj_t *glyph(lv_obj_t *parent, Glyph kind, int size) {
    auto *obj = ui::box(parent);
    lv_obj_set_size(obj, size, size);
    lv_obj_add_event_cb(obj, [](lv_event_t *e) {
        auto *self = lv_event_get_target(e);
        const auto kind = static_cast<Glyph>(reinterpret_cast<uintptr_t>(lv_event_get_user_data(e)));
        lv_area_t area;
        lv_obj_get_coords(self, &area);
        const lv_coord_t cx = (area.x1 + area.x2) / 2;
        const lv_coord_t cy = (area.y1 + area.y2) / 2;
        const lv_color_t tint = lv_obj_get_style_text_color(self, 0);
        auto *context = lv_event_get_draw_ctx(e);
        lv_draw_line_dsc_t line;
        lv_draw_line_dsc_init(&line);
        line.color = tint;
        line.width = 1;
        line.round_start = line.round_end = true;
        lv_draw_arc_dsc_t arc;
        lv_draw_arc_dsc_init(&arc);
        arc.color = tint;
        arc.width = 1;
        switch (kind) {
        case Glyph::Dot: {
            lv_draw_rect_dsc_t rect;
            lv_draw_rect_dsc_init(&rect);
            rect.bg_color = tint;
            rect.radius = LV_RADIUS_CIRCLE;
            const lv_area_t dot{static_cast<lv_coord_t>(cx - 4), static_cast<lv_coord_t>(cy - 4),
                                static_cast<lv_coord_t>(cx + 4), static_cast<lv_coord_t>(cy + 4)};
            lv_draw_rect(context, &rect, &dot);
            break;
        }
        case Glyph::WifiOff: {
            const lv_point_t base{cx, static_cast<lv_coord_t>(cy + 7)};
            for (int r : {6, 11, 16})
                lv_draw_arc(context, &arc, &base, r, 228, 312);
            lv_draw_rect_dsc_t rect;
            lv_draw_rect_dsc_init(&rect);
            rect.bg_color = tint;
            rect.radius = LV_RADIUS_CIRCLE;
            const lv_area_t dot{static_cast<lv_coord_t>(cx - 1), static_cast<lv_coord_t>(cy + 5),
                                static_cast<lv_coord_t>(cx + 1), static_cast<lv_coord_t>(cy + 7)};
            lv_draw_rect(context, &rect, &dot);
            const lv_point_t a{static_cast<lv_coord_t>(cx - 11), static_cast<lv_coord_t>(cy - 10)};
            const lv_point_t b{static_cast<lv_coord_t>(cx + 11), static_cast<lv_coord_t>(cy + 10)};
            lv_draw_line(context, &line, &a, &b);
            break;
        }
        case Glyph::Update: {
            const lv_point_t center{cx, cy};
            lv_draw_arc(context, &arc, &center, 9, 330, 270);
            const lv_point_t tip{cx, static_cast<lv_coord_t>(cy - 9)};
            const lv_point_t up{static_cast<lv_coord_t>(cx - 4), static_cast<lv_coord_t>(cy - 13)};
            const lv_point_t down{static_cast<lv_coord_t>(cx - 4), static_cast<lv_coord_t>(cy - 5)};
            lv_draw_line(context, &line, &up, &tip);
            lv_draw_line(context, &line, &tip, &down);
            break;
        }
        case Glyph::ChevronRight: {
            const lv_point_t a{static_cast<lv_coord_t>(cx - 3), static_cast<lv_coord_t>(cy - 7)};
            const lv_point_t b{static_cast<lv_coord_t>(cx + 4), cy};
            const lv_point_t c{static_cast<lv_coord_t>(cx - 3), static_cast<lv_coord_t>(cy + 7)};
            lv_draw_line(context, &line, &a, &b);
            lv_draw_line(context, &line, &b, &c);
            break;
        }
        }
    }, LV_EVENT_DRAW_MAIN, reinterpret_cast<void *>(static_cast<uintptr_t>(kind)));
    return obj;
}

void glyphColor(lv_obj_t *obj, lv_color_t tint) {
    if (lv_obj_get_style_text_color(obj, 0).full != tint.full) {
        lv_obj_set_style_text_color(obj, tint, 0);
        lv_obj_invalidate(obj);
    }
}

namespace {
bool signals(int type, bool standby) {
    return type != WARNING_TEMPERATURE && !(standby && type == WARNING_FLUSH);
}
} // namespace

bool anyWarning(const UiState &s, bool standby) {
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        if (signals(i, standby) && (s.warn[i] || s.error[i]))
            return true;
    }
    return false;
}

bool anyError(const UiState &s, bool standby) {
    for (int i = 0; i < WARNING_TYPE_COUNT; ++i) {
        if (signals(i, standby) && s.error[i])
            return true;
    }
    return false;
}

void Indicators::build(lv_obj_t *parent, int y) {
    row = ui::row(parent, 0);
    lv_obj_align(row, LV_ALIGN_TOP_MID, 0, y - 22);
    steady(row);
    warning = glyph(row, Glyph::Dot, 44);
    wifi = glyph(row, Glyph::WifiOff, 44);
    update_ = glyph(row, Glyph::Update, 44);
    for (auto *obj : {warning, wifi, update_}) {
        lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
        lv_obj_add_flag(obj, LV_OBJ_FLAG_GESTURE_BUBBLE);
        // Extend each 44 px glyph to a 56 px touch target.
        lv_obj_set_ext_click_area(obj, 6);
    }
}

bool Indicators::update(const UiState &s, bool network, bool standby, bool running) {
    const auto p = palette();
    const bool warn = !running && anyWarning(s, standby);
    const bool wifiLost = network && !s.wifiConnected && !s.accessPoint;
    glyphColor(warning, anyError(s, standby) ? p.danger : p.warning);
    glyphColor(wifi, p.muted);
    glyphColor(update_, p.accent);
    fade(warning, warn, MOTION_STATE);
    fade(wifi, wifiLost, MOTION_STATE);
    fade(update_, network && s.updateAvailable, MOTION_STATE);
    return warn || wifiLost || (network && s.updateAvailable);
}

lv_obj_t *orbit(lv_obj_t *parent) {
    auto *arc = lv_arc_create(parent);
    lv_obj_remove_style_all(arc);
    lv_obj_set_size(arc, 456, 456);
    lv_obj_set_pos(arc, 12, 12);
    lv_obj_clear_flag(arc, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_arc_width(arc, 2, LV_PART_MAIN);
    lv_obj_set_style_arc_rounded(arc, true, LV_PART_MAIN);
    lv_arc_set_bg_angles(arc, 270, 310);
    lv_obj_add_flag(arc, LV_OBJ_FLAG_HIDDEN);
    steady(arc);
    return arc;
}

void orbiting(lv_obj_t *arc, bool active) {
    static const lv_anim_exec_xcb_t spin = [](void *obj, int32_t angle) {
        lv_arc_set_bg_angles(static_cast<lv_obj_t *>(obj), angle % 360, (angle + 40) % 360);
    };
    if (lv_obj_get_style_arc_color(arc, LV_PART_MAIN).full != palette().muted.full)
        lv_obj_set_style_arc_color(arc, palette().muted, LV_PART_MAIN);
    if (!active) {
        lv_anim_del(arc, spin);
        ui::setVisible(arc, false);
        return;
    }
    ui::setVisible(arc, true);
    if (lv_anim_get(arc, spin))
        return;
    lv_anim_t animation;
    lv_anim_init(&animation);
    lv_anim_set_var(&animation, arc);
    lv_anim_set_exec_cb(&animation, spin);
    lv_anim_set_values(&animation, 270, 270 + 359);
    lv_anim_set_time(&animation, 2400);
    lv_anim_set_repeat_count(&animation, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&animation);
}

Palette palette() {
    if (theme().id() == ThemeId::Light)
        return {lv_color_hex(0xf4f1eb), lv_color_hex(0x25231f), lv_color_hex(0x746c60), lv_color_hex(0x746c60),
                lv_color_hex(0xd5cfc4), lv_color_hex(0x8c6b32), lv_color_hex(0x8b650d), lv_color_hex(0xa33828)};
    return {lv_color_black(), lv_color_hex(0xeeeae3), lv_color_hex(0x938e83), lv_color_hex(0x938e83),
            lv_color_hex(0x302d27), lv_color_hex(0xc9ae79), lv_color_hex(0xd9b87b), lv_color_hex(0xee9c8d)};
}

void background(lv_obj_t *obj, lv_color_t value) {
    if (lv_obj_get_style_bg_color(obj, 0).full != value.full)
        lv_obj_set_style_bg_color(obj, value, 0);
    // Every style set invalidates the object; on a screen root that repaints the whole panel.
    if (lv_obj_get_style_bg_opa(obj, 0) != LV_OPA_COVER)
        lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
}
void color(lv_obj_t *obj, lv_color_t value) {
    if (lv_obj_get_style_text_color(obj, 0).full != value.full)
        lv_obj_set_style_text_color(obj, value, 0);
}
void border(lv_obj_t *obj, lv_color_t value) {
    if (lv_obj_get_style_border_color(obj, 0).full != value.full)
        lv_obj_set_style_border_color(obj, value, 0);
}
void enabled(lv_obj_t *obj, bool value) {
    if (value)
        lv_obj_clear_state(obj, LV_STATE_DISABLED);
    else
        lv_obj_add_state(obj, LV_STATE_DISABLED);
    fade(obj, value);
}
lv_obj_t *label(lv_obj_t *parent, int x, int y, const lv_font_t *font, const char *value, int width, int tracking) {
    lv_obj_t *obj = lv_label_create(parent);
    lv_obj_remove_style_all(obj);
    lv_obj_set_style_text_font(obj, font, 0);
    lv_obj_set_style_text_letter_space(obj, tracking, 0);
    lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_clear_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_label_set_text(obj, value);
    if (width) {
        lv_obj_set_width(obj, width);
        lv_label_set_long_mode(obj, LV_LABEL_LONG_DOT);
    }
    lv_obj_align(obj, LV_ALIGN_TOP_MID, x, y);
    color(obj, palette().ink);
    return obj;
}
lv_obj_t *rule(lv_obj_t *parent, int x, int y, int width, int height) {
    lv_obj_t *obj = ui::box(parent);
    lv_obj_set_size(obj, width, height);
    lv_obj_align(obj, LV_ALIGN_TOP_MID, x, y);
    background(obj, palette().line);
    return obj;
}
lv_obj_t *control(lv_obj_t *parent, int x, int y, int width, int height, bool outline) {
    lv_obj_t *obj = ui::box(parent);
    lv_obj_set_size(obj, width, height);
    lv_obj_set_pos(obj, x - width / 2, y - height / 2);
    lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_flag(obj, LV_OBJ_FLAG_GESTURE_BUBBLE);
    if (outline) {
        lv_obj_set_style_radius(obj, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_border_width(obj, 1, 0);
        border(obj, palette().muted);
    }
    lv_obj_set_style_radius(obj, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_bg_color(obj, palette().accent, LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(obj, LV_OPA_10, LV_STATE_PRESSED);
    return obj;
}
lv_obj_t *pill(lv_obj_t *parent, int x, int y, int width, int height, const char *value) {
    lv_obj_t *obj = control(parent, x, y, width, height, true);
    lv_obj_t *text = label(obj, 0, 0, &bm_luxury_detail, value, 0, 1);
    lv_obj_center(text);
    return obj;
}
lv_obj_t *textButton(lv_obj_t *parent, int x, int y, int width, const char *value) {
    lv_obj_t *obj = control(parent, x, y, width, 56);
    lv_obj_t *text = label(obj, 0, 0, &bm_luxury_detail, value, 0, 1);
    lv_obj_center(text);
    return obj;
}
lv_obj_t *modesButton(lv_obj_t *parent) {
    auto *button = control(parent, 240, 450, 56, 56);
    // Match Brew's rounded 32 px chevron within a 56 px touch target.
    static const lv_point_t points[] = {{2, 14}, {16, 2}, {30, 14}};
    auto *arrow = lv_line_create(button);
    lv_obj_remove_style_all(arrow);
    lv_line_set_points(arrow, points, 3);
    lv_obj_set_style_line_width(arrow, 4, 0);
    lv_obj_set_style_line_rounded(arrow, true, 0);
    label(button, 0, 31, &bm_luxury_detail, "STOP & MODES");
    updateModesButton(button);
    return button;
}

void updateModesButton(lv_obj_t *button, bool stopsProcess, bool showStopCaption) {
    const auto p = palette();
    const bool captionVisible = stopsProcess && showStopCaption;
    const int width = captionVisible ? 180 : 56;
    lv_obj_set_width(button, width);
    // A caption lifts the control so its text stays clear of the panel's curve.
    lv_obj_set_pos(button, 240 - width / 2, (captionVisible ? 428 : 450) - 28);
    auto *arrow = lv_obj_get_child(button, 0);
    lv_obj_align(arrow, LV_ALIGN_CENTER, 0, captionVisible ? -12 : 0);
    // The arrow keeps one color everywhere; only an explicit caption says that leaving also stops.
    if (lv_obj_get_style_line_color(arrow, 0).full != p.muted.full)
        lv_obj_set_style_line_color(arrow, p.muted, 0);
    auto *caption = lv_obj_get_child(button, 1);
    ui::setVisible(caption, captionVisible);
    color(caption, p.accent);
}

lv_obj_t *power(lv_obj_t *parent, int x, int y) {
    lv_obj_t *obj = control(parent, x, y, 56, 56, true);
    lv_obj_add_event_cb(obj, [](lv_event_t *e) {
        auto *obj = lv_event_get_target(e);
        lv_area_t area;
        lv_obj_get_coords(obj, &area);
        lv_point_t center{static_cast<lv_coord_t>((area.x1 + area.x2) / 2),
                          static_cast<lv_coord_t>((area.y1 + area.y2) / 2 + 1)};
        auto *context = lv_event_get_draw_ctx(e);
        lv_draw_arc_dsc_t arc;
        lv_draw_arc_dsc_init(&arc);
        arc.color = palette().muted;
        arc.width = 1;
        lv_draw_arc(context, &arc, &center, 8, 310, 230);
        lv_draw_line_dsc_t line;
        lv_draw_line_dsc_init(&line);
        line.color = palette().muted;
        line.width = 1;
        lv_point_t start{center.x, static_cast<lv_coord_t>(center.y - 11)};
        lv_point_t end{center.x, center.y};
        lv_draw_line(context, &line, &start, &end);
    }, LV_EVENT_DRAW_MAIN, nullptr);
    return obj;
}
const char *warningName(WarningType type) {
    switch (type) {
    case WARNING_WATER: return "Water low";
    case WARNING_FLUSH: return "Flush recommended";
    case WARNING_SWITCH: return "Steam switch on";
    case WARNING_SCALE_CONNECTED: return "Scale disconnected";
    case WARNING_SCALE_BATTERY: return "Scale battery low";
    case WARNING_TEMPERATURE: return "Temperature unstable";
    default: return "Machine warning";
    }
}
} // namespace bm::luxury
