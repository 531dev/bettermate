#ifndef BETTERMATE_TICK_RING_H
#define BETTERMATE_TICK_RING_H

#include <display/ui/bettermate/Ui.h>
#include <display/ui/bettermate/UiState.h>

namespace bm {

// One draw object per ring. Tick endpoints are cached; updates invalidate only changed tick/marker bounds.
class TickRing {
  public:
    enum class Kind { Temperature, Pressure, FullTemperature };
    ~TickRing();
    void build(lv_obj_t *parent, Kind kind, bool minimal = false);
    void update(float current, float target, bool heating, bool visible = true);

  private:
    struct Segment {
        lv_point_t a, b;
        lv_area_t bounds;
    };
    static Segment segment(float angle, float radius, bool tangent, float length, int width);
    void invalidate(const Segment &segment);
    void draw(lv_event_t *event);
    void pulse();

    lv_obj_t *obj = nullptr;
    lv_timer_t *timer = nullptr;
    Kind kind = Kind::Temperature;
    Segment ticks[52]{};
    Segment marker{};
    unsigned count = 0;
    unsigned lit = 0;
    int stroke = tokens::GAUGE_STROKE;
    float start = 0.0f, sweep = 0.0f, maximum = 0.0f;
    float targetValue = -1.0f;
    bool heating = false;
    bool soft = false;
};

class Gauges {
  public:
    void build(lv_obj_t *parent, bool minimal = false);
    void update(const UiState &state);

  private:
    TickRing temperature, pressure, full;
};

} // namespace bm
#endif
