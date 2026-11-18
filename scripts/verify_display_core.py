#!/usr/bin/env python3
"""Checks the display core on Standby and Brew: what is on the glass, and what each frame repaints.

    pio run -e display-sim && python3 scripts/verify_display_core.py
"""

import math

from display_sim import PANEL, SHOT_SHIFT, Checks, Sim, pixels

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

# Connecting keeps the date above the clock and puts the reason on the line under it; the comet costs under 1% a
# frame. It is measured over two seconds of Standby: when the clock's minute turns inside them, one frame also
# repaints a digit of the clock (2 to 3% of the panel, and not the comet's), so the case is run again.
for attempt in range(3):
    sim = Sim("core-states")
    sim.run(
        "wait 3500; controller disconnected; wait 1500; expect screen standby; expect text Waiting for the controller;"
        "redraw settle.json; layout before.json; wait 2000; redraw comet.json; layout after.json; shot connecting.bmp; quit"
    )
    clocks = [[o["text"] for o in sim.layout(name).objects if o["kind"] == "reading"] for name in ("before.json", "after.json")]
    if clocks[0] == clocks[1]:
        break
checks.count(sim)
checks.equal(clocks[0], clocks[1], "the clock stood still while the comet was measured")
checks.at_most(max(sim.redraw("comet.json")), 1.0, "the busy comet repaints under 1% a frame")
connecting = sim.layout("after.json")
checks.true(not connecting.has("CONNECTING") and not connecting.has("WAKE"), "Connecting: the date stays, no state word and no pill")
sim.save("connecting.bmp", "docs/display/v2/core/standby-connecting.png")

# ---- product states (design/reference/product-states.md, the DisplayStates card) --------------------------------

DANGER, DANGER_SOFT, PRIMARY, MUTED, INK, SURFACE_2 = "#ff6b6b", "#4a1414", "#5361ff", "#a6a6a6", "#f2f2f2", "#232323"


def box(obj):
    return (obj["x1"], obj["y1"], obj["x2"], obj["y2"])


def check_fault(page, title, lines, action, what):
    """The Fault screen: no ring, triangle-alert in danger in the slot, an ERROR chip, the title, up to two lines,
    and RESTART in primary only when pressing it can help. No handle."""
    checks.equal(page.screen, "fault", f"{what}: the Fault screen is on the glass")
    checks.equal(page.ring["layout"], "none", f"{what}: no ring")
    glyph = next((o for o in page.objects if o["kind"] == "img" and box(o) == (226, 20, 253, 47)), None)
    checks.true(glyph is not None and not glyph["clickable"], f"{what}: a 28 px glyph in the slot at 12 o'clock, not a control")
    checks.color(glyph and glyph["color"], DANGER, f"{what}: the slot's glyph is danger")
    chip = page.find("ERROR")
    checks.true(chip is not None and box(chip) == (195, 84, 284, 119), f"{what}: the ERROR chip is 90 x 36 at y 84, centred")
    checks.color(chip and chip.get("fill"), DANGER_SOFT, f"{what}: the chip sits on danger-soft")
    checks.color(chip and chip["color"], DANGER, f"{what}: the chip's word is danger")
    name = page.find(title)
    checks.true(name is not None and name["baseline"] == 178 and name["font"] == 32, f"{what}: '{title}' in screen-title at baseline 178")
    checks.true(len(title) <= 20, f"{what}: the title is at most 20 characters")
    for i, line in enumerate(lines):
        shown = page.find(line)
        checks.true(shown is not None and shown["baseline"] == 222 + 30 * i and shown["font"] == 27, f"{what}: '{line}' in screen-body at {222 + 30 * i}")
        checks.color(shown and shown["color"], MUTED, f"{what}: '{line}' is ink-muted")
        checks.true(len(line) <= 25, f"{what}: '{line}' is at most 25 characters")
    pill = page.find("RESTART")
    if action:
        checks.true(pill is not None and box(pill) == (146, 330, 333, 393) and pill["clickable"], f"{what}: RESTART is the 188 px pill at y 330")
        checks.color(pill and pill.get("fill"), PRIMARY, f"{what}: RESTART is primary")
    else:
        checks.true(pill is None, f"{what}: nothing to press when nothing can help")
    checks.true(not any(o["clickable"] and o["y1"] >= 410 for o in page.objects if o["depth"] > 0), f"{what}: no handle")


# A fault that blocks brewing takes the screen while it lasts, and gives it back when its cause is gone.
sim = Sim("core-fault")
sim.run(
    "wait 3500; mode brew; wait 2500; expect screen brew; redraw skip.json;"
    "error 4; wait 1500; expect screen fault; redraw to-fault.json; shot runaway.bmp; layout runaway.json;"
    "tap 240 240; swipe 240 400 240 200; wait 900; expect screen fault;"
    "error 1; wait 900; expect screen fault; shot link.bmp; layout link.json;"
    "error 0; wait 1500; expect screen standby; redraw from-fault.json;"
    "protocol 99; wait 1500; expect screen fault; layout mismatch.json; protocol 3; wait 1500; expect screen standby;"
    # The controller missing: first a wait on Standby, after 5 s a fault; back when it answers again.
    "mode brew; wait 2500; controller disconnected; wait 2500; expect screen standby; expect text Waiting for the controller;"
    "wait 3500; expect screen fault;"
    "shot missing.bmp; layout missing.json; controller connected; wait 3000; layout reconnected.json; quit"
)
checks.count(sim)
check_fault(sim.layout("runaway.json"), "Temperature runaway", ["Heating is off.", "Switch the machine off."], False, "boiler runaway")
check_fault(sim.layout("link.json"), "Connection error", ["Brewing is stopped.", "Restart to reconnect."], True, "link error")
check_fault(sim.layout("mismatch.json"), "Version mismatch", ["Brewing is blocked.", "Update the display."], False, "a newer controller")
check_fault(sim.layout("missing.json"), "Controller not found", ["Check power and cable.", "Still trying to connect."], False, "controller missing")
checks.true(sim.layout("reconnected.json").screen != "fault", "the fault ends when the controller answers again")
checks.at_most(max(sim.redraw("to-fault.json")), 25.0, "Brew to Fault: no frame repaints over a quarter of the panel")
checks.at_most(max(sim.redraw("from-fault.json")), 25.0, "Fault to Standby: no frame repaints over a quarter of the panel")
sim.save("runaway.bmp", "docs/display/v2/core/fault-runaway.png")
sim.save("link.bmp", "docs/display/v2/core/fault-restart.png")
sim.save("missing.bmp", "docs/display/v2/core/fault-controller-missing.png")

# An update that waits: the download glyph in the slot and the line under the clock. While one installs, the Updating
# screen: progress on the single ring in ink, the percentage as the reading; it cannot be left.
sim = Sim("core-update")
sim.run(
    "wait 3500; expect screen standby; update-ready v1.9.1; wait 900; expect text Update 1.9.1 is ready; shot ready.bmp;"
    "layout ready.json; redraw skip.json;"
    "update; wait 1500; expect screen updating; redraw to-update.json; layout start.json;"
    "update-progress 62; wait 3000; redraw walk.json; shot updating.bmp; layout updating.json;"
    "tap 240 240; swipe 240 440 240 200; wait 900; expect screen updating; quit"
)
checks.count(sim)
ready = sim.layout("ready.json")
slot = next((o for o in ready.objects if o["kind"] == "img" and box(o) == (226, 20, 253, 47)), None)
checks.true(slot is not None, "an update that waits puts the download glyph in the slot")
start, page = sim.layout("start.json"), sim.layout("updating.json")
checks.equal((start.ring["layout"], start.ring["lit"][0]), ("single", 0), "Updating: the single ring, empty before the first report")
checks.equal(page.ring["tone"][0], "ink", "Updating: progress is ink")
checks.equal(page.ring["notch"][0], -1, "Updating: no notch")
checks.equal(page.ring["lit"][0], round(0.62 * 76), "Updating: 62% lights 47 of the 76 ticks")
for text, baseline, font in (("UPDATING", 98, 25), ("%", 284, 25), ("Keep the machine on", 336, 27), ("1.9.1", 370, 25)):
    shown = page.find(text)
    checks.true(shown is not None and shown["baseline"] == baseline and shown["font"] == font, f"Updating: '{text}' at baseline {baseline}")
reading = next((o for o in page.objects if o["kind"] == "reading"), None)
checks.true(reading is not None and reading["text"] == "62", "Updating: the percentage is the reading")
checks.true(not any(o["clickable"] for o in page.objects if o["depth"] > 0), "Updating: no pill, no handle, nothing to press")
checks.at_most(max(sim.redraw("to-update.json")), 25.0, "Standby to Updating: no frame repaints over a quarter of the panel")
walk = sim.redraw("walk.json")
checks.at_most(max(walk), 8.0, "the update walk: continuous motion stays under 8% a frame")
sim.save("ready.bmp", "docs/display/v2/core/standby-update-ready.png")
sim.save("updating.bmp", "docs/display/v2/core/updating.png")

# Wi-Fi setup stands in for Standby while the machine's own network is up: Information's QR layout with its own
# words and no action. A tap anywhere still wakes the machine, as on Standby.
sim = Sim("core-setup")
sim.run(
    "wait 3500; expect screen standby; redraw skip.json; wifi ap; wait 1500; expect screen setup; redraw to-setup.json;"
    "shot setup.bmp; layout setup.json; tap 240 400; wait 900; expect screen menu; quit"
)
checks.count(sim)
setup = sim.layout("setup.json")
for text, baseline in (("JOIN THIS WI-FI", 84), ("BetterMate", 122), ("4.4.4.1", 322), ("SCAN TO SET UP", 350)):
    shown = setup.find(text)
    checks.true(shown is not None and shown["baseline"] == baseline, f"Wi-Fi setup: '{text}' at baseline {baseline}")
card = next((o for o in setup.objects if o["kind"] == "obj" and box(o) == (166, 142, 313, 289)), None)
checks.color(card and card.get("fill"), "#ffffff", "Wi-Fi setup: the QR code on its white card")
checks.true(not setup.has("ABOUT") and not any(o["clickable"] for o in setup.objects if o["depth"] > 0), "Wi-Fi setup: no action, no handle")
checks.equal(setup.ring["layout"], "none", "Wi-Fi setup: no ring")
checks.at_most(max(sim.redraw("to-setup.json")), 25.0, "Standby to Wi-Fi setup: no frame repaints over a quarter of the panel")
sim.save("setup.bmp", "docs/display/v2/core/wifi-setup.png")

# Command pending: a START the controller has not confirmed after its 2-frame press turns quiet (surface-2, STARTING
# in ink-muted) and the handle goes; after 2 s with no answer START returns and a warning says why.
sim = Sim("core-pending")
sim.run(
    "wait 3500; mode brew; wait 3000; expect screen brew; unanswered 1; redraw skip.json;"
    "tap 240 366; wait 250; expect text STARTING; expect active 0; redraw to-pending.json; shot pending.bmp; layout pending.json;"
    "tap 240 366; wait 2500; expect text START; expect hidden STARTING; expect active 0; layout back.json;"
    "tap 240 34; wait 1300; expect screen warnings; expect text Controller did not answer; layout warnings.json;"
    # DONE puts it away: the flush reminder is still there, the unanswered START is not.
    "tap 240 372; wait 1500; expect screen brew; tap 240 34; wait 1300; expect screen warnings;"
    "expect hidden Controller did not answer;"
    # Answered, START never turns quiet: the confirmation is the cut to Shot.
    "tap 240 372; wait 1500; unanswered 0; redraw skip.json; tap 240 366; wait 250; expect hidden STARTING; expect screen shot; quit",
    env={"SIM_TRACE_FLUSH": "1"},
)
checks.count(sim)
pending = sim.layout("pending.json")
pill = pending.find("STARTING")
checks.true(pill is not None and box(pill) == (146, 334, 333, 397), "pending: STARTING takes START's place")
checks.color(pill and pill.get("fill"), SURFACE_2, "pending: the quiet pill is surface-2")
checks.color(pill and pill["color"], MUTED, "pending: STARTING is ink-muted")
checks.true(not any(o["clickable"] and o["y1"] >= 410 for o in pending.objects if o["depth"] > 0), "pending: the handle hides")
# The press inverts the pill and lets it go (two frames of its own, with a digit of the heating reading); then the
# swap to the quiet pill repaints the pill's box alone, and the handle goes in the frame after.
checks.at_most(max(sim.redraw("to-pending.json")), 10.0, "pending: no frame of the press and the swap repaints over 10%")
groups = {}  # the rectangles of one repaint, by the time it started (one repaint may log over 2 or 3 ms)
start = None
for line in sim.log.splitlines():
    if line.startswith("[flush] "):
        parts = line.split()
        corner, size = parts[-2:]
        ms = int(parts[1])
        if start is None or ms - start > 10:
            start = ms
        groups.setdefault(start, []).append((*map(int, corner.split(",")), *map(int, size.split("x"))))
pill_rect = (146 + SHOT_SHIFT, 334 + SHOT_SHIFT, 188, 64)
handle_rect = (212 + SHOT_SHIFT, 418 + SHOT_SHIFT, 56, 56)
order = sorted(groups)
# The swap: the frame that repaints the pill followed by the frame where the handle goes. Besides the pill it may only
# carry what runs on its own cadence anyway: a tick of the heating pulse, a digit of the reading (one cell).
swap = [ms for ms, after in zip(order, order[1:]) if pill_rect in groups[ms] and handle_rect in groups[after]]
extra = [r for ms in swap for r in groups[ms] if r != pill_rect]
checks.true(len(swap) == 1, f"pending: the pill turns quiet in one frame, the handle goes in the next ({swap})")
checks.true(all(w <= 31 and h <= 31 or w * h <= 75 * 84 for _, _, w, h in extra),
            f"pending: the swap repaints the pill's own box, 5.2% of the panel, and nothing for it besides ({extra})")
back = sim.layout("back.json")
again = back.find("START")
checks.color(again and again.get("fill"), PRIMARY, "after 2 s with no answer START returns in primary")
warnings = sim.layout("warnings.json")
row = next((o for o in warnings.objects if o.get("text") == "Controller did not answer"), None)
checks.true(row is not None and row["x2"] <= 418, "the warning's sentence fits its card")
sim.save("pending.bmp", "docs/display/v2/core/brew-pending.png")

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
