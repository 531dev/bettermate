#include <display/ui/bettermate/NextWakeup.h>
#include <string>
#include <unity.h>
#include <vector>

struct Schedule {
    std::string time;
    bool days[7]; // Monday first, matching AutoWakeupSchedule
};

static tm clockAt(int weekday, int hour, int minute) {
    tm time{};
    time.tm_wday = weekday;
    time.tm_hour = hour;
    time.tm_min = minute;
    return time;
}

void setUp() {}
void tearDown() {}

void test_earliest_schedule_wins_regardless_of_order() {
    const std::vector<Schedule> schedules = {{"09:00", {true}}, {"07:30", {true}}, {"08:00", {true}}};
    const auto next = bm::nextWakeup(clockAt(1, 7, 0), schedules);
    TEST_ASSERT_TRUE(next.scheduled);
    TEST_ASSERT_EQUAL(7, next.hour);
    TEST_ASSERT_EQUAL(30, next.minute);
    TEST_ASSERT_EQUAL(30, next.inMinutes);
}

void test_sunday_wraps_to_monday() {
    const std::vector<Schedule> schedules = {{"07:00", {true}}};
    const auto next = bm::nextWakeup(clockAt(0, 23, 30), schedules);
    TEST_ASSERT_TRUE(next.scheduled);
    TEST_ASSERT_EQUAL(1, next.weekday);
    TEST_ASSERT_EQUAL(450, next.inMinutes);
}

void test_sunday_uses_the_last_schedule_day() {
    const std::vector<Schedule> schedules = {{"07:00", {false, false, false, false, false, false, true}}};
    const auto next = bm::nextWakeup(clockAt(6, 23, 30), schedules);
    TEST_ASSERT_TRUE(next.scheduled);
    TEST_ASSERT_EQUAL(0, next.weekday);
    TEST_ASSERT_EQUAL(450, next.inMinutes);
}

void test_passed_weekly_schedule_wraps_a_full_week() {
    const std::vector<Schedule> schedules = {{"07:00", {true}}};
    const auto next = bm::nextWakeup(clockAt(1, 7, 1), schedules);
    TEST_ASSERT_TRUE(next.scheduled);
    TEST_ASSERT_EQUAL(1, next.weekday);
    TEST_ASSERT_EQUAL(7 * 24 * 60 - 1, next.inMinutes);
}

void test_current_minute_is_still_due() {
    const std::vector<Schedule> schedules = {{"07:00", {true}}};
    const auto next = bm::nextWakeup(clockAt(1, 7, 0), schedules);
    TEST_ASSERT_TRUE(next.scheduled);
    TEST_ASSERT_EQUAL(0, next.inMinutes);
}

void test_disabled_days_and_empty_schedules_have_no_wakeup() {
    const std::vector<Schedule> disabled = {{"07:00", {false}}};
    TEST_ASSERT_FALSE(bm::nextWakeup(clockAt(1, 6, 0), disabled).scheduled);
    TEST_ASSERT_FALSE(bm::nextWakeup(clockAt(1, 6, 0), std::vector<Schedule>{}).scheduled);
}

void test_malformed_schedule_times_are_ignored() {
    const std::vector<Schedule> schedules = {{"24:00", {true}}, {"07:60", {true}},  {"7:00", {true}},
                                             {"ab:cd", {true}}, {"07:00x", {true}}, {"07-00", {true}}};
    TEST_ASSERT_FALSE(bm::nextWakeup(clockAt(1, 6, 0), schedules).scheduled);
}

void test_midnight_and_end_of_day_are_valid() {
    const std::vector<Schedule> midnight = {{"00:00", {true}}};
    const auto next = bm::nextWakeup(clockAt(0, 23, 59), midnight);
    TEST_ASSERT_TRUE(next.scheduled);
    TEST_ASSERT_EQUAL(1, next.inMinutes);
    const std::vector<Schedule> late = {{"23:59", {true}}};
    TEST_ASSERT_EQUAL(1, bm::nextWakeup(clockAt(1, 23, 58), late).inMinutes);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_earliest_schedule_wins_regardless_of_order);
    RUN_TEST(test_sunday_wraps_to_monday);
    RUN_TEST(test_sunday_uses_the_last_schedule_day);
    RUN_TEST(test_passed_weekly_schedule_wraps_a_full_week);
    RUN_TEST(test_current_minute_is_still_due);
    RUN_TEST(test_disabled_days_and_empty_schedules_have_no_wakeup);
    RUN_TEST(test_malformed_schedule_times_are_ignored);
    RUN_TEST(test_midnight_and_end_of_day_are_valid);
    return UNITY_END();
}
