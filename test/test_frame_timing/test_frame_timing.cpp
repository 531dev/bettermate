#include <display/ui/utils/FrameTiming.h>
#include <unity.h>

void setUp() {}
void tearDown() {}

void test_loop_waits_out_the_rest_of_the_period() { TEST_ASSERT_EQUAL_UINT32(18, frame_timing::loopDelay(1000, 1007, 25)); }

void test_loop_that_fills_the_period_yields_one_tick() {
    TEST_ASSERT_EQUAL_UINT32(1, frame_timing::loopDelay(1000, 1025, 25));
}

void test_slow_loop_yields_one_tick_instead_of_a_full_period() {
    TEST_ASSERT_EQUAL_UINT32(1, frame_timing::loopDelay(1000, 1060, 25));
}

void test_loop_delay_survives_tick_wraparound() {
    TEST_ASSERT_EQUAL_UINT32(5, frame_timing::loopDelay(0xFFFFFFF0u, 0x00000004u, 25));
}

void test_window_summarises_frames_and_loops_after_one_second() {
    frame_timing::Window window;
    frame_timing::Summary summary{};
    TEST_ASSERT_FALSE(window.take(0, summary));

    window.frame(10, 1000);
    window.frame(30, 5000);
    window.loop(100, 12, 10);
    window.loop(125, 40, 35);
    window.loop(190, 20, 18);

    TEST_ASSERT_FALSE(window.take(999, summary));
    TEST_ASSERT_TRUE(window.take(1000, summary));
    TEST_ASSERT_EQUAL_UINT32(2, summary.frames);
    TEST_ASSERT_EQUAL_UINT32(20, summary.renderAvg);
    TEST_ASSERT_EQUAL_UINT32(30, summary.renderMax);
    TEST_ASSERT_EQUAL_UINT32(3000, summary.pxAvg);
    TEST_ASSERT_EQUAL_UINT32(5000, summary.pxMax);
    TEST_ASSERT_EQUAL_UINT32(3, summary.loops);
    TEST_ASSERT_EQUAL_UINT32(24, summary.workAvg);
    TEST_ASSERT_EQUAL_UINT32(40, summary.workMax);
    TEST_ASSERT_EQUAL_UINT32(21, summary.lvglAvg);
    TEST_ASSERT_EQUAL_UINT32(35, summary.lvglMax);
    TEST_ASSERT_EQUAL_UINT32(65, summary.periodMax);
}

void test_window_without_frames_is_dropped() {
    frame_timing::Window window;
    frame_timing::Summary summary{};
    window.take(0, summary);
    window.loop(100, 3, 1);
    window.loop(125, 3, 1);
    TEST_ASSERT_FALSE(window.take(1000, summary));

    window.frame(4, 200);
    TEST_ASSERT_TRUE(window.take(2000, summary));
    TEST_ASSERT_EQUAL_UINT32(1, summary.frames);
    TEST_ASSERT_EQUAL_UINT32(0, summary.loops);
}

void test_next_window_starts_from_zero_but_keeps_the_last_loop_start() {
    frame_timing::Window window;
    frame_timing::Summary summary{};
    window.take(0, summary);
    window.frame(50, 230400);
    window.loop(950, 60, 55);
    TEST_ASSERT_TRUE(window.take(1000, summary));

    window.frame(4, 200);
    window.loop(1010, 8, 5);
    TEST_ASSERT_TRUE(window.take(2000, summary));
    TEST_ASSERT_EQUAL_UINT32(1, summary.frames);
    TEST_ASSERT_EQUAL_UINT32(4, summary.renderMax);
    TEST_ASSERT_EQUAL_UINT32(200, summary.pxMax);
    TEST_ASSERT_EQUAL_UINT32(1, summary.loops);
    TEST_ASSERT_EQUAL_UINT32(8, summary.workMax);
    TEST_ASSERT_EQUAL_UINT32(60, summary.periodMax);
}

int main() {
    UNITY_BEGIN();
    RUN_TEST(test_loop_waits_out_the_rest_of_the_period);
    RUN_TEST(test_loop_that_fills_the_period_yields_one_tick);
    RUN_TEST(test_slow_loop_yields_one_tick_instead_of_a_full_period);
    RUN_TEST(test_loop_delay_survives_tick_wraparound);
    RUN_TEST(test_window_summarises_frames_and_loops_after_one_second);
    RUN_TEST(test_window_without_frames_is_dropped);
    RUN_TEST(test_next_window_starts_from_zero_but_keeps_the_last_loop_start);
    return UNITY_END();
}
