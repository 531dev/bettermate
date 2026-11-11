#!/usr/bin/env python3
"""Checks the display core on Standby and Brew: what is on the glass, and what each frame repaints.

    pio run -e display-sim && python3 scripts/verify_display_core.py
"""

from display_sim import Checks, Sim

checks = Checks("display core")

# Boot into Standby, change to Brew, let it heat, go back: the budgets of design/reference/motion.md.
sim = Sim("core-change")
sim.run(
    "wait 3500; expect screen standby; shot standby.bmp; layout standby.json; redraw boot.json;"
    "mode brew; wait 2500; expect screen brew; redraw to-brew.json; shot brew.bmp; layout brew.json;"
    "wait 6000; redraw heating.json;"
    "mode standby; wait 2500; expect screen standby; redraw to-standby.json; quit"
)
checks.count(sim)
standby = sim.layout("standby.json")
checks.equal(standby.ring["layout"], "single", "Standby draws the single ring")
checks.equal(standby.ring["tone"][0], "faint", "Standby's ring is ink-faint")
checks.equal(standby.ring["notch"][0], -1, "Standby's ring has no notch")
checks.true(standby.has("WAKE"), "WAKE is visible on Standby")
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
sim.save("standby.bmp", "docs/display/v2/core/standby.png")
sim.save("brew.bmp", "docs/display/v2/core/brew-heating.png")

# Busy and blocked states take the line under the clock; the comet costs under 1% a frame.
sim = Sim("core-states")
sim.run(
    "wait 3500; controller disconnected; wait 2500; expect text CONNECTING; expect hidden WAKE; redraw settle.json;"
    "wait 2000; redraw comet.json; shot connecting.bmp; error 4; wait 1500; expect text TEMPERATURE ERROR;"
    "expect hidden WAKE; shot error.bmp; quit"
)
checks.count(sim)
checks.at_most(max(sim.redraw("comet.json")), 1.0, "the busy comet repaints under 1% a frame")
sim.save("connecting.bmp", "docs/display/v2/core/standby-connecting.png")
sim.save("error.bmp", "docs/display/v2/core/standby-error.png")

# Pressed parts invert, WAKE opens the menu, Light is a setting.
sim = Sim("core-input")
sim.run(
    "wait 3500; press 240 362; wait 130; layout pressed.json; release; wait 700; expect screen menu;"
    "mode brew; wait 2500; theme 1; wait 600; layout light.json; shot light.bmp; quit"
)
checks.count(sim)
pressed = sim.layout("pressed.json").find("WAKE")
checks.color(pressed and pressed.get("fill"), "#f2f2f2", "a pressed pill inverts to ink")
light = sim.layout("light.json")
checks.color(light.objects[0]["fill"], "#e9e9e9", "the Light theme paints the face in surface-0")
sim.save("light.bmp", "docs/display/v2/core/brew-light.png")

checks.finish()
