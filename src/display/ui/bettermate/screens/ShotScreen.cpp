#include "ShotScreen.h"

namespace bm {

void ShotScreen::build(lv_obj_t *root) { label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "SHOT"), 0); }

void ShotScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
