#pragma once

#include <algorithm>
#include <cstdint>

// Pure timing helpers for the UI loop: no LVGL, Arduino or FreeRTOS, so the native tests can use them.
namespace frame_timing {

// Ticks to wait so one loop iteration plus the wait lasts `period`. A loop that overruns still
// yields one tick, so equal- and lower-priority work on the same core keeps running.
inline uint32_t loopDelay(uint32_t started, uint32_t now, uint32_t period) {
    const uint32_t spent = now - started; // unsigned subtraction survives tick wraparound
    return spent < period ? period - spent : 1;
}

struct Summary {
    uint32_t frames;               // LVGL refreshes that redrew something
    uint32_t renderAvg, renderMax; // ms per refresh, flush included
    uint32_t pxAvg, pxMax;         // pixels redrawn per refresh
    uint32_t loops;                // UI loop iterations
    uint32_t workAvg, workMax;     // ms per iteration, before its wait
    uint32_t lvglAvg, lvglMax;     // ms of that spent in lv_task_handler()
    uint32_t periodMax;            // longest gap between two iteration starts
};

// Collects frame and loop timings over a window and hands back one summary per window that drew a frame.
class Window {
  public:
    explicit Window(uint32_t lengthMs = 1000) : length(lengthMs) {}

    void frame(uint32_t renderMs, uint32_t px) {
        ++frames;
        renderTotal += renderMs;
        renderMax = std::max(renderMax, renderMs);
        pxTotal += px;
        pxMax = std::max(pxMax, px);
    }

    void loop(uint32_t started, uint32_t workMs, uint32_t lvglMs) {
        ++loops;
        workTotal += workMs;
        workMax = std::max(workMax, workMs);
        lvglTotal += lvglMs;
        lvglMax = std::max(lvglMax, lvglMs);
        // The previous start survives a window change: iterations run back to back across it.
        if (hasLastStart)
            periodMax = std::max(periodMax, started - lastStart);
        lastStart = started;
        hasLastStart = true;
    }

    // The first call opens the window. Returns true once a window that drew a frame has closed.
    bool take(uint32_t now, Summary &out) {
        if (!open) {
            open = true;
            openedAt = now;
            return false;
        }
        if (now - openedAt < length)
            return false;
        const bool drew = frames > 0;
        if (drew) {
            out.frames = frames;
            out.renderAvg = renderTotal / frames;
            out.renderMax = renderMax;
            out.pxAvg = pxTotal / frames;
            out.pxMax = pxMax;
            out.loops = loops;
            out.workAvg = loops ? workTotal / loops : 0;
            out.workMax = workMax;
            out.lvglAvg = loops ? lvglTotal / loops : 0;
            out.lvglMax = lvglMax;
            out.periodMax = periodMax;
        }
        frames = renderTotal = renderMax = pxTotal = pxMax = 0;
        loops = workTotal = workMax = lvglTotal = lvglMax = periodMax = 0;
        openedAt = now;
        return drew;
    }

  private:
    uint32_t length;
    bool open = false;
    uint32_t openedAt = 0;
    uint32_t frames = 0, renderTotal = 0, renderMax = 0, pxTotal = 0, pxMax = 0;
    uint32_t loops = 0, workTotal = 0, workMax = 0, lvglTotal = 0, lvglMax = 0, periodMax = 0;
    bool hasLastStart = false;
    uint32_t lastStart = 0;
};

} // namespace frame_timing
