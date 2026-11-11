#ifndef BETTERMATE_MODE_SCREEN_H
#define BETTERMATE_MODE_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// Steam, Water and Grind share one layout: the target between minus and plus on the centre line, the live value
// above it, and a single ring.
//
// Steam and Water put the boiler on the ring in heat with the target notch, and its temperature above the
// target. Steam has no action, because steaming starts with the valve: a line says what the machine is doing,
// and the handle stays, because leaving the mode is how steaming ends. Water has START, then STOP.
//
// Grind puts its progress on the ring in ink. With a scale a TIME · WEIGHT row sits above the target, and a
// line under it carries the scale's weight and tares it.
//
// While Water or Grind runs, minus, plus, the row and the handle are away, not greyed, and the reading shows
// the run: what has been pumped or ground, or the time left.
class ModeScreen : public Screen {
  public:
    enum class Kind : uint8_t { Steam, Water, Grind };
    ModeScreen(Host &host, Kind kind) : Screen(host), kind(kind) {}
    void update(const UiState &state) override;
    void tick(const UiState &state, uint32_t frame) override;
    void swiped(lv_dir_t direction) override;

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    bool isRunning(const UiState &state) const;
    void showRing(const UiState &state);
    // Brings the parts of one rank in line with the snapshot.
    void applyBoiler(const UiState &state, unsigned rank);
    void applyGrind(const UiState &state, unsigned rank);
    void showGrindClock(const UiState &state, unsigned long elapsed);

    Kind kind;
    ui::Reading live;   // boiler temperature, or the time a grind has run
    ui::Reading target; // the target, or what the run has reached
    lv_obj_t *unit = nullptr;
    ui::SegRow row;
    lv_obj_t *scale = nullptr;
    lv_obj_t *minus = nullptr;
    lv_obj_t *plus = nullptr;
    lv_obj_t *action = nullptr;
    lv_obj_t *status = nullptr;
    lv_obj_t *handle = nullptr;

    bool running = false;  // water is pumping or the grinder turns: only STOP is offered
    bool byWeight = false; // what the row has chosen
    uint8_t settled = 3;   // ranks brought in line since the last start or stop
    unsigned long snapshotAt = 0;
    uint32_t snapshotFrame = 0;
};

} // namespace bm

#endif // BETTERMATE_MODE_SCREEN_H
