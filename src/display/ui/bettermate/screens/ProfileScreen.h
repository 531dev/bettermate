#ifndef BETTERMATE_PROFILE_SCREEN_H
#define BETTERMATE_PROFILE_SCREEN_H

#include <display/ui/bettermate/LuxuryUI.h>
#include <display/ui/bettermate/Screen.h>

namespace bm {
class ProfileScreen : public Screen {
  public:
    using Screen::Screen;
    void onShow(const UiState &state) override;
    void update(const UiState &state) override;
    lv_obj_t *body() override { return browse; }

  protected:
    void build(lv_obj_t *root) override;

  private:
    // Adjust shows one value large with −/+; the others wait in a quiet row below it.
    enum class Field : uint8_t { Temperature, Pressure, Output };
    void buildAdjust(lv_obj_t *root);
    void updateAdjust(const UiState &state);
    void focus(Field field);
    void step(bool up);
    void tapField(int slot);
    bool available(Field field, const UiState &state) const;

    lv_obj_t *position = nullptr;
    lv_obj_t *picker = nullptr, *menu = nullptr, *dots[7]{};
    struct Row {
        lv_obj_t *name, *summary, *recipe;
    };
    std::vector<std::string> names;
    std::vector<Row> rows;
    int focused = 0;
    bool syncingPicker = false;
    bool canChoose = false, selectionPending = false;
    void syncPicker(const UiState::ProfilePreview &preview, bool reset = false);
    void renderPicker();
    void selectProfile(int index);
    void choose(Intent intent);
    lv_obj_t *browse = nullptr, *adjust = nullptr, *edit = nullptr;

    lv_obj_t *adjustTitle = nullptr, *adjustName = nullptr;
    lv_obj_t *focusCaption = nullptr, *focusValue = nullptr, *focusUnit = nullptr, *useTime = nullptr;
    lv_obj_t *minus = nullptr, *plus = nullptr;
    lv_obj_t *slots[2]{}, *slotValues[2]{}, *slotCaptions[2]{};
    Field slotFields[2]{};
    lv_obj_t *save = nullptr, *back = nullptr;
    lv_obj_t *sheet = nullptr, *sheetSave = nullptr, *sheetCopy = nullptr, *sheetOnce = nullptr, *sheetBack = nullptr;
    Field focusField = Field::Temperature;
    Field shownField = Field::Temperature;
    luxury::Readout focusReadout;
    bool wasAdjusting = false;
    bool pressureSet = false;
    bool sheetOpen = false;
};
} // namespace bm
#endif
