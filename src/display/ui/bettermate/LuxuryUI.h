#pragma once

#include <display/ui/bettermate/Ui.h>
#include <display/ui/bettermate/UiState.h>
#include <display/core/WarningManager.h>
#include <display/ui/bettermate/gen/bm_luxury_assets.h>

// Shared palette, typography, controls and motion for the minimal-luxury screens.
//
// Every screen follows the same five rules:
//   1. One large reading and one primary action.
//   2. Anything in its normal state stays hidden; only exceptions appear.
//   3. The rim carries data: live arcs and target notches replace gauges and progress text.
//   4. Controls that cannot be used fade out instead of greying.
//   5. Large readings carry a small unit label underneath; small text uses "93°", "9 bar", "36 g".
namespace bm::luxury {
struct Palette {
    lv_color_t background, ink, muted, faint, line, accent, warning, danger;
};
Palette palette();
void background(lv_obj_t *obj, lv_color_t color);
void color(lv_obj_t *obj, lv_color_t color);
void border(lv_obj_t *obj, lv_color_t color);
// Hides a control that cannot be used (rule 4) and keeps its disabled state in step.
void enabled(lv_obj_t *obj, bool enabled);
// The one ambient animation: a slow breath while something is still getting ready.
void pulse(lv_obj_t *obj, bool active);
lv_obj_t *label(lv_obj_t *parent, int x, int y, const lv_font_t *font, const char *text = "", int width = 0,
                int tracking = 0);
lv_obj_t *rule(lv_obj_t *parent, int x, int y, int width, int height = 1);
lv_obj_t *control(lv_obj_t *parent, int x, int y, int width, int height, bool outline = false);
lv_obj_t *pill(lv_obj_t *parent, int x, int y, int width, int height, const char *text);
// A quiet text button: no outline, a 56 px touch target.
lv_obj_t *textButton(lv_obj_t *parent, int x, int y, int width, const char *text);
lv_obj_t *power(lv_obj_t *parent, int x, int y);
lv_obj_t *modesButton(lv_obj_t *parent);
void updateModesButton(lv_obj_t *button, bool stopsProcess = false, bool showStopCaption = true);
const char *warningName(WarningType type);

// Motion: one easing family (out when entering, in when leaving) and three durations.
constexpr uint32_t MOTION_MICRO = 120;
constexpr uint32_t MOTION_STATE = 240;
constexpr uint32_t MOTION_PAGE = 400;

// While one of these is alive, fades and glides jump straight to their end state. Screens use it for the
// first update after they are shown, so nothing animates in from a stale value.
struct Instant {
    Instant();
    ~Instant();
    Instant(const Instant &) = delete;
    Instant &operator=(const Instant &) = delete;
};
bool instant();

// Shows or hides with a short opacity fade. Calling it again with the same state does nothing.
void fade(lv_obj_t *obj, bool visible, uint32_t ms = MOTION_MICRO);
// New screen content fades in and rises into place, part by part. Steady parts stay where they are.
void enter(lv_obj_t *body, bool rise = true);
// Marks a part that sits in the same place on every screen (the rim, its notch, the 12 o'clock indicators).
void steady(lv_obj_t *obj);
// Sets a part's own opacity. While the part is fading, the fade ends at this value instead.
void opacity(lv_obj_t *obj, lv_opa_t value);

// A number that glides to each new value instead of jumping.
class Readout {
  public:
    void attach(lv_obj_t *label, int decimals, const char *suffix = "");
    void set(float value, uint32_t ms = MOTION_PAGE);
    // Forget the shown value so the next set() renders at once (for example after the label changes meaning).
    void reset();
    lv_obj_t *label() const { return text; }

  private:
    static void step(void *self, int32_t value);
    void render(float value);
    lv_obj_t *text = nullptr;
    int decimals = 0;
    int scale = 1;
    const char *suffix = "";
    float current = 0;
    float target = 0;
    bool valid = false;
};

// One data arc on the rim: a hairline track, a live value and an optional target notch.
// Left and Right hold temperature and pressure between the top and bottom gaps; Dial sweeps 270°.
class Rim {
  public:
    enum class Shape { Left, Right, Dial };
    void build(lv_obj_t *parent, Shape shape, int radius = 228);
    void reshape(Shape shape);
    // Fractions run 0..1 along the arc; a negative target hides the notch.
    void set(float fraction, float target = -1, bool animate = true);
    void colors(lv_color_t track, lv_color_t value, lv_color_t notch);
    // A brief brightening when something reaches its target.
    void swell();
    void show(bool visible);
    lv_obj_t *arcObj() const { return arc; }

  private:
    static void valueStep(void *self, int32_t value);
    static void notchStep(void *self, int32_t value);
    static void swellStep(void *self, int32_t value);
    float angleAt(float fraction) const;
    void placeNotch(float fraction);
    lv_obj_t *arc = nullptr;
    lv_obj_t *notch = nullptr;
    lv_point_t notchPoints[2]{};
    Shape shape = Shape::Left;
    int radius = 228;
    int value = -1;
    int notchValue = -1;
    bool notchShown = false;
    lv_color_t valueColor{}, notchColor{}, swellColor{};
};

// Shot progress: one short arc per phase along the dial, separated by small gaps.
class PhaseTrack {
  public:
    static constexpr int MAX = 8;
    void build(lv_obj_t *parent, int radius = 212);
    void plan(const float *durations, int count);
    void set(int index, float progress, bool complete);
    void colors(lv_color_t track, lv_color_t value);
    void show(bool visible);

  private:
    lv_obj_t *segments[MAX]{};
    int count = 0;
    float plannedSignature = -1;
};

// Thin-line glyphs drawn to match the type: no pixel icons on the luxury screens.
enum class Glyph : uint8_t { Dot, WifiOff, Update, ChevronRight };
lv_obj_t *glyph(lv_obj_t *parent, Glyph kind, int size = 44);
void glyphColor(lv_obj_t *glyph, lv_color_t color);

// The exception slot at 12 o'clock: a warning dot, Wi-Fi loss and an available update. Nothing shows while
// everything is normal. The warning dot and the other glyphs each carry their own tap target.
class Indicators {
  public:
    void build(lv_obj_t *parent, int y = 34);
    // Returns true while any indicator is visible. Temperature never raises the dot: the status line and the
    // rim already show heating. Standby also leaves out the flush reminder, which only matters before a shot.
    // While a process runs the dot stays away, so a stray tap at the top can never stop it.
    bool update(const UiState &state, bool network = true, bool standby = false, bool running = false);
    lv_obj_t *warning = nullptr;
    lv_obj_t *wifi = nullptr;
    lv_obj_t *update_ = nullptr;

  private:
    lv_obj_t *row = nullptr;
};
bool anyWarning(const UiState &state, bool standby = false);
bool anyError(const UiState &state, bool standby = false);

// A short arc that circles the rim while the system works on something.
lv_obj_t *orbit(lv_obj_t *parent);
void orbiting(lv_obj_t *orbit, bool active);

// Temperatures and pressures on the rim use the stock fixed scales.
constexpr float RIM_MAX_TEMPERATURE = 160.0f;
constexpr float RIM_MAX_PRESSURE = 16.0f;
float rimFraction(float value, float max);
} // namespace bm::luxury
