#!/usr/bin/env python3
"""Checks the display core on Standby and Brew: what is on the glass, and what each frame repaints.

    pio run -e display-sim && python3 scripts/verify_display_core.py
"""

import math

from display_sim import PANEL, Checks, Sim, pixels

checks = Checks("display core")

# Boot into Standby, change to Brew, let it heat, go back: the budgets of design/reference/motion.md.
sim = Sim("core-change")
sim.run(
    "wait 3500; expect screen standby; shot standby.bmp; layout standby.json; redraw boot.json;"
    "mode brew; wait 2500; expect screen brew; redraw to-brew.json; shot brew.bmp; layout brew.json;"
    "wait 6000; redraw heating.json;"
    "mode standby; wait 2500; expect screen standby; redraw to-standby.json; quit",
    env={"SIM_TRACE_FLUSH": "1"},
)
checks.count(sim)
# Building a screen repaints nothing. (A label used to mark 11 x 11 px at the stage's origin while it was built.)
# The panel's corner is outside the round glass, so after the first paint nothing has a reason to repaint it.
painted = sim.flushes()
corner = [area for area in painted if area[:2] == (0, 0) and area[2:] != (PANEL, PANEL)]
checks.true(len(painted) > 100, f"the run's repaints are listed: {len(painted)} rectangles")
checks.equal(corner, [], "Standby's and Brew's first builds repaint nothing at the panel's corner")
standby = sim.layout("standby.json")
checks.equal(standby.ring["layout"], "single", "Standby draws the single ring")
checks.equal(standby.ring["tone"][0], "faint", "Standby's ring is ink-faint")
checks.equal(standby.ring["notch"][0], -1, "Standby's ring has no notch")
checks.true(not standby.has("WAKE"), "Standby has no WAKE pill: a tap anywhere wakes")
checks.true(any("Boiler off" in t for t in standby.texts()), "Standby says what the boiler is doing")
brew = sim.layout("brew.json")
checks.equal(brew.ring["layout"], "split", "Brew draws the split ring")
checks.equal(brew.ring["tone"][0], "heat", "Brew's left arc is temperature")
checks.true(brew.ring["notch"][0] >= 0, "Brew's temperature arc carries the target notch")
checks.true(brew.has("START"), "START is visible on Brew")
checks.true(any(t.startswith("HEATING TO ") for t in brew.texts()), "an off-target boiler changes the label")
for name, what in (("to-brew.json", "Standby to Brew"), ("to-standby.json", "Brew to Standby")):
    frames = sim.redraw(name)
    checks.at_most(max(frames), 25.0, f"{what}: no frame repaints over a quarter of the panel")
checks.at_most(max(sim.redraw("heating.json")), 8.0, "heating on Brew: continuous motion stays under 8% a frame")
# On any panel the ring is whole and centred on the glass: its ticks stop short of the round edge, and reach as far
# to the left as to the right and to the top. (A 466 px panel is 7 px smaller on every side than the design.)
size, at = pixels(sim.dir / "standby.bmp")
rim = [
    (x, y, math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2))
    for y in range(size)
    for x in range(size)
    if max(at(x, y)) > 44  # a tick, lit or in track, on Display black
]
rim = [(x, y, r) for x, y, r in rim if size / 2 - 40 < r <= size / 2]
checks.true(len(rim) > 2000, f"the ring's ticks are found on the rim of the capture: {len(rim)} px")
if rim:
    farthest = max(r for _, _, r in rim)
    left, right, top = min(x for x, _, _ in rim), size - 1 - max(x for x, _, _ in rim), min(y for _, y, _ in rim)
    checks.true(farthest <= size / 2 - 2, f"the ticks end inside the glass: {farthest:.1f} of {size / 2:.0f} px")
    checks.true(abs(left - right) <= 1 and abs(left - top) <= 2, f"the ring is centred on the glass: {left} px to the left, {right} to the right, {top} to the top")
sim.save("standby.bmp", "docs/display/v2/core/standby.png")
sim.save("brew.bmp", "docs/display/v2/core/brew-heating.png")

# Busy and blocked states take the line under the clock; the comet costs under 1% a frame. It is measured over two
# seconds of Standby: when the clock's minute turns inside them, one frame also repaints a digit of the clock (2 to
# 3% of the panel, and not the comet's), so the case is run again.
for attempt in range(3):
    sim = Sim("core-states")
    sim.run(
        "wait 3500; controller disconnected; wait 2500; expect text CONNECTING; redraw settle.json;"
        "layout before.json; wait 2000; redraw comet.json; layout after.json; shot connecting.bmp; error 4; wait 1500;"
        "expect text TEMPERATURE ERROR; shot error.bmp; quit"
    )
    clocks = [[o["text"] for o in sim.layout(name).objects if o["kind"] == "reading"] for name in ("before.json", "after.json")]
    if clocks[0] == clocks[1]:
        break
checks.count(sim)
checks.equal(clocks[0], clocks[1], "the clock stood still while the comet was measured")
checks.at_most(max(sim.redraw("comet.json")), 1.0, "the busy comet repaints under 1% a frame")
sim.save("connecting.bmp", "docs/display/v2/core/standby-connecting.png")
sim.save("error.bmp", "docs/display/v2/core/standby-error.png")

# A tap anywhere on Standby opens the menu, Light is a setting, pressed parts invert.
sim = Sim("core-input")
sim.run(
    "wait 3500; tap 240 362; wait 700; expect screen menu;"
    "mode brew; wait 2500; theme 1; wait 600; layout light.json; shot light.bmp;"
    "theme 0; wait 600; press 240 344; wait 130; layout pressed.json; release; quit"
)
checks.count(sim)
pressed = sim.layout("pressed.json").find("START")
checks.color(pressed and pressed.get("fill"), "#f2f2f2", "a pressed pill inverts to ink")
light = sim.layout("light.json")
checks.color(light.objects[0]["fill"], "#e9e9e9", "the Light theme paints the face in surface-0")
sim.save("light.bmp", "docs/display/v2/core/brew-light.png")

# An AMOLED panel rests after 30 s on Standby: only the clock stays, in ink-faint, and warnings with it.
sim = Sim("core-rest")
sim.run("wait 3500; panel amoled; redraw boot.json; wait 31500; redraw to-rest.json; layout rest.json; shot rest.bmp; tap 240 240; wait 700; expect screen menu; quit")
checks.count(sim)
rest = sim.layout("rest.json")
checks.equal(rest.ring["layout"], "none", "the ring is dark at rest")
checks.true(not rest.has("WAKE") and not any("Boiler" in t for t in rest.texts()), "only the clock stays lit at rest")
checks.equal(len([o for o in rest.objects if o["kind"] == "reading"]), 1, "the clock is still there at rest")
checks.at_most(max(sim.redraw("to-rest.json")), 25.0, "going to rest repaints at most a quarter of the panel in a frame")
sim.save("rest.bmp", "docs/display/v2/core/standby-rest.png")

checks.finish()
