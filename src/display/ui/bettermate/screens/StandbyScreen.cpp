#include "StandbyScreen.h"

#include <cmath>
#include <cstdio>

namespace bm {
namespace {
#define BM_DEGREE "\xC2\xB0"
#define BM_MIDDOT "\xC2\xB7"

// The date, the clock and the line under it are centred on the panel as one group.
constexpr int LABEL_BASELINE = 166;
constexpr int CLOCK_BASELINE = 286;
constexpr int LINE_BASELINE = 328;
// At rest the clock is alone, so it sits on the panel's centre line.
constexpr int REST_BASELINE = 282;
// On an AMOLED panel a still picture burns in: after this long only the clock stays lit, and it drifts.
constexpr unsigned long REST_AFTER_MS = 30000;
constexpr unsigned long DRIFT_EVERY_MS = 60000;
constexpr int DRIFT_STEP_PX = 2;

const char *const WEEKDAYS[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
const char *const WEEKDAYS_TITLE[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
const char *const MONTHS[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};

// The clock is 24-hour everywhere in the system (design/reference/content.md): "06:30", never a suffix.
void formatClock(int hour, int minute, char *buf, size_t len) { snprintf(buf, len, "%02d:%02d", hour, minute); }

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
    const char *sentence; // takes the line under the clock; nullptr while the machine is simply asleep
    bool busy;            // the comet circles
};

// The date stays above the clock in every state Standby shows (DisplayStates: Connecting). A fault that blocks
// brewing and a firmware update have screens of their own; the host never leaves Standby on the glass for them.
Status describe(const UiState &s) {
    switch (s.system) {
    case SystemPhase::Starting:
    case SystemPhase::WaitingForController:
        return {"Waiting for the controller", true};
    case SystemPhase::Updating:
        return {"Keep the machine on", true};
    case SystemPhase::Autotuning:
        return {"Tuning the boiler", true};
    case SystemPhase::ProtocolMismatch:
        return {s.displayOutdated ? "Update the display" : "Update the controller", false};
    case SystemPhase::Error:
        return {"Switch the machine off", false};
    case SystemPhase::Ready:
    default:
        return {nullptr, false};
    }
}
} // namespace

void StandbyScreen::build(lv_obj_t *root) {
    addException();
    label = part(ui::text(root, 240, LABEL_BASELINE, Type::Label, Tone::Muted, "", 232), 0);
    clock.build(root, 240, CLOCK_BASELINE, Type::Hero, Tone::Ink);
    part(clock.obj(), 0);
    line = part(ui::text(root, 240, LINE_BASELINE, Type::Body, Tone::Muted, "", tokens::DISPLAY_SQUARE), 1);
}

void StandbyScreen::onEnter(const UiState &state) {
    enteredAt = state.now;
    restStep = -2;
    wasResting = false;
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
    if (s.timeValid)
        formatClock(s.time.tm_hour, s.time.tm_min, time, sizeof(time));
    clock.set(time);
    ui::setTone(clock.obj(), resting ? Tone::Faint : Tone::Ink);
    show(clock.obj(), s.timeValid);

    // "THU 12 NOV": weekday, day, month, three letters each.
    if (s.timeValid) {
        snprintf(buf, sizeof(buf), "%s %d %s", WEEKDAYS[s.time.tm_wday % 7], s.time.tm_mday, MONTHS[s.time.tm_mon % 12]);
        ui::setText(label, buf);
    }
    show(label, !resting && s.timeValid);

    // One line says what happens next: what the machine is busy with, an update that waits, the next wake-up,
    // or how warm the boiler still is. At most 25 characters.
    if (status.sentence != nullptr) {
        snprintf(buf, sizeof(buf), "%s", status.sentence);
    } else if (s.updateAvailable) {
        if (!s.updateVersion.empty() && s.updateVersion.size() <= 9)
            snprintf(buf, sizeof(buf), "Update %s is ready", s.updateVersion.c_str());
        else
            snprintf(buf, sizeof(buf), "An update is ready");
    } else if (s.canWake && s.wakeScheduled) {
        char wakeTime[8];
        formatClock(s.wakeHour, s.wakeMinute, wakeTime, sizeof(wakeTime));
        if (s.wakeInMinutes < 24 * 60)
            snprintf(buf, sizeof(buf), "Wakes at %s", wakeTime);
        else
            snprintf(buf, sizeof(buf), "Wakes %s at %s", WEEKDAYS_TITLE[s.wakeWeekday % 7], wakeTime);
    } else if (s.controllerConnected && s.currentTemp > 0) {
        snprintf(buf, sizeof(buf), "Boiler off " BM_MIDDOT " %ld" BM_DEGREE, lroundf(s.currentTemp));
    } else {
        snprintf(buf, sizeof(buf), "Boiler off");
    }
    ui::setText(line, buf);
    show(line, !resting);
    // Warnings stay visible through rest.
    updateException(s, true);
    // The clock moves to the centre one snapshot after the rest of the screen has left: two small repaints
    // instead of one over the budget.
    place(s, resting && wasResting);
    wasResting = resting;
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
