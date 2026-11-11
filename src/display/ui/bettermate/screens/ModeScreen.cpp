#include "ModeScreen.h"

namespace bm {

void ModeScreen::build(lv_obj_t *root) {
    label = part(ui::text(root, 240, 86, Type::Label, Tone::Muted, kind == Kind::Steam ? "STEAM" : kind == Kind::Water ? "WATER" : "GRIND"), 0);
    addHandle();
}

void ModeScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
