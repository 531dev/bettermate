#include "WarningsScreen.h"

namespace bm {

void WarningsScreen::build(lv_obj_t *root) { label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "WARNINGS"), 0); }

void WarningsScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
