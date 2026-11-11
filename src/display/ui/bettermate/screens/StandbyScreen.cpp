#include "StandbyScreen.h"

#include <cmath>
#include <cstdio>

namespace bm {
namespace {
#define BM_DEGREE "\xC2\xB0"
#define BM_MIDDOT "\xC2\xB7"

constexpr int CLOCK_BASELINE = 256;
// At rest the clock is alone, so it sits on the panel's centre line.
constexpr int REST_BASELINE = 282;
// On an AMOLED panel a still picture burns in: after this long only the clock stays lit, and it drifts.
constexpr unsigned long REST_AFTER_MS = 30000;
constexpr unsigned long DRIFT_EVERY_MS = 60000;
constexpr int DRIFT_STEP_PX = 2;

const char *const WEEKDAYS[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
const char *const WEEKDAYS_TITLE[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
const char *const MONTHS[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};

// "9:41" plus AM or PM for a 12-hour clock, "09:41" and no suffix for a 24-hour one.
const char *formatClock(int hour, int minute, bool clock24h, char *buf, size_t len) {
    if (clock24h) {
        snprintf(buf, len, "%02d:%02d", hour, minute);
        return "";
    }
    snprintf(buf, len, "%d:%02d", hour % 12 == 0 ? 12 : hour % 12, minute);
    return hour < 12 ? "AM" : "PM";
}

// A triangle wave in whole steps: 0, 1, .., peak, .., 0, .., -peak, .., 0
int triangle(int step, int peak) {
    const int period = peak * 4;
    const int phase = ((step % period) + period) % period;
    if (phase <= peak)
        return phase;
    if (phase <= peak * 3)
        return peak * 2 - phase;
    return phase - period;
}

struct Status {
    const char *word;     // takes the date's place; nullptr while the machine is simply asleep
    const char *sentence; // takes the line under the clock
    bool busy;            // the comet circles and WAKE is away
    bool blocked;         // a fault: the word is drawn in danger
};

Status describe(const UiState &s) {
    switch (s.system) {
    case SystemPhase::Starting:
        return {"STARTING", "Starting up", true, false};
    case SystemPhase::WaitingForController:
        return {"CONNECTING", "Waiting for the controller", true, false};
    case SystemPhase::Updating:
        return {"UPDATING", "Keep the machine switched on", true, false};
    case SystemPhase::Autotuning:
        return {"AUTOTUNING", "Tuning the boiler", true, false};
    case SystemPhase::ProtocolMismatch:
        return {"VERSION MISMATCH", s.displayOutdated ? "Update the display" : "Update the controller", false, true};
    case SystemPhase::Error:
        return {s.temperatureError ? "TEMPERATURE ERROR" : "ERROR", s.temperatureError ? "Restart the machine" : "Unknown error",
                false, true};
    case SystemPhase::Ready:
    default:
        return {nullptr, nullptr, false, false};
    }
}
} // namespace

void StandbyScreen::build(lv_obj_t *root) {
    addException();
    label = part(ui::text(root, 240, 136, Type::Label, Tone::Muted, "", 232), 0);
    clock.build(root, 240, CLOCK_BASELINE, Type::Hero, Tone::Ink);
    part(clock.obj(), 0);
    line = part(ui::text(root, 240, 298, Type::Body, Tone::Muted, "", tokens::DISPLAY_SQUARE), 1);
    wake = part(ui::pill(root, 240, 330, 176, "WAKE", Tone::Primary), 2);
    bind(wake, Intent::Wake);
}

void StandbyScreen::onEnter(const UiState &state) {
    enteredAt = state.now;
    restStep = -2;
}

void StandbyScreen::update(const UiState &s) {
    const Status status = describe(s);
    const bool resting = s.amoledPanel && s.system == SystemPhase::Ready && s.now - enteredAt >= REST_AFTER_MS;
    char buf[72];

    // The ring answers "is it still warm" without inviting a tap; the comet says the machine is busy.
    TickRing &ring = host.ring();
    ring.pulse(false);
    ring.busy(status.busy);
    if (resting)
        ring.show(TickRing::Layout::None);
    else
        ring.show(TickRing::Layout::Single, {TickRing::fraction(s.currentTemp, TickRing::MAX_TEMPERATURE), -1.0f, Tone::Faint});

    char time[8] = "";
    const char *meridiem = "";
    if (s.timeValid)
        meridiem = formatClock(s.time.tm_hour, s.time.tm_min, s.clock24h, time, sizeof(time));
    clock.set(time);
    ui::setTone(clock.obj(), resting ? Tone::Faint : Tone::Ink);
    show(clock.obj(), s.timeValid);

    if (status.word != nullptr) {
        ui::setText(label, status.word);
    } else if (s.timeValid) {
        snprintf(buf, sizeof(buf), "%s %d %s%s%s", WEEKDAYS[s.time.tm_wday % 7], s.time.tm_mday, MONTHS[s.time.tm_mon % 12],
                 meridiem[0] ? " " BM_MIDDOT " " : "", meridiem);
        ui::setText(label, buf);
    }
    ui::setTone(label, status.blocked ? Tone::Danger : Tone::Muted);
    show(label, !resting && (status.word != nullptr || s.timeValid));

    // One line says what happens next.
    if (status.sentence != nullptr) {
        snprintf(buf, sizeof(buf), "%s", status.sentence);
    } else if (s.canWake && s.wakeScheduled) {
        char wakeTime[8];
        const char *suffix = formatClock(s.wakeHour, s.wakeMinute, s.clock24h, wakeTime, sizeof(wakeTime));
        if (s.wakeInMinutes < 24 * 60)
            snprintf(buf, sizeof(buf), "Wakes at %s%s%s", wakeTime, suffix[0] ? " " : "", suffix);
        else
            snprintf(buf, sizeof(buf), "Wakes %s at %s%s%s", WEEKDAYS_TITLE[s.wakeWeekday % 7], wakeTime, suffix[0] ? " " : "", suffix);
    } else if (s.controllerConnected && s.currentTemp > 0) {
        snprintf(buf, sizeof(buf), "Boiler off " BM_MIDDOT " %ld" BM_DEGREE, lroundf(s.currentTemp));
    } else {
        snprintf(buf, sizeof(buf), "Boiler off");
    }
    ui::setText(line, buf);
    show(line, !resting);
    show(wake, s.canWake && !status.busy && !resting);
    // Warnings stay visible through rest.
    updateException(s, true);
    place(s, resting);
}

void StandbyScreen::place(const UiState &s, bool resting) {
    const int step = resting ? static_cast<int>((s.now - enteredAt - REST_AFTER_MS) / DRIFT_EVERY_MS) : -1;
    if (step == restStep)
        return;
    restStep = step;
    // One move of two pixels a minute, alternating between the axes, inside a 12 x 8 px box.
    const int dx = resting ? triangle((step + 1) / 2, 3) * DRIFT_STEP_PX : 0;
    const int dy = resting ? triangle(step / 2, 2) * DRIFT_STEP_PX : 0;
    clock.moveTo(240 + dx, (resting ? REST_BASELINE : CLOCK_BASELINE) + dy);
}

} // namespace bm
