#include "InfoScreen.h"

namespace bm {

void InfoScreen::build(lv_obj_t *root) { label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "INFO"), 0); }

void InfoScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
