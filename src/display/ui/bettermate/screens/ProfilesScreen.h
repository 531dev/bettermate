#ifndef BETTERMATE_PROFILES_SCREEN_H
#define BETTERMATE_PROFILES_SCREEN_H

#include <display/ui/bettermate/Screen.h>

namespace bm {

// One profile per screen: its name as the reading, the facts its recipe defines, its stages, and where it sits
// among the favourites. Chevrons and sideways swipes page; SELECT hands the profile on screen to the machine and
// the pencil opens it in Adjust.
//
// A page change is a cut, not a slide. The focused index lives in the host, and what differs between two pages
// repaints once, in one frame.
class ProfilesScreen : public Screen {
  public:
    using Screen::Screen;
    void update(const UiState &state) override;
    void swiped(lv_dir_t direction) override;

  protected:
    void build(lv_obj_t *root) override;

  private:
    static constexpr unsigned FACTS = 3;
    static constexpr unsigned DOTS = 7;

    void setFacts(const UiState::ProfilePreview::Entry &entry);
    void setDots(unsigned index, unsigned count);

    lv_obj_t *label = nullptr;
    lv_obj_t *name = nullptr;
    lv_obj_t *cards[FACTS]{};
    lv_obj_t *facts[FACTS]{};
    lv_obj_t *stages = nullptr;
    lv_obj_t *dots[DOTS]{};
    lv_obj_t *previous = nullptr;
    lv_obj_t *next = nullptr;
    lv_obj_t *select = nullptr;
    lv_obj_t *edit = nullptr;
    // How many cards and dots their rows are centred for: they move only when that number changes.
    unsigned cardsPlaced = FACTS;
    unsigned dotsPlaced = DOTS;
};

} // namespace bm

#endif // BETTERMATE_PROFILES_SCREEN_H
