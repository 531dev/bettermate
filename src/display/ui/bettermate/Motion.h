#ifndef BETTERMATE_MOTION_H
#define BETTERMATE_MOTION_H

#include <cstdint>
#include <display/ui/bettermate/gen/bm_tokens.h>

// Display motion is counted in frames of the panel, not milliseconds (design/reference/motion.md). The LilyGo
// T-RGB scans 23.5 times a second, so the UI advances one frame every 42.5 ms and nothing animates faster.
//
// The rules every screen keeps:
//   1. Count frames. Ease out with the tables below, not a curve.
//   2. Move marks, not layers: no style opacity, transform or translation on anything larger than an icon.
//   3. Fade by recolour: mix an element's color toward the face (Theme: tone(t, level)).
//   4. A screen change is a cut that settles over three frames; the ring stays.
//   5. One ambient motion at a time: the heating pulse or the busy comet.
namespace bm::motion {

// Two frames are 85 ms: the host alternates 42 and 43.
constexpr uint32_t FRAME_MS_EVEN = 42;
constexpr uint32_t FRAME_MS_ODD = 43;

constexpr uint8_t TICK = tokens::FRAME_TICK;
constexpr uint8_t MICRO = tokens::FRAME_MICRO;
constexpr uint8_t STATE = tokens::FRAME_STATE;
constexpr uint8_t PAGE = tokens::FRAME_PAGE;
constexpr uint8_t SWEEP = tokens::FRAME_SWEEP;

// Percent of the way after each frame.
inline constexpr uint8_t EASE3[MICRO] = {55, 88, 100};
inline constexpr uint8_t EASE5[STATE] = {36, 64, 84, 96, 100};
inline constexpr uint8_t EASE8[PAGE] = {33, 58, 76, 88, 95, 98, 100, 100};

// Live values have a cadence of their own: the host snapshots the machine this often (about 4 times a second),
// and a screen redraws a number only when the shown text changes.
constexpr uint8_t SNAPSHOT_EVERY = 6;

// A press holds ink for two frames. A command not confirmed by then shows as pending, for at most 2 s (47
// frames) before the control comes back (product-states.md, Time limits).
constexpr uint32_t PRESS_FRAMES = 2;
constexpr uint32_t ANSWER_FRAMES = 47;

} // namespace bm::motion

#endif // BETTERMATE_MOTION_H
