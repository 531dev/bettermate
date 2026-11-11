#include "MenuScreen.h"

namespace bm {

void MenuScreen::build(lv_obj_t *root) { label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "MENU"), 0); }

void MenuScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
