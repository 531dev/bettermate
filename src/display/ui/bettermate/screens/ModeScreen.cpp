#include "ModeScreen.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <display/ui/bettermate/Motion.h>

namespace bm {
namespace {
#define BM_DEGREE "\xC2\xB0"
#define BM_MIDDOT "\xC2\xB7"

// design/reference/components/bundle.js, screens.mode and screens.grind
constexpr int LABEL_BASELINE = 86;
constexpr int ROW_Y = 106;
constexpr int LIVE_BASELINE = 146;
constexpr int STEPPER_Y = 250;
constexpr int MINUS_X = 82;
constexpr int PLUS_X = 398;
constexpr int STEPPER_RADIUS = 30;
constexpr int TARGET_BASELINE = 284;
constexpr int UNIT_BASELINE = 318;
constexpr int ACTION_Y = 344;
constexpr int ACTION_WIDTH = 176;
constexpr int STATUS_BASELINE = 380;
// The scale's line sits between the row and the target, nearer the row it belongs with.
constexpr int SCALE_BASELINE = 194;
constexpr int SCALE_WIDTH = 228;
// Sized for the longest values: "LEFT OF 5:00" and "Steaming".
constexpr int UNIT_WIDTH = 168;
constexpr int STATUS_WIDTH = 160;

const char *const ROW_LABELS[] = {"TIME", "WEIGHT"};
constexpr unsigned long FRAME_MS_X2 = motion::FRAME_MS_EVEN + motion::FRAME_MS_ODD;

// Below the target and not yet settled there: the small dips of a boiler that has settled are not news.
bool heating(const UiState &s) {
    return s.targetTemp > 0 && !s.temperatureStable && lroundf(s.currentTemp) < lroundf(s.targetTemp);
}

// A scale at rest wanders a few hundredths around zero; it never reads "-0.0".
double grams(double value) { return std::fabs(value) < 0.05 ? 0.0 : value; }
} // namespace

void ModeScreen::build(lv_obj_t *root) {
    const bool grind = kind == Kind::Grind;
    addException();
    part(ui::text(root, 240, LABEL_BASELINE, Type::Label, Tone::Muted,
                  kind == Kind::Steam ? "STEAM" : kind == Kind::Water ? "WATER" : "GRIND"),
         0);
    target.build(root, 240, TARGET_BASELINE, Type::HeroSm, Tone::Ink);
    part(target.obj(), 0);
    unit = part(ui::text(root, 240, UNIT_BASELINE, Type::Label, Tone::Muted, "", UNIT_WIDTH), 0);

    live.build(root, 240, LIVE_BASELINE, Type::Value, Tone::Ink);
    part(live.obj(), 1);
    if (grind) {
        row.build(
            root, ROW_Y, ROW_LABELS, 2,
            [](void *context, unsigned index) {
                auto *self = static_cast<ModeScreen *>(context);
                if ((index == 1) != self->byWeight)
                    self->host.act(Intent::ToggleTarget);
            },
            this);
        part(row.obj(), 1);
        // A press of any length tares, so the stock gesture (a long press on the scale) still works.
        scale = part(ui::labelButton(root, 240, SCALE_BASELINE, SCALE_WIDTH, ""), 1);
        bind(scale, Intent::Tare, LV_EVENT_CLICKED);
    }

    minus = part(ui::disc(root, MINUS_X, STEPPER_Y, STEPPER_RADIUS, &bm_icon_minus_28), 2);
    plus = part(ui::disc(root, PLUS_X, STEPPER_Y, STEPPER_RADIUS, &bm_icon_plus_28), 2);
    // A tap is one step. Held, the first step comes when the hold is recognised and the rest follow at LVGL's
    // repeat rate, so no press of any length is ever lost.
    for (const lv_event_code_t event : {LV_EVENT_SHORT_CLICKED, LV_EVENT_LONG_PRESSED, LV_EVENT_LONG_PRESSED_REPEAT}) {
        bind(minus, grind ? Intent::GrindDown : Intent::TempDown, event);
        bind(plus, grind ? Intent::GrindUp : Intent::TempUp, event);
    }

    if (kind == Kind::Steam) {
        // No pill: steaming starts with the valve. A line takes its place and says what is true.
        status = part(ui::text(root, 240, STATUS_BASELINE, Type::Body, Tone::Muted, "", STATUS_WIDTH), 2);
    } else {
        action = part(ui::pill(root, 240, ACTION_Y, ACTION_WIDTH, "START", Tone::Primary), 2);
        // STOP answers a press of any length.
        bind(action, grind ? Intent::ToggleGrind : Intent::ToggleWater, LV_EVENT_CLICKED);
    }
    handle = addHandle();
}

void ModeScreen::onEnter(const UiState &state) {
    running = isRunning(state);
    settled = 3;
    snapshotAt = 0;
}

bool ModeScreen::isRunning(const UiState &s) const {
    switch (kind) {
    case Kind::Water:
        return s.active && !s.grindActive;
    case Kind::Grind:
        return s.grindActive;
    default:
        return false; // steaming takes no control away: leaving the mode is how it ends
    }
}

void ModeScreen::update(const UiState &s) {
    // A start or a stop changes most of the screen. It settles like a screen change, one rank a frame from
    // tick(), so no frame repaints more than a quarter of the panel.
    if (const bool now = isRunning(s); now != running) {
        running = now;
        settled = 0;
    }
    // The machine grinds by weight only while a scale answers; without one the target falls back to time.
    byWeight = s.grindVolumetric;
    showRing(s);
    for (unsigned rank = 0; rank < settled; ++rank)
        kind == Kind::Grind ? applyGrind(s, rank) : applyBoiler(s, rank);
}

void ModeScreen::tick(const UiState &s, uint32_t frame) {
    if (settled < 3) {
        kind == Kind::Grind ? applyGrind(s, settled) : applyBoiler(s, settled);
        ++settled;
    }
    if (kind != Kind::Grind || !running)
        return;
    // A snapshot comes about four times a second. Between two of them the grind's clocks run on frames, so
    // every second lasts a second.
    if (s.now != snapshotAt) {
        snapshotAt = s.now;
        snapshotFrame = frame;
        return;
    }
    showGrindClock(s, s.grindElapsed + (frame - snapshotFrame) * FRAME_MS_X2 / 2);
}

void ModeScreen::swiped(lv_dir_t direction) {
    // The menu stops whatever runs, so while water pumps or the grinder turns only STOP ends it.
    if (direction == LV_DIR_TOP && !running)
        host.act(Intent::Menu);
}

void ModeScreen::showRing(const UiState &s) {
    TickRing &ring = host.ring();
    ring.busy(false);
    if (kind != Kind::Grind) {
        ring.pulse(heating(s));
        ring.show(TickRing::Layout::Single,
                  {TickRing::fraction(s.currentTemp, TickRing::MAX_TEMPERATURE),
                   s.targetTemp > 0 ? TickRing::fraction(s.targetTemp, TickRing::MAX_TEMPERATURE) : -1.0f, Tone::Heat});
        return;
    }
    // Progress against the target the grind was started with, by weight or by time. No notch.
    float progress = 0.0f;
    if (s.grindActive && s.activeGrindVolumetric)
        progress = s.activeGrindWeight > 0 ? static_cast<float>(s.grindOutput / s.activeGrindWeight) : 0.0f;
    else if (s.grindActive)
        progress = s.activeGrindDuration > 0 ? static_cast<float>(s.grindElapsed) / s.activeGrindDuration : 0.0f;
    ring.pulse(false);
    ring.show(TickRing::Layout::Single, {std::clamp(progress, 0.0f, 1.0f), -1.0f, Tone::Ink});
}

void ModeScreen::applyBoiler(const UiState &s, unsigned rank) {
    char buf[24];
    // The stock steam glyph: the controller starts the steam process by itself once the boiler is within 5°
    // of the target, and ends it when the mode is left.
    const bool steaming = kind == Kind::Steam && s.active && !s.grindActive;
    switch (rank) {
    case 0: {
        // Running water shows what has been pumped when the controller measures it; otherwise the target stays.
        const bool pumped = running && s.waterPumped >= 0.5f;
        snprintf(buf, sizeof(buf), "%ld", lroundf(pumped ? s.waterPumped : s.targetTemp));
        target.set(buf);
        ui::setText(unit, pumped ? "ML" : "TARGET " BM_DEGREE "C");
        updateException(s, false, running || steaming);
        break;
    }
    case 1:
        snprintf(buf, sizeof(buf), "%ld" BM_DEGREE, lroundf(s.currentTemp));
        live.set(buf);
        ui::setTone(live.obj(), heating(s) ? Tone::HeatText : Tone::Ink);
        break;
    default:
        show(minus, s.canWake && !running);
        show(plus, s.canWake && !running);
        if (kind == Kind::Steam) {
            ui::setText(status, steaming ? "Steaming" : heating(s) ? "Heating" : "Ready");
        } else {
            ui::setPill(action, running ? "STOP" : "START", running ? Tone::Ink : Tone::Primary);
            show(action, running || s.canWake);
        }
        show(handle, !running);
        break;
    }
}

void ModeScreen::applyGrind(const UiState &s, unsigned rank) {
    char buf[24];
    char time[12];
    // A grind that is running keeps the target it was started with.
    const bool weighing = running ? s.activeGrindVolumetric : byWeight;
    const bool scaleReady = s.bluetoothScale && s.volumetricAvailable;
    switch (rank) {
    case 0:
        if (running) {
            // What has been ground against its target, or the time left of the time it was given.
            showGrindClock(s, s.grindElapsed);
            if (weighing) {
                snprintf(buf, sizeof(buf), "%.1f", grams(s.grindOutput));
                target.set(buf);
                snprintf(buf, sizeof(buf), "OF %.1f G", s.activeGrindWeight);
            } else {
                formatTime(s.activeGrindDuration, time, sizeof(time));
                snprintf(buf, sizeof(buf), "LEFT OF %s", time);
            }
        } else if (weighing) {
            snprintf(buf, sizeof(buf), "%.1f", s.grindWeight);
            target.set(buf);
            snprintf(buf, sizeof(buf), "GRAMS");
        } else {
            formatTime(s.grindDuration, buf, sizeof(buf));
            target.set(buf);
            snprintf(buf, sizeof(buf), "SECONDS");
        }
        ui::setText(unit, buf);
        updateException(s, false, running);
        break;
    case 1:
        // The time the grind has run takes the row's place.
        show(live.obj(), running);
        row.select(byWeight ? 1 : 0);
        show(row.obj(), scaleReady && s.canWake && !running);
        snprintf(buf, sizeof(buf), "%.1f G " BM_MIDDOT " TARE", grams(s.weight));
        ui::setText(scale, buf);
        show(scale, scaleReady && !running);
        break;
    default:
        show(minus, s.canWake && !running);
        show(plus, s.canWake && !running);
        ui::setPill(action, running ? "STOP" : "START", running ? Tone::Ink : Tone::Primary);
        show(action, running || s.canWake);
        show(handle, !running);
        break;
    }
}

// The clocks of a running grind: the time gone, and by time what is left as the reading.
void ModeScreen::showGrindClock(const UiState &s, unsigned long elapsed) {
    char buf[12];
    if (!s.activeGrindVolumetric) {
        elapsed = std::min(elapsed, s.activeGrindDuration);
        // A countdown reads 0:01 until it is over.
        formatTime(s.activeGrindDuration - elapsed + 999, buf, sizeof(buf));
        target.set(buf);
    }
    formatTime(elapsed, buf, sizeof(buf));
    live.set(buf);
}

} // namespace bm
