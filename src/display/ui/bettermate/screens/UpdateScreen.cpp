#include "UpdateScreen.h"

#include <algorithm>
#include <cstdio>

namespace bm {

void UpdateScreen::build(lv_obj_t *root) {
    label = part(ui::text(root, 240, 98, Type::Label, Tone::Muted, "UPDATING", 216), 0);
    percent.build(root, 240, 252, Type::Hero, Tone::Ink);
    part(percent.obj(), 0);
    unit = part(ui::text(root, 240, 284, Type::Label, Tone::Muted, "%"), 0);
    line = part(ui::text(root, 240, 336, Type::Body, Tone::Ink, "Keep the machine on", tokens::DISPLAY_SQUARE), 1);
    version = part(ui::text(root, 240, 370, Type::Label, Tone::Muted, "", 216), 1);
}

void UpdateScreen::update(const UiState &s) {
    // Before the first report the ring is empty and the reading 0: the screen says what is happening at once.
    const int progress = std::clamp(s.updateProgress, 0, 100);
    TickRing &ring = host.ring();
    ring.pulse(false);
    ring.busy(false);
    // One tick at a time: 76 ticks over 100% is a tick per 1.3%.
    ring.show(TickRing::Layout::Single, {progress / 100.0f, -1.0f, Tone::Ink, 1});

    char buf[16];
    snprintf(buf, sizeof(buf), "%d", progress);
    percent.set(buf);
    ui::setText(version, s.updateVersion.c_str());
    show(version, !s.updateVersion.empty());
}

} // namespace bm
