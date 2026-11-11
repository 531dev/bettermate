#ifndef BETTERMATE_TICK_RING_H
#define BETTERMATE_TICK_RING_H

#include <display/ui/bettermate/Theme.h>

namespace bm {

// The ring of ticks on the rim: lit ticks are the value, a longer ink tick is the target. One object draws
// every tick; a change repaints only the box around each tick whose color changed (0.3% of the screen), and
// ticks change a few a frame, so the ring never costs more than about 1% of the screen in any frame.
//
// The ring belongs to the UI, not to a screen: it stays put through a screen change and walks to what the
// next screen asks for.
class TickRing {
  public:
    // Split: temperature on the left from 110° up to 250°, pressure on the right from 70° up to -70°, 36 ticks
    // each. Single: one quantity over 300° from 120°, 76 ticks. Angles are clockwise from 3 o'clock.
    enum class Layout : uint8_t { None, Split, Single };

    struct Arc {
        constexpr Arc(float value = 0.0f, float target = -1.0f, Tone tone = Tone::Ink, uint8_t pace = 0)
            : value(value), target(target), tone(tone), pace(pace) {}
        float value;  // 0..1 of the arc
        float target; // 0..1, negative for no notch
        Tone tone;
        uint8_t pace; // ticks a frame; 0 means 4, or as many as fit a long walk into the sweep
    };

    static constexpr unsigned HALF = 36;
    static constexpr unsigned FULL = 76;
    // Fixed scales, never rescaled to make the ring look fuller.
    static constexpr float MAX_TEMPERATURE = 160.0f;
    static constexpr float MAX_PRESSURE = 16.0f;
    static float fraction(float value, float max);

    void build(lv_obj_t *parent);
    // What the ring should show. In Split the first arc is the left one; in Single only the first is used.
    void show(Layout layout, const Arc &first = Arc(), const Arc &second = Arc());
    // The last lit tick of the first arc alternates heat and heat-soft once a second.
    void pulse(bool on);
    // Three lit ticks circling the single ring, one step a frame.
    void busy(bool on);
    // Advance one frame.
    void step();
    // Jump to the wanted picture (first paint, theme change).
    void settle();

    // What is on the glass right now, for the simulator's checks.
    struct Shown {
        Layout layout;
        unsigned lit[2];
        int notch[2];
        Tone tone[2];
        bool walking;
    };
    Shown shown() const;

  private:
    static constexpr unsigned COUNT = HALF * 2 + FULL;
    static constexpr uint8_t NOTCH = 0x80;
    struct Tick {
        lv_point_t outer, inner, notch;
    };
    struct Span {
        uint8_t first, count;
    };
    static constexpr Span SPANS[3] = {{0, HALF}, {HALF, HALF}, {HALF * 2, FULL}};

    static void drawEvent(lv_event_t *e);
    void draw(lv_draw_ctx_t *ctx) const;
    void plan();
    void fill(const Span &span, const Arc &arc, bool pulsing, uint8_t *out) const;
    void apply(unsigned index);
    lv_area_t box(unsigned index, bool notch) const;

    lv_obj_t *obj = nullptr;
    Tick ticks[COUNT]{};
    uint8_t drawn[COUNT]{}; // 0 absent, else 1 + Tone, with NOTCH for the target
    uint8_t want[COUNT]{};
    uint8_t pace[3]{};
    bool down[3]{};
    Layout layout = Layout::None;
    Arc arcs[2];
    bool pulsing = false;
    bool soft = false;
    bool comet = false;
    uint8_t cometAt = 0;
    uint8_t phase = 0;
};

} // namespace bm
#endif
