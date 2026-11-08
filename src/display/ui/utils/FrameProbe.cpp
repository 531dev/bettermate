#include "FrameProbe.h"

#ifdef BM_FRAME_STATS
#include "FrameTiming.h"

// Arduino.h maps ESP_LOGI onto log_i, which honours CORE_DEBUG_LEVEL; the SDK's own ESP_LOGI is compiled out.
#include <Arduino.h>
#include <cinttypes>
#include <esp_heap_caps.h>
#include <lvgl.h>

namespace frame_probe {
namespace {
frame_timing::Window window;
uint32_t screenPx = 1;

// LVGL calls this after each refresh that redrew something; `time` includes the synchronous flush.
void onRefresh(lv_disp_drv_t *, uint32_t time, uint32_t px) { window.frame(time, px); }
} // namespace

void attach() {
    lv_disp_t *disp = lv_disp_get_default();
    if (disp == nullptr)
        return;
    screenPx = static_cast<uint32_t>(lv_disp_get_hor_res(disp)) * lv_disp_get_ver_res(disp);
    disp->driver->monitor_cb = onRefresh;
}

void loopDone(uint32_t started, uint32_t lvglStarted, uint32_t now) {
    window.loop(started, now - started, now - lvglStarted);
    frame_timing::Summary s{};
    if (!window.take(now, s))
        return;
    // Internal heap decides whether LVGL's draw buffers can move out of PSRAM.
    constexpr uint32_t internal = MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT;
    ESP_LOGI("FrameStats",
             "frames %" PRIu32 " | render avg %" PRIu32 " max %" PRIu32 " ms | px avg %" PRIu32 "%% max %" PRIu32
             "%% | loop avg %" PRIu32 " max %" PRIu32 " ms, lvgl avg %" PRIu32 " max %" PRIu32 " ms | period max %" PRIu32
             " ms | internal heap free %uk min %uk block %uk",
             s.frames, s.renderAvg, s.renderMax, s.pxAvg * 100 / screenPx, s.pxMax * 100 / screenPx, s.workAvg, s.workMax,
             s.lvglAvg, s.lvglMax, s.periodMax, static_cast<unsigned>(heap_caps_get_free_size(internal) / 1024),
             static_cast<unsigned>(heap_caps_get_minimum_free_size(internal) / 1024),
             static_cast<unsigned>(heap_caps_get_largest_free_block(internal) / 1024));
}
} // namespace frame_probe
#endif
