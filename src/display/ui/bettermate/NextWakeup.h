#ifndef BETTERMATE_NEXT_WAKEUP_H
#define BETTERMATE_NEXT_WAKEUP_H

#include <cstring>
#include <ctime>

namespace bm {

struct NextWakeup {
    bool scheduled = false;
    int hour = 0;
    int minute = 0;
    int weekday = 0; // tm_wday: Sunday = 0
    int inMinutes = 0;
};

// Schedules store Monday-first days and HH:MM local wall time, just like AutoWakeupPlugin.
// Include the current minute: the plugin may still be about to fire during that minute.
template <typename Schedules> NextWakeup nextWakeup(const tm &now, const Schedules &schedules) {
    NextWakeup next;
    for (const auto &schedule : schedules) {
        const char *time = schedule.time.c_str();
        if (std::strlen(time) != 5 || time[2] != ':' || time[0] < '0' || time[0] > '9' || time[1] < '0' || time[1] > '9' ||
            time[3] < '0' || time[3] > '9' || time[4] < '0' || time[4] > '9')
            continue;
        const int hour = (time[0] - '0') * 10 + time[1] - '0';
        const int minute = (time[3] - '0') * 10 + time[4] - '0';
        if (hour > 23 || minute > 59)
            continue;

        // Seven days ahead includes today's schedule next week when today's time has passed.
        for (int daysAhead = 0; daysAhead <= 7; ++daysAhead) {
            const int weekday = (now.tm_wday + daysAhead) % 7;
            if (!schedule.days[(weekday + 6) % 7])
                continue;
            const int minutes = daysAhead * 24 * 60 + hour * 60 + minute - now.tm_hour * 60 - now.tm_min;
            if (minutes < 0)
                continue;
            if (!next.scheduled || minutes < next.inMinutes)
                next = {true, hour, minute, weekday, minutes};
            break;
        }
    }
    return next;
}

} // namespace bm

#endif // BETTERMATE_NEXT_WAKEUP_H
