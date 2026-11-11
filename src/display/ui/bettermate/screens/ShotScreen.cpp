#include "ShotScreen.h"

#include <Arduino.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <display/ui/bettermate/Motion.h>

namespace bm {
namespace {
#define BM_DEGREE "\xC2\xB0"
#define TEMPERATURE_LABEL "TEMPERATURE %ld" BM_DEGREE

// Panel pixels from the design (design/reference/components/bundle.js, screens.shot).
constexpr int CENTRE = tokens::DISPLAY_SIZE / 2;
constexpr int LABEL_BASELINE = 94;
constexpr int LABEL_WIDTH = 216;
constexpr int TIMER_BASELINE = 206;
constexpr int BARS_X = 130;
constexpr int BARS_Y = 228;
constexpr int BARS_WIDTH = 220;
// Two values sit either side of the centre line; one alone sits on it.
constexpr int VALUE_X[2] = {172, 308};
constexpr int VALUE_BASELINE = 296;
constexpr int CAPTION_BASELINE = 324;
constexpr int CAPTION_WIDTH = 128;
constexpr int ACTION_Y = 344;
constexpr int ACTION_WIDTH = 168;

// The label face is fixed width: this many glyphs fill the label.
constexpr unsigned LABEL_GLYPHS = 16;
// The boiler has strayed when it is more than 3 degrees off the shot's target, and has recovered once it is
// back within 2, the machine's own measure of a stable boiler.
constexpr float STRAYED = 3.0f;
constexpr float RECOVERED = 2.0f;
// The timer reads minutes and seconds. Nothing the machine brews comes near this.
constexpr unsigned long LONGEST_MS = 99UL * 60000UL + 59999UL;

// The running phase's name as the label face can draw it: in capitals, and no longer than the label.
void phaseLabel(const UiState::Shot &shot, char *out, size_t size) {
    snprintf(out, size, "%s", shot.phaseName.empty() ? shot.phaseType.c_str() : shot.phaseName.c_str());
    upper(out);
    unsigned glyphs = 0;
    size_t cut = 0;
    for (size_t i = 0; out[i] != '\0'; ++i) {
        if ((static_cast<unsigned char>(out[i]) & 0xC0) == 0x80)
            continue; // inside a glyph
        if (glyphs == LABEL_GLYPHS - 3)
            cut = i;
        ++glyphs;
    }
    if (glyphs <= LABEL_GLYPHS || cut + 4 > size)
        return;
    while (cut > 0 && out[cut - 1] == ' ')
        --cut;
    strcpy(out + cut, "...");
}
} // namespace

void ShotScreen::build(lv_obj_t *root) {
    // No exception slot and no handle: while the pump runs nothing but STOP may end the shot.
    label = part(ui::text(root, CENTRE, LABEL_BASELINE, Type::Label, Tone::Muted, "", LABEL_WIDTH), 0);
    timer.build(root, CENTRE, TIMER_BASELINE, Type::Hero, Tone::Ink);
    part(timer.obj(), 0);
    bars.build(root, BARS_X, BARS_Y, BARS_WIDTH);
    part(bars.obj(), 1);
    for (unsigned i = 0; i < 2; ++i) {
        Value &v = values[i];
        v.fact = Fact::None;
        v.cx = VALUE_X[i];
        v.reading.build(root, v.cx, VALUE_BASELINE, Type::Value, Tone::Ink);
        part(v.reading.obj(), 1);
        v.caption = part(ui::text(root, v.cx, CAPTION_BASELINE, Type::Label, Tone::Muted, "", CAPTION_WIDTH), 1);
    }
    // Cobalt starts things; ink stops them.
    action = part(ui::pill(root, CENTRE, ACTION_Y, ACTION_WIDTH, "STOP", Tone::Ink), 2);
    bind(action, Intent::Finish);
}

void ShotScreen::onEnter(const UiState &) {
    // Nothing of an earlier shot may show before this one has been read.
    fresh = true;
    straying = false;
    says = Says::Nothing;
    ui::setText(label, "");
    timer.set("0:00");
    ui::setPill(action, "STOP", Tone::Ink);
    bars.plan(nullptr, 0);
    for (Value &v : values) {
        v.fact = Fact::None;
        show(v.reading.obj(), false);
        show(v.caption, false);
    }
}

void ShotScreen::update(const UiState &s) {
    const auto &shot = s.shot;
    // Between a shot and the change of screen that follows it there is no process: what is shown stays.
    if (!shot.valid)
        return;
    // The pump has stopped by itself: the result stays until it is acknowledged.
    const bool finished = !shot.active;
    // Once the pump stops the boiler goes back to the selected profile's temperature.
    const float target = shot.active && shot.targetTemp > 0 ? shot.targetTemp : s.targetTemp;
    // A flush is a rinse, so its temperature is never an exception.
    const float off = target > 0 ? std::fabs(s.currentTemp - target) : 0.0f;
    straying = shot.active && !shot.utility && off > (straying ? RECOVERED : STRAYED);
    if (fresh) {
        temperature = lroundf(s.currentTemp);
        temperatureAt = numbersAt = frames;
    }

    // Brew's ring, so nothing on the rim redraws when the shot starts.
    TickRing &ring = host.ring();
    const TickRing::Arc boiler{TickRing::fraction(s.currentTemp, TickRing::MAX_TEMPERATURE),
                               target > 0 ? TickRing::fraction(target, TickRing::MAX_TEMPERATURE) : -1.0f, Tone::Heat};
    ring.busy(false);
    ring.pulse(straying && s.currentTemp < target);
    if (s.pressureAvailable) {
        // The notch is the running phase's pressure target; a phase that sets pump power has none. When the
        // pump stops the ticks walk down two a frame.
        const bool aimed = shot.active && s.targetPressure > 0;
        ring.show(TickRing::Layout::Split, boiler,
                  {TickRing::fraction(s.pressure, TickRing::MAX_PRESSURE),
                   aimed ? TickRing::fraction(s.targetPressure, TickRing::MAX_PRESSURE) : -1.0f, Tone::Primary,
                   static_cast<uint8_t>(finished ? 2 : 0)});
    } else {
        // Without a pressure sensor temperature keeps the whole ring.
        ring.show(TickRing::Layout::Single, boiler);
    }

    bars.plan(shot.phaseDurations, shot.phaseCount > 0 ? static_cast<unsigned>(shot.phaseCount) : 0);
    advance(s);
    if (fresh)
        bars.settle();
    say(s, finished);
    arrange(s, finished);
    ui::setPill(action, finished ? "DONE" : "STOP", finished ? Tone::Primary : Tone::Ink);
    fresh = false;
}

void ShotScreen::tick(const UiState &s, uint32_t) {
    ++frames;
    if (s.shot.valid) {
        // The timer flips when its second has passed. The other numbers keep a cadence of their own and give
        // way to the timer for a frame, so no frame pays for both.
        advance(s);
        if (!flipped && frames - numbersAt >= motion::SNAPSHOT_EVERY) {
            numbersAt = frames;
            numbers(s);
        }
    }
    bars.step();
    flipped = false;
}

// Pressure and weight change at most four times a second and temperature at most twice, however often the
// machine reports them.
void ShotScreen::numbers(const UiState &s) {
    if (frames - temperatureAt >= 2 * motion::SNAPSHOT_EVERY) {
        temperatureAt = frames;
        temperature = lroundf(s.currentTemp);
        if (says == Says::Temperature) {
            char buf[32];
            snprintf(buf, sizeof(buf), TEMPERATURE_LABEL, temperature);
            ui::setText(label, buf);
        }
    }
    for (Value &v : values)
        write(v, s);
}

// The timer and the stage bars run between snapshots: both are read off the snapshot and its age.
void ShotScreen::advance(const UiState &s) {
    const auto &shot = s.shot;
    unsigned long elapsed = shot.elapsed;
    float progress = shot.progress / 100.0f;
    // Only a shot that ran through every phase stays on this screen once its pump has stopped.
    unsigned phase = shot.phaseCount > 0 ? static_cast<unsigned>(shot.phaseCount) : 0;
    if (shot.active) {
        // The pump is running, so the shot is as much older as the snapshot is: the second flips on time.
        const unsigned long age = millis() - s.now;
        elapsed += age;
        // A phase that ends by time fills its bar by the clock; one that ends by weight waits for the scale.
        if (!shot.phaseWeight && shot.phaseTarget > 0)
            progress = (shot.phaseCurrent + static_cast<float>(age) / 1000.0f) / shot.phaseTarget;
        phase = shot.phaseIndex > 0 ? static_cast<unsigned>(shot.phaseIndex) : 0;
    }
    bars.set(phase, progress);
    untilFlip = shot.active ? 1000 - elapsed % 1000 : ~0UL;

    char buf[12];
    formatTime(std::min(elapsed, LONGEST_MS), buf, sizeof(buf));
    if (strcmp(buf, timer.text()) != 0) {
        timer.set(buf);
        flipped = true;
    }
}

void ShotScreen::say(const UiState &s, bool finished) {
    const auto &shot = s.shot;
    char buf[64];
    Says next;
    if (finished) {
        // With delay adjustment on, the machine weighs what still drips for a few seconds after the pump stops.
        next = !shot.complete && shot.phaseName == "Calibrating" ? Says::Calibrating : Says::Complete;
        snprintf(buf, sizeof(buf), "%s", next == Says::Calibrating ? "CALIBRATING" : "SHOT COMPLETE");
    } else if (straying) {
        next = Says::Temperature;
        snprintf(buf, sizeof(buf), TEMPERATURE_LABEL, temperature);
    } else {
        next = Says::Phase;
        phaseLabel(shot, buf, sizeof(buf));
    }
    // A new message steps in by recolour over three frames; a new number in the same message snaps. While the
    // pump runs a new message waits for three frames the timer leaves alone, so no frame pays for both.
    const bool message = next != says || (next == Says::Phase && strcmp(lv_label_get_text(label), buf) != 0);
    if (message && !fresh && !finished && (flipped || untilFlip <= motion::MICRO * motion::FRAME_MS_ODD))
        return;
    says = next;
    if (message)
        show(label, false);
    ui::setText(label, buf);
    ui::setTone(label, next == Says::Temperature ? Tone::HeatText : Tone::Muted);
    if (message)
        show(label, true);
}

void ShotScreen::arrange(const UiState &s, bool finished) {
    const auto &shot = s.shot;
    Fact wanted[2] = {Fact::None, Fact::None};
    if (!finished) {
        // Pressure is a number only here, and only with a sensor to read it.
        if (s.pressureAvailable)
            wanted[0] = Fact::Pressure;
        // The controller weighs a shot, never a flush. Without a weight the boiler takes the place.
        const bool weighed = s.volumetricAvailable && !shot.utility;
        wanted[1] = !weighed ? Fact::Temperature : shot.volumetric && shot.targetWeight > 0 ? Fact::WeightOfTarget : Fact::Weight;
    } else if (shot.weight > 0.05) {
        // A shot that was weighed leaves its yield, and its ratio when the profile knows the dose.
        wanted[0] = Fact::Yield;
        if (s.profileDose > 0)
            wanted[1] = Fact::Ratio;
    }
    const bool both = wanted[0] != Fact::None && wanted[1] != Fact::None;
    for (unsigned i = 0; i < 2; ++i) {
        Value &v = values[i];
        const int cx = both ? VALUE_X[i] : CENTRE;
        if (v.fact == wanted[i] && (v.fact == Fact::None || v.cx == cx))
            continue;
        // A value that says something new leaves with a cut and steps in again, in its place.
        show(v.reading.obj(), false);
        show(v.caption, false);
        v.fact = wanted[i];
        if (v.fact == Fact::None)
            continue;
        v.cx = cx;
        v.reading.moveTo(cx, VALUE_BASELINE);
        lv_obj_set_x(v.caption, cx - CENTRE);
        write(v, s);
        show(v.reading.obj(), true);
        show(v.caption, true);
    }
}

void ShotScreen::write(Value &v, const UiState &s) {
    const auto &shot = s.shot;
    // A scale at rest reads a hair either side of nothing.
    const double weight = std::fabs(shot.weight) < 0.05 ? 0.0 : shot.weight;
    char value[16] = "";
    char caption[16] = "";
    switch (v.fact) {
    case Fact::None:
        return;
    case Fact::Pressure:
        snprintf(value, sizeof(value), "%.1f", std::max(0.0f, s.pressure));
        snprintf(caption, sizeof(caption), "BAR");
        break;
    case Fact::WeightOfTarget:
        snprintf(value, sizeof(value), "%.1f", weight);
        // A whole target reads "/ 36 G"; any other keeps its tenth.
        if (std::fabs(shot.targetWeight - roundf(shot.targetWeight)) < 0.05f)
            snprintf(caption, sizeof(caption), "/ %.0f G", shot.targetWeight);
        else
            snprintf(caption, sizeof(caption), "/ %.1f G", shot.targetWeight);
        break;
    case Fact::Weight:
    case Fact::Yield:
        snprintf(value, sizeof(value), "%.1f", weight);
        snprintf(caption, sizeof(caption), "GRAMS");
        break;
    case Fact::Temperature:
        snprintf(value, sizeof(value), "%ld", temperature);
        snprintf(caption, sizeof(caption), BM_DEGREE "C");
        break;
    case Fact::Ratio:
        snprintf(value, sizeof(value), "1:%.1f", weight / s.profileDose);
        snprintf(caption, sizeof(caption), "RATIO");
        break;
    }
    v.reading.set(value);
    ui::setText(v.caption, caption);
}

} // namespace bm
