#ifndef BETTERMATE_SHOT_SCREEN_H
#define BETTERMATE_SHOT_SCREEN_H

#include <display/ui/bettermate/Screen.h>
#include <display/ui/bettermate/parts/StageBars.h>

namespace bm {

// A shot in progress and its result, on Brew's ring: elapsed time as the reading, a bar per phase under it,
// two values in the second rank and one pill. While the pump runs the label names the phase, the values are
// pressure and weight (or the boiler, without a scale) and the pill is STOP in ink. When the pump stops the
// layout stays: the timer holds the final time, the values become yield and ratio, the pill becomes DONE in
// cobalt, and the screen waits to be acknowledged. A flush is shown the same way and leaves by itself.
class ShotScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tick(const UiState &state, uint32_t frame) override;
    // Like Brew. The host ignores it while the pump runs: a shot ends with its own STOP.
    void swiped(lv_dir_t direction) override {
        if (direction == LV_DIR_TOP)
            host.act(Intent::Menu);
    }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    // What the label is about. A new message steps in; a new number in the same message snaps.
    enum class Says : uint8_t { Nothing, Phase, Temperature, Calibrating, Complete };
    // What a second-rank value shows.
    enum class Fact : uint8_t { None, Pressure, Weight, WeightOfTarget, Temperature, Yield, Ratio };
    struct Value {
        ui::Reading reading;
        lv_obj_t *caption = nullptr;
        Fact fact = Fact::None;
        int cx = 0;
    };

    void advance(const UiState &state);
    void numbers(const UiState &state);
    void say(const UiState &state, bool finished);
    void arrange(const UiState &state, bool finished);
    void write(Value &value, const UiState &state);

    lv_obj_t *label = nullptr;
    ui::Reading timer;
    ui::StageBars bars;
    Value values[2];
    lv_obj_t *action = nullptr;

    Says says = Says::Nothing;
    bool fresh = true;     // nothing of this shot is on the glass yet
    bool straying = false; // the boiler is off the shot's target
    long temperature = 0;  // the boiler as the label and the value show it
    // Live numbers have a cadence of their own, counted in this screen's frames.
    uint32_t frames = 0;
    uint32_t numbersAt = 0;
    uint32_t temperatureAt = 0;
    bool flipped = false;        // the timer showed a new second in this frame
    unsigned long untilFlip = 0; // milliseconds until it shows the next one
};

} // namespace bm

#endif // BETTERMATE_SHOT_SCREEN_H
