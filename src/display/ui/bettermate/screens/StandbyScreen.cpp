#include "StandbyScreen.h"
#include <display/ui/bettermate/LuxuryUI.h>

#include <cmath>
#include <cstdio>

namespace bm {

#define BM_DEGREE "\xC2\xB0"
#define BM_MIDDOT "\xC2\xB7"

// The longest sentence still has to clear the curve: keep it inside the text square.
static constexpr lv_coord_t SENTENCE_WIDTH = tokens::DISPLAY_SQUARE;

// On the AMOLED panel a still image burns in: after this long only the clock stays lit, and it drifts.
static constexpr unsigned long REST_AFTER_MS = 30000;
static constexpr unsigned long DRIFT_EVERY_MS = 60000;
static constexpr int DRIFT_STEP_PX = 2;

static const char *const WEEKDAYS[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
static const char *const WEEKDAYS_SHORT_TITLE[] = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};

// "9:41" plus AM or PM for a 12-hour clock, "09:41" and no suffix for a 24-hour one.
static const char *formatTime(int hour, int minute, bool clock24h, char *buf, size_t len) {
    if (clock24h) {
        snprintf(buf, len, "%02d:%02d", hour, minute);
        return "";
    }
    const int hour12 = hour % 12 == 0 ? 12 : hour % 12;
    snprintf(buf, len, "%d:%02d", hour12, minute);
    return hour < 12 ? "AM" : "PM";
}

// A triangle wave in whole steps: 0, 1, .., peak, .., 0, .., -peak, .., 0
static int triangle(int step, int peak) {
    const int period = peak * 4;
    const int phase = ((step % period) + period) % period;
    if (phase <= peak)
        return phase;
    if (phase <= peak * 3)
        return peak * 2 - phase;
    return phase - period;
}

struct StandbyStatus {
    ui::Tone tone;
    const char *word;
    const char *sentence; // nullptr when the word says it all
};

static StandbyStatus describe(const UiState &s, char *buf, size_t len) {
    switch (s.system) {
    case SystemPhase::Starting:
        return {ui::Tone::Neutral, "STARTING", nullptr};
    case SystemPhase::WaitingForController:
        return {ui::Tone::Neutral, "CONNECTING", "Waiting for the controller"};
    case SystemPhase::Updating:
        return {ui::Tone::Brewing, "UPDATING", "Keep the machine switched on"};
    case SystemPhase::Autotuning:
        return {ui::Tone::Brewing, "AUTOTUNING", "Tuning the boiler"};
    case SystemPhase::ProtocolMismatch:
        return {ui::Tone::Danger, "VERSION MISMATCH", s.displayOutdated ? "Update the display" : "Update the controller"};
    case SystemPhase::Error:
        return {ui::Tone::Danger, s.temperatureError ? "TEMPERATURE ERROR" : "ERROR",
                s.temperatureError ? "Restart the machine" : "Unknown error"};
    case SystemPhase::Ready:
    default:
        if (s.controllerConnected && s.currentTemp > 0.0f) {
            snprintf(buf, len, "STANDBY " BM_MIDDOT " %ld" BM_DEGREE, lroundf(s.currentTemp));
            return {ui::Tone::Neutral, buf, nullptr};
        }
        return {ui::Tone::Neutral, "STANDBY", nullptr};
    }
}

void StandbyScreen::build(lv_obj_t *root) {
    center = ui::box(root);
    lv_obj_set_size(center, 480, 480);
    eyebrow = luxury::label(center, 0, 96, &bm_luxury_detail, "STANDBY", 300, 3);
    clockBlock = ui::box(center);
    lv_obj_set_size(clockBlock, 400, 142);
    lv_obj_set_pos(clockBlock, 40, 136);
    clock = luxury::label(clockBlock, 0, 0, &bm_luxury_clock, "", 400);
    meridiem = luxury::label(clockBlock, 0, 124, &bm_luxury_detail, "", 0, 2);
    wordmark = ui::icon(center, &bm_wordmark, Fg::Muted);
    lv_obj_align(wordmark, LV_ALIGN_TOP_MID, 0, 191);
    divider = luxury::rule(center, 0, 284, 36);
    date = luxury::label(center, 0, 303, &bm_luxury_body, "", 300);
    boiler = luxury::label(center, 0, 329, &bm_luxury_detail, "", 300, 1);
    sentence = luxury::label(center, 0, 232, &bm_luxury_body, "", SENTENCE_WIDTH);
    lv_label_set_long_mode(sentence, LV_LABEL_LONG_WRAP);
    // Exceptions only, and a slow orbit while the system is busy; neither takes input.
    indicators.build(center);
    activity = luxury::orbit(center);
    wakeButton = luxury::pill(center, 240, 404, 124, 56, "WAKE");
    // The button is a visual invitation; the whole screen shares its guarded tap.
    lv_obj_clear_flag(wakeButton, LV_OBJ_FLAG_CLICKABLE);
    wakeLabel = lv_obj_get_child(wakeButton, 0);
    lv_obj_add_event_cb(
        root, [](lv_event_t *e) { static_cast<StandbyScreen *>(lv_event_get_user_data(e))->host.act(Intent::WakeMenu); },
        LV_EVENT_CLICKED,
        this);
}

void StandbyScreen::onShow(const UiState &state) {
    shownAt = state.now;
    luxury::Instant now;
    update(state);
}

void StandbyScreen::update(const UiState &s) {
    char buf[72];
    const auto p = luxury::palette();
    luxury::background(root(), p.background);
    const bool blocked = s.system == SystemPhase::ProtocolMismatch || s.system == SystemPhase::Error;
    const StandbyStatus now = describe(s, buf, sizeof(buf));
    ui::setText(eyebrow, s.system == SystemPhase::Ready ? "STANDBY" : now.word);
    luxury::color(eyebrow, blocked ? p.danger : p.faint);
    ui::setVisible(sentence, now.sentence != nullptr);
    if (now.sentence != nullptr)
        ui::setText(sentence, now.sentence);
    luxury::color(sentence, blocked ? p.danger : p.muted);
    // System faults remain visible while the normal standby clock may rest.
    const bool resting =
        theme().id() == ThemeId::Amoled && s.system == SystemPhase::Ready && s.now - shownAt >= REST_AFTER_MS;
    const bool showClock = s.timeValid && now.sentence == nullptr;
    if (showClock) {
        ui::setText(date, WEEKDAYS[s.time.tm_wday % 7]);
        char timeBuf[8];
        const char *suffix = formatTime(s.time.tm_hour, s.time.tm_min, s.clock24h, timeBuf, sizeof(timeBuf));
        ui::setText(clock, timeBuf);
        ui::setText(meridiem, suffix);
        ui::setVisible(meridiem, suffix[0] != '\0');
    }
    luxury::color(clock, p.muted);
    luxury::color(meridiem, p.faint);
    luxury::color(date, p.muted);
    luxury::color(boiler, p.faint);
    luxury::background(divider, p.line);
    luxury::border(wakeButton, p.muted);
    luxury::color(wakeLabel, p.muted);
    // One quiet line: the boiler and, when one is scheduled, the next automatic wake.
    char wake[32] = "";
    if (s.canWake && s.wakeScheduled) {
        char timeBuf[8];
        const char *suffix = formatTime(s.wakeHour, s.wakeMinute, s.clock24h, timeBuf, sizeof(timeBuf));
        if (s.wakeInMinutes < 24 * 60)
            snprintf(wake, sizeof(wake), " " BM_MIDDOT " wakes %s%s%s", timeBuf, suffix[0] ? " " : "", suffix);
        else
            snprintf(wake, sizeof(wake), " " BM_MIDDOT " wakes %s %s%s%s", WEEKDAYS_SHORT_TITLE[s.wakeWeekday % 7], timeBuf,
                     suffix[0] ? " " : "", suffix);
    }
    if (s.controllerConnected && s.currentTemp > 0)
        snprintf(buf, sizeof(buf), "Boiler off " BM_MIDDOT " %ld" BM_DEGREE "%s", lroundf(s.currentTemp), wake);
    else
        snprintf(buf, sizeof(buf), "Boiler off%s", wake);
    ui::setText(boiler, buf);
    ui::setVisible(clockBlock, showClock);
    ui::setVisible(eyebrow, !resting);
    ui::setVisible(date, showClock && !resting);
    // A 12-hour suffix already separates the clock from the date.
    ui::setVisible(divider, !resting && now.sentence == nullptr && !(showClock && !s.clock24h));
    ui::setVisible(boiler, !resting && s.system == SystemPhase::Ready);
    ui::setVisible(wordmark, !blocked && !showClock && now.sentence == nullptr);
    ui::setVisible(wakeButton, s.canWake && !resting);
    indicators.update(s, true, true);
    if (resting)
        ui::setVisible(lv_obj_get_parent(indicators.warning), false);
    else
        ui::setVisible(lv_obj_get_parent(indicators.warning), true);
    const bool busy = s.system == SystemPhase::Starting || s.system == SystemPhase::WaitingForController ||
                      s.system == SystemPhase::Updating || s.system == SystemPhase::Autotuning;
    luxury::orbiting(activity, busy);
    updateRest(s, resting);
}

void StandbyScreen::updateRest(const UiState &s, bool resting) {
    const int step = resting ? static_cast<int>((s.now - shownAt - REST_AFTER_MS) / DRIFT_EVERY_MS) : -1;
    if (step == restStep)
        return;
    restStep = step;
    // One move of two pixels a minute, alternating between the axes, inside a 12 x 8 px box.
    const int dx = resting ? triangle((step + 1) / 2, 3) * DRIFT_STEP_PX : 0;
    const int dy = resting ? triangle(step / 2, 2) * DRIFT_STEP_PX : 0;
    lv_obj_set_style_translate_x(center, dx, 0);
    lv_obj_set_style_translate_y(center, dy, 0);
}

} // namespace bm
