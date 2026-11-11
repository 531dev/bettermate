#include "AdjustScreen.h"

namespace bm {

void AdjustScreen::build(lv_obj_t *root) { label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "ADJUST"), 0); }

void AdjustScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
