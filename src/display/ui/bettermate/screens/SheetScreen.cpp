#include "SheetScreen.h"

namespace bm {

void SheetScreen::build(lv_obj_t *root) {
    part(ui::text(root, 240, 122, Type::Title, Tone::Ink, "Save changes"), 0);
    // SAVE writes the profile, SAVE AS NEW keeps the original and adds a copy, USE ONCE leaves the edits
    // unsaved for this session.
    save = part(ui::pill(root, 240, 158, 244, "SAVE", Tone::Primary), 2);
    bind(save, Intent::Save);
    saveAsNew = part(ui::pill(root, 240, 234, 244, "SAVE AS NEW", Tone::Surface2), 1);
    bind(saveAsNew, Intent::SaveAsNew);
    useOnce = part(ui::textButton(root, 240, 350, 176, "USE ONCE", Tone::Muted), 2);
    bind(useOnce, Intent::UseOnce);
}

void SheetScreen::update(const UiState &state) {
    TickRing &ring = host.ring();
    ring.busy(false);
    ring.pulse(false);
    ring.show(TickRing::Layout::None);

    // Both saves need a change to keep; the host opens the sheet only when there is one.
    show(save, state.profileDirty);
    show(saveAsNew, state.profileDirty);
}

} // namespace bm
