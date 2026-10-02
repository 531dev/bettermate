#include "StandbyScreen.h"

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

static const char *const WEEKDAYS[] = {"SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"};
static const char *const WEEKDAYS_SHORT[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
static const char *const MONTHS[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};

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
            snprintf(buf, len, "STANDBY " BM_MIDDOT " %ld " BM_DEGREE "C", lroundf(s.currentTemp));
            return {ui::Tone::Neutral, buf, nullptr};
        }
        return {ui::Tone::Neutral, "STANDBY", nullptr};
    }
}

// The one warning worth a badge while the machine is off: something to fix before the next shot.
// Flush and temperature warnings only mean something once the machine is on.
static bool standbyWarning(const UiState &s, ui::Tone &tone, const char *&word) {
    static const struct {
        WarningType type;
        const char *word;
    } ORDER[] = {
        {WARNING_WATER, "WATER LOW"},
        {WARNING_SWITCH, "STEAM SWITCH ON"},
        {WARNING_SCALE_CONNECTED, "SCALE LOST"},
        {WARNING_SCALE_BATTERY, "SCALE BATTERY LOW"},
    };
    for (const auto &entry : ORDER) {
        if (s.error[entry.type] || s.warn[entry.type]) {
            tone = s.error[entry.type] ? ui::Tone::Danger : ui::Tone::Warning;
            word = entry.word;
            return true;
        }
    }
    return false;
}

void StandbyScreen::build(lv_obj_t *root) {
    status = ui::row(root, tokens::SPACE_3);
    lv_obj_align(status, LV_ALIGN_TOP_MID, 0, tokens::SPACE_6);
    wifi = ui::icon(status, &bm_icon_wifi_24, Fg::Muted);
    bluetooth = ui::icon(status, &bm_icon_bluetooth_24, Fg::Muted);
    update_ = ui::icon(status, &bm_icon_refresh_cw_24, Fg::Muted);

    warning = ui::badge(root);
    lv_obj_align(warning.root, LV_ALIGN_TOP_MID, 0, tokens::SPACE_6);
    ui::setVisible(warning.root, false);

    center = ui::column(root, tokens::SPACE_6);
    lv_obj_center(center);

    alert = ui::icon(center, &bm_icon_triangle_alert_72, Fg::Danger);
    ui::setVisible(alert, false);

    clockBlock = ui::column(center, tokens::SPACE_1);
    date = ui::label(clockBlock, Type::Label, Fg::Muted);
    lv_obj_t *clockRow = ui::row(clockBlock, tokens::SPACE_2, LV_FLEX_ALIGN_END);
    clock = ui::label(clockRow, Type::Metric, Fg::Ink);
    meridiem = ui::label(clockRow, Type::MetricSm, Fg::Muted);
    // Both line boxes sit on the row's bottom edge; lift the small one so the two baselines meet.
    lv_obj_set_style_translate_y(meridiem, -3, 0);
    ui::setVisible(clockBlock, false);

    wordmark = ui::icon(center, &bm_wordmark, Fg::Ink);

    statusBlock = ui::column(center, tokens::SPACE_3);
    badge = ui::badge(statusBlock);
    sentence = ui::label(statusBlock, Type::Body, Fg::Muted);
    lv_obj_set_style_text_align(sentence, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_max_width(sentence, SENTENCE_WIDTH, 0);
    ui::setVisible(sentence, false);

    hint = ui::row(root, tokens::SPACE_2);
    lv_obj_align(hint, LV_ALIGN_BOTTOM_MID, 0, -tokens::SPACE_10);
    hintIcon = ui::icon(hint, &bm_icon_hand_24, Fg::Muted);
    hintText = ui::label(hint, Type::Label, Fg::Muted, "TAP TO WAKE");

    lv_obj_add_event_cb(
        root, [](lv_event_t *e) { static_cast<StandbyScreen *>(lv_event_get_user_data(e))->host.wake(); }, LV_EVENT_CLICKED,
        this);
}

void StandbyScreen::onShow(const UiState &state) {
    shownAt = state.now;
    update(state);
}

void StandbyScreen::update(const UiState &s) {
    char buf[40];

    const bool blocked = s.system == SystemPhase::ProtocolMismatch || s.system == SystemPhase::Error;
    const StandbyStatus now = describe(s, buf, sizeof(buf));

    ui::setBadge(badge, now.tone, now.word);
    ui::setVisible(sentence, now.sentence != nullptr);
    if (now.sentence != nullptr)
        ui::setText(sentence, now.sentence);

    ui::Tone warningTone = ui::Tone::Warning;
    const char *warningWord = nullptr;
    const bool warned = !blocked && standbyWarning(s, warningTone, warningWord);
    // Keep warnings and faults visible even after the AMOLED rest timeout.
    const bool resting =
        theme().id() == ThemeId::Amoled && s.system == SystemPhase::Ready && !warned && s.now - shownAt >= REST_AFTER_MS;
    if (warned)
        ui::setBadge(warning, warningTone, warningWord);
    ui::setVisible(warning.root, warned && !resting);
    ui::setVisible(status, !warned && !resting);
    ui::setFg(wifi, s.wifiConnected ? Fg::Ink : Fg::Muted);
    ui::setFg(bluetooth, s.controllerConnected ? Fg::Ink : Fg::Muted);
    ui::setFg(update_, s.updateAvailable || s.system == SystemPhase::Updating ? Fg::Ink : Fg::Muted);

    const bool showClock = s.timeValid && !blocked;
    if (showClock) {
        char dateBuf[32];
        snprintf(dateBuf, sizeof(dateBuf), "%s " BM_MIDDOT " %d %s", WEEKDAYS[s.time.tm_wday % 7], s.time.tm_mday,
                 MONTHS[s.time.tm_mon % 12]);
        ui::setText(date, dateBuf);
        char timeBuf[8];
        const char *suffix = formatTime(s.time.tm_hour, s.time.tm_min, s.clock24h, timeBuf, sizeof(timeBuf));
        ui::setText(clock, timeBuf);
        ui::setText(meridiem, suffix);
        ui::setVisible(meridiem, suffix[0] != '\0');
    }
    ui::setVisible(clockBlock, showClock);
    ui::setVisible(date, !resting);
    ui::setVisible(alert, blocked);
    // With no clock to show, the wordmark is what stays lit.
    ui::setVisible(wordmark, !blocked && (!resting || !showClock));
    ui::setFg(wordmark, resting ? Fg::Muted : Fg::Ink);
    ui::setVisible(statusBlock, !resting);

    updateHint(s, s.canWake && now.sentence == nullptr && !resting);
    updateRest(s, resting);
}

void StandbyScreen::updateHint(const UiState &s, bool visible) {
    ui::setVisible(hint, visible);
    if (!visible)
        return;
    if (!s.wakeScheduled) {
        ui::setIcon(hintIcon, &bm_icon_hand_24);
        ui::setText(hintText, "TAP TO WAKE");
        return;
    }
    // A machine that wakes itself says when, and names the day once that is more than a day away.
    char timeBuf[8];
    char text[32];
    const char *suffix = formatTime(s.wakeHour, s.wakeMinute, s.clock24h, timeBuf, sizeof(timeBuf));
    if (s.wakeInMinutes < 24 * 60)
        snprintf(text, sizeof(text), "WAKES %s%s%s", timeBuf, suffix[0] ? " " : "", suffix);
    else
        snprintf(text, sizeof(text), "WAKES %s %s%s%s", WEEKDAYS_SHORT[s.wakeWeekday % 7], timeBuf, suffix[0] ? " " : "", suffix);
    ui::setIcon(hintIcon, &bm_icon_clock_24);
    ui::setText(hintText, text);
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
