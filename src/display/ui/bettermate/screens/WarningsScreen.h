#ifndef BETTERMATE_WARNINGS_SCREEN_H
#define BETTERMATE_WARNINGS_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// What to put right before the next shot: one card for each warning, its level as a chip and a sentence,
// errors first. DONE leaves. When the controller asks whether to start despite an error, the same screen
// asks: START goes ahead and CANCEL does not.
//
// A card is a tenth of the panel. The two arrive on separate ranks of the screen change, and when a button
// leaves the screen they go first, one a frame, before the host is asked for the change.
class WarningsScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void tick(const UiState &state, uint32_t frame) override;
    void swiped(lv_dir_t direction) override {
        // Down puts the screen away. A question is only answered with one of its two buttons.
        if (direction == LV_DIR_BOTTOM && !confirming)
            depart(Intent::Back, nullptr);
    }

  protected:
    void build(lv_obj_t *root) override;
    void onEnter(const UiState &state) override;

  private:
    // Two cards fit above the pill as the design draws them.
    static constexpr unsigned ROWS = 2;
    static constexpr uint8_t EMPTY = 0xff;
    struct Row {
        lv_obj_t *card = nullptr;
        lv_obj_t *chip = nullptr;
        lv_obj_t *sentence = nullptr;
        uint8_t shown = EMPTY; // the WarningType on the card, with 0x80 for an error
    };
    static void clicked(lv_event_t *e);
    void dress(const UiState &state);
    void fill(Row &row, WarningType type, bool error);
    void depart(Intent intent, lv_obj_t *pressed);
    bool shed(unsigned group);

    lv_obj_t *label = nullptr;
    Row rows[ROWS];
    lv_obj_t *more = nullptr;
    lv_obj_t *clear = nullptr;
    lv_obj_t *pill = nullptr;
    lv_obj_t *cancel = nullptr;
    bool confirming = false;

    // Leaving by touch: what the host will be asked for, and the step reached.
    Intent departFor = Intent::Refresh;
    uint8_t departing = 0;
};

} // namespace bm

#endif // BETTERMATE_WARNINGS_SCREEN_H
