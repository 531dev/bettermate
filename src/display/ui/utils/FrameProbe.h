#pragma once

#include <cstdint>

// Serial log of UI frame timing and internal heap, built in with -DBM_FRAME_STATS (env:display-frame-stats).
// Without the flag every call is an empty inline function.
namespace frame_probe {
#ifdef BM_FRAME_STATS
// Hooks LVGL's refresh monitor on the default display. Call once LVGL has a display.
void attach();
// Records one UI loop iteration and logs a summary once a second while frames are being drawn.
void loopDone(uint32_t started, uint32_t lvglStarted, uint32_t now);
#else
inline void attach() {}
inline void loopDone(uint32_t, uint32_t, uint32_t) {}
#endif
} // namespace frame_probe
