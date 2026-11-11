#include "ProfilesScreen.h"

namespace bm {

void ProfilesScreen::build(lv_obj_t *root) { label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "PROFILES"), 0); }

void ProfilesScreen::update(const UiState &state) {
    (void)state;
    host.ring().show(TickRing::Layout::None);
}

} // namespace bm
