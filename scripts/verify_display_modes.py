#!/usr/bin/env python3
"""Checks Steam, Water and Grind on the display: what each state shows, what its controls do, what a frame repaints.

    pio run -e display-sim && SIM_PORT_BASE=8230 python3 scripts/verify_display_modes.py [--slow] [--only CASE ...]

The cases run one after the other, each in its own simulator with fresh settings; together they take about seven
minutes, because the mock boiler heats in real time. --slow adds the one state that takes eleven more minutes to
reach: Steam after the controller's safety limit has ended the steam process ("Ready"). Screenshots go to
docs/display/v2/modes/; compare them with design/reference/components/DisplayModes/preview.html.

The Grind screen needs a grinder: the alt relay set to grind (`alt_relay` 1, the default, so a fresh simulator has
one) or SmartGrind. To take it away, POST altRelayFunction=0 to /api/settings on SIM_HTTP_PORT, or start the
simulator with {"alt_relay": "0"} in sim_data/nvs/controller.json, the way seed() below writes settings.
"""

import argparse
import json
import re
import struct

from display_sim import PANEL_PX, Checks, Sim

OUT = "docs/display/v2/modes"

# Display black, design/tokens.json
INK, ON_INK, MUTED = "#f2f2f2", "#000000", "#a6a6a6"
PRIMARY, ON_PRIMARY, HEAT_TEXT, WARNING = "#5361ff", "#ffffff", "#ff9a70", "#f5b400"
SURFACE_1, SURFACE_2 = "#141414", "#232323"

# design/reference/components/bundle.js, screens.mode and screens.grind
MINUS, PLUS, HANDLE, PILL, SLOT = (82, 250), (398, 250), (240, 446), (240, 376), (240, 34)
SEG_TIME, SEG_WEIGHT, SCALE_LINE = (181, 134), (299, 134), (240, 190)
SWIPE_UP = "swipe 240 300 240 120"
AT_REST = {"minus", "plus", "handle", "pill"}
WITH_SCALE = AT_REST | {"time", "weight", "scale"}

checks = Checks("display modes")
measured = {}
notes = []


def tap(point):
    return f"tap {point[0]} {point[1]}"


def seed(sim, **settings):
    """Starts a simulator with these settings (NVS keys of src/display/core/Settings.h)."""
    nvs = sim.dir / "sim_data" / "nvs"
    nvs.mkdir(parents=True)
    (nvs / "controller.json").write_text(json.dumps({key: str(value) for key, value in settings.items()}))


def run(sim, script, timeout=240):
    """Runs a script; a failed `expect` fails the suite but lets the other cases run."""
    try:
        sim.run(script, timeout=timeout)
    except AssertionError as error:
        checks.true(False, str(error))
        return False
    finally:
        checks.count(sim)
    return True


def control_at(page, point):
    """The control that would answer a touch at this point, or None."""
    hits = [o for o in page.clickable() if o["x1"] <= point[0] <= o["x2"] and o["y1"] <= point[1] <= o["y2"]]
    return hits[-1] if hits else None


def controls(page):
    """Where a touch is answered: one name for each control on the glass."""
    places = {"minus": MINUS, "plus": PLUS, "handle": HANDLE, "pill": PILL, "slot": SLOT, "time": SEG_TIME,
              "weight": SEG_WEIGHT, "scale": SCALE_LINE}
    return {name for name, point in places.items() if control_at(page, point) is not None}


def pills(page):
    return [o for o in page.objects if o["kind"] == "label" and "fill" in o and o["y2"] - o["y1"] + 1 == 64]


def box(o):
    return (o["x1"], o["y1"], o["x2"], o["y2"])


def centred(o, left="x1", right="x2"):
    return abs(o[left] + o[right] - 480) <= 2


def brightest(sim, bmp, o):
    """The brightest pixel inside an object's box in a `shot`: the color its ink is drawn in."""
    data = (sim.dir / bmp).read_bytes()
    offset = struct.unpack_from("<I", data, 10)[0]
    width, height = struct.unpack_from("<ii", data, 18)
    if struct.unpack_from("<H", data, 28)[0] != 24 or height < 0:
        raise SystemExit(f"{bmp}: expected a bottom-up 24-bit BMP")
    stride = (width * 3 + 3) & ~3
    best = (0, 0, 0)
    for y in range(o["y1"], o["y2"] + 1):
        row = offset + (height - 1 - y) * stride
        for x in range(o["x1"], o["x2"] + 1):
            blue, green, red = data[row + x * 3 : row + x * 3 + 3]
            if red + green + blue > sum(best):
                best = (red, green, blue)
    return "#%02x%02x%02x" % best


def frame(page, mode, label, unit, heading):
    """What every state of a mode shares: the design's positions, faces and tones. Returns the large reading."""
    checks.equal(page.screen, mode, f"{heading}: the {mode} screen is on the glass")
    checks.equal(page.ring["layout"], "single", f"{heading}: one ring")
    name = page.find(label)
    checks.true(name is not None and name["baseline"] == 86 and centred(name, "tx1", "tx2"),
                f"{heading}: {label} sits centred on baseline 86")
    checks.color(name and name["color"], MUTED, f"{heading}: the label is ink-muted")
    readings = sorted((o for o in page.objects if o["kind"] == "reading"), key=lambda o: o["y1"])
    target = readings[-1] if readings else None
    # A Reading's box is its line: hero-sm is 67 px tall with its baseline one above the bottom edge.
    checks.true(target is not None and target["y2"] == 284 and target["font"] == 67 and centred(target),
                f"{heading}: the reading is hero-sm, centred on baseline 284")
    under = page.find(unit)
    checks.true(under is not None and under["baseline"] == 318 and under["font"] == 25, f"{heading}: the unit {unit} sits on baseline 318")
    checks.color(under and under["color"], MUTED, f"{heading}: the unit is ink-muted")
    checks.true(len(pills(page)) <= 1, f"{heading}: at most one pill")
    for o in page.clickable():
        # The core's parts: a label line answers on 44 px, a segment on 48 px inside its 56 px track.
        least = 44 if "TARE" in o.get("text", "") else 48 if o["depth"] > 1 else 56
        checks.true(o["x2"] - o["x1"] + 1 >= least and o["y2"] - o["y1"] + 1 >= least,
                    f"{heading}: the control at {o['x1']},{o['y1']} is at least {least} px")
    return target


def live_value(page, heading, pattern):
    """The second-rank value above the target: screen-value, 53 px tall with its baseline at 146."""
    readings = sorted((o for o in page.objects if o["kind"] == "reading"), key=lambda o: o["y1"])
    live = readings[0] if len(readings) == 2 else None
    placed = live is not None and live["y1"] == 103 and live["font"] == 53 and centred(live)
    checks.true(placed and re.fullmatch(pattern, live["text"]) is not None,
                f"{heading}: the live value sits centred on baseline 146 ({live and live['text']!r})")
    return live


def stepper(page, heading):
    minus, plus = control_at(page, MINUS), control_at(page, PLUS)
    checks.true(minus is not None and box(minus) == (52, 220, 111, 279), f"{heading}: minus is a 60 px disc at 82, 250")
    checks.true(plus is not None and box(plus) == (368, 220, 427, 279), f"{heading}: plus is a 60 px disc at 398, 250")
    checks.color(minus and minus.get("fill"), SURFACE_2, f"{heading}: the discs are surface-2")


def pill(page, heading, label, fill, ink):
    found = page.find(label)
    checks.true(found is not None and box(found) == (152, 344, 327, 407), f"{heading}: {label} is a 176 px pill at y 344")
    checks.color(found and found.get("fill"), fill, f"{heading}: {label} is filled {fill}")
    checks.color(found and found.get("color"), ink, f"{heading}: {label} is written in {ink}")


def budget(sim, name, limit, what, record=True):
    """The largest frame of a `redraw` capture, checked against the motion budget."""
    frames = sim.redraw(name)
    worst = max(frames) if frames else 0.0
    checks.at_most(worst, limit, f"{what}: no frame repaints over {limit:g}% of the panel")
    if record:
        measured[what] = (worst, limit)
    return worst


def step(sim, name, what, record=True):
    """A change of screen or of state: one step of a transition, at most a quarter of the panel in any frame."""
    return budget(sim, name, 25.0, what, record)


def motion(sim, name, what, record=True):
    """Anything that keeps moving: at most 8% of the panel in any frame."""
    return budget(sim, name, 8.0, what, record)


def steam():
    """Heating, the steam process starting by itself, the boiler on target, and the menu from the handle."""
    sim = Sim("modes-steam")
    ok = run(sim, f"""
        wait 3500; mode steam; wait 2500; expect screen steam; expect mode 2; expect active 0; expect setpoint 145;
        expect temperature 93; expect text STEAM; expect text 145; expect text TARGET °C; expect text Heating;
        expect hidden START; expect hidden STOP; redraw to-steam.frames; layout enter.json;
        {tap(PLUS)}; wait 400; expect setpoint 146; expect text 146; {tap(MINUS)}; wait 400; expect setpoint 145; expect text 145;
        expect temperature 93; redraw edit.frames; wait 8000; redraw heating.frames;
        wait 12000; shot heating.bmp; layout heating.json;
        wait 17300; expect active 1; expect text Steaming; expect hidden Heating; shot steaming.bmp; layout steaming.json;
        wait 30000; expect active 1; expect text 145°; expect text Steaming; shot on-target.bmp; layout on-target.json;
        redraw to-target.frames; wait 4000; redraw settled.frames;
        {tap(HANDLE)}; wait 800; expect screen menu; expect mode 1; expect active 0; quit
    """)
    if not ok:
        return
    enter = sim.layout("enter.json")
    frame(enter, "steam", "STEAM", "TARGET °C", "Steam, entering")
    stepper(enter, "Steam")
    checks.equal(controls(enter), {"minus", "plus", "handle"}, "Steam offers minus, plus and the handle, and no action")
    checks.equal(len(pills(enter)), 0, "Steam has no pill: steaming starts with the valve")

    heating = sim.layout("heating.json")
    target = frame(heating, "steam", "STEAM", "TARGET °C", "Steam, heating")
    checks.equal(target and target["text"], "145", "Steam, heating: the reading is the steam target")
    live = live_value(heating, "Steam, heating", r"1[0-9][0-9]°")
    checks.color(brightest(sim, "heating.bmp", live), HEAT_TEXT, "Steam, heating: the live temperature is heat-text")
    checks.color(brightest(sim, "heating.bmp", target), INK, "Steam, heating: the target is ink")
    checks.equal(heating.ring["tone"][0], "heat", "Steam: the ring is temperature, in heat")
    checks.equal(heating.ring["notch"][0], round(145 / 160 * 75), "Steam: the notch marks 145° on the fixed 160° scale")
    checks.true(live is not None and abs(heating.ring["lit"][0] - int(live["text"][:-1]) / 160 * 76) <= 1,
                f"Steam: the lit ticks follow the live temperature ({heating.ring['lit'][0]} of 76)")
    line = heating.find("Heating")
    checks.true(line is not None and line["baseline"] == 380 and line["font"] == 26, "Steam: the status line is screen-body on baseline 380")
    checks.color(line and line["color"], MUTED, "Steam: the status line is ink-muted")

    steaming = sim.layout("steaming.json")
    frame(steaming, "steam", "STEAM", "TARGET °C", "Steam, steaming")
    checks.equal(controls(steaming), {"minus", "plus", "handle"}, "Steaming keeps minus, plus and the handle: leaving is how it ends")
    line = steaming.find("Steaming")
    checks.true(line is not None and line["baseline"] == 380, "Steaming says so where the pill would be")
    live = live_value(steaming, "Steam, steaming", r"14[0-4]°")
    checks.color(brightest(sim, "steaming.bmp", live), HEAT_TEXT, "Steaming below the target: the live temperature stays heat-text")

    on_target = sim.layout("on-target.json")
    live = live_value(on_target, "Steam, on target", r"145°")
    checks.color(brightest(sim, "on-target.bmp", live), INK, "Steam, on target: the live temperature turns ink")
    # The simulator counts the notch apart from the lit ticks: 68 lit and the notch as the 69th.
    checks.equal(on_target.ring["lit"][0], on_target.ring["notch"][0], "Steam, on target: every tick up to the notch is lit")

    step(sim, "to-steam.frames", "Standby to Steam")
    motion(sim, "edit.frames", "a one-degree edit")
    motion(sim, "heating.frames", "Steam heating")
    motion(sim, "to-target.frames", "Steam reaching its target", record=False)
    budget(sim, "settled.frames", 1.0, "Steam on target")
    sim.save("heating.bmp", f"{OUT}/steam-heating.png")
    sim.save("steaming.bmp", f"{OUT}/steam-steaming.png")
    sim.save("on-target.bmp", f"{OUT}/steam-on-target.png")


def steam_edits():
    """Held controls repeat, no press is lost, the target stops at 160°, and Brew's profile is never touched."""
    sim = Sim("modes-steam-edits")
    seed(sim, ts=120)
    ok = run(sim, f"""
        wait 3500; mode brew; wait 1500; expect temperature 93; expect setpoint 93;
        mode steam; wait 2500; expect setpoint 120; expect text 120;
        hold 398 250 450; wait 400; expect setpoint 121;
        redraw before-hold.frames; hold 398 250 1500; wait 400; layout held-up.json; redraw hold.frames;
        hold 82 250 1500; wait 400; layout held-down.json;
        expect temperature 93; mode brew; wait 2500; expect screen brew; expect temperature 93; expect setpoint 93; quit
    """)
    if ok:
        up = int(next(o["text"] for o in sim.layout("held-up.json").objects if o["kind"] == "reading" and o["y2"] == 284))
        down = int(next(o["text"] for o in sim.layout("held-down.json").objects if o["kind"] == "reading" and o["y2"] == 284))
        checks.true(5 <= up - 121 <= 14, f"plus held for 1.5 s repeats: {up - 121} steps")
        checks.true(5 <= up - down <= 14, f"minus held for 1.5 s repeats: {up - down} steps")
        notes.append(f"held for 1.5 s, plus steps {up - 121} times and minus {up - down} times")
        motion(sim, "hold.frames", "a held plus")

    sim = Sim("modes-steam-limit")
    seed(sim, ts=158)
    ok = run(sim, f"""
        wait 3500; mode steam; wait 2500; expect setpoint 158; hold 398 250 1200; wait 400; expect setpoint 160; expect text 160;
        {tap(PLUS)}; wait 400; expect setpoint 160; expect text 160; layout limit.json; expect temperature 93;
        {SWIPE_UP}; wait 800; expect screen menu; expect mode 1; quit
    """)
    if ok:
        limit = sim.layout("limit.json")
        checks.equal(limit.ring["notch"][0], 75, "Steam at its 160° limit: the notch is the last tick")
        checks.equal(controls(limit), {"minus", "plus", "handle"}, "Steam at its limit keeps both discs: core controls stay visible")


def water():
    """START and STOP, what a running water process shows, the pumped volume when a controller reports it."""
    sim = Sim("modes-water")
    ok = run(sim, f"""
        wait 3500; mode water; wait 2500; expect screen water; expect mode 3; expect active 0; expect setpoint 80;
        expect text WATER; expect text 80; expect text TARGET °C; expect text START; expect hidden STOP; expect hidden ML;
        redraw to-water.frames; layout enter.json; shot heating.bmp;
        {tap(PLUS)}; wait 400; expect setpoint 81; expect text 81; {tap(MINUS)}; wait 400; expect setpoint 80; expect text 80;
        expect temperature 93; redraw edit.frames;
        {tap(PILL)}; wait 700; expect active 1; expect text STOP; expect hidden START; expect text 80; expect text TARGET °C;
        expect hidden ML; redraw start.frames; layout running.json; shot running.bmp;
        {SWIPE_UP}; wait 500; expect screen water; expect active 1;
        {tap(HANDLE)}; wait 400; expect screen water; expect active 1;
        {tap(MINUS)}; {tap(PLUS)}; wait 300; expect setpoint 80;
        pumped 37; wait 500; expect text 37; expect text ML; expect hidden TARGET °C; expect hidden 80;
        pumped 118; wait 500; expect text 118; expect text ML; layout pumped.json; shot pumped.bmp;
        redraw first-pumped.frames; pumped 121; wait 300; pumped 125; wait 300; pumped 128; wait 300; pumped 132; wait 300;
        pumped 136; wait 300; pumped 139; wait 300; redraw pumping.frames;
        hold 240 376 700; wait 800; expect active 0; expect text START; expect hidden STOP; expect text 80; expect text TARGET °C;
        expect hidden ML; redraw stop.frames; layout stopped.json;
        wait 50000; expect text 80°; layout on-target.json; shot on-target.bmp;
        {SWIPE_UP}; wait 800; expect screen menu; expect mode 1; expect active 0; quit
    """)
    if not ok:
        return
    enter = sim.layout("enter.json")
    target = frame(enter, "water", "WATER", "TARGET °C", "Water, heating")
    checks.equal(target and target["text"], "80", "Water: the reading is the water target")
    stepper(enter, "Water")
    pill(enter, "Water", "START", PRIMARY, ON_PRIMARY)
    checks.equal(controls(enter), AT_REST, "Water at rest offers minus, plus, START and the handle")
    live = live_value(enter, "Water, heating", r"[0-9]+°")
    checks.color(brightest(sim, "heating.bmp", live), HEAT_TEXT, "Water, heating: the live temperature is heat-text")
    checks.equal(enter.ring["tone"][0], "heat", "Water: the ring is temperature, in heat")
    checks.equal(enter.ring["notch"][0], 38, "Water: the notch marks 80°, half of the fixed scale")

    running = sim.layout("running.json")
    target = frame(running, "water", "WATER", "TARGET °C", "Water, running")
    pill(running, "Water, running", "STOP", INK, ON_INK)
    checks.equal(controls(running), {"pill"}, "Water, running: minus, plus and the handle are hidden; only STOP answers")
    checks.equal(target and target["text"], "80", "Water, running without a pump meter: the target stays, no number is invented")
    live_value(running, "Water, running", r"[0-9]+°")
    checks.equal(running.ring["notch"][0], 38, "Water, running: the ring keeps the target notch")

    pumped = sim.layout("pumped.json")
    target = frame(pumped, "water", "WATER", "ML", "Water, running with a pump meter")
    checks.equal(target and target["text"], "118", "Water, running: the reading is the millilitres the controller reports")
    checks.equal(controls(pumped), {"pill"}, "Water, pumping: only STOP answers")

    stopped = sim.layout("stopped.json")
    checks.equal(controls(stopped), AT_REST, "Water, stopped: minus, plus and the handle are back")
    pill(stopped, "Water, stopped", "START", PRIMARY, ON_PRIMARY)

    on_target = sim.layout("on-target.json")
    live = live_value(on_target, "Water, on target", r"80°")
    checks.color(brightest(sim, "on-target.bmp", live), INK, "Water, on target: the live temperature is ink")
    checks.equal(on_target.ring["lit"][0], 38, "Water, on target: half the ring is lit")

    step(sim, "to-water.frames", "Standby to Water")
    step(sim, "start.frames", "Water START")
    step(sim, "stop.frames", "Water STOP")
    step(sim, "first-pumped.frames", "Water, the reading turning to millilitres")
    motion(sim, "pumping.frames", "Water pumping")
    sim.save("heating.bmp", f"{OUT}/water-heating.png")
    sim.save("running.bmp", f"{OUT}/water-running.png")
    sim.save("pumped.bmp", f"{OUT}/water-pumped.png")
    sim.save("on-target.bmp", f"{OUT}/water.png")


def grind_by_time():
    """No scale: no row, grinding by time, START and STOP, a grind that ends by itself, the menu from the handle."""
    sim = Sim("modes-grind-time")
    ok = run(sim, f"""
        wait 3500; mode grind; wait 2500; expect screen grind; expect mode 4; expect grind-active 0; expect grind-duration 25;
        expect text GRIND; expect text 0:25; expect text SECONDS; expect text START; expect hidden STOP;
        expect hidden TIME; expect hidden WEIGHT; redraw to-grind.frames; layout idle.json; shot idle.bmp;
        {tap(PLUS)}; wait 400; expect grind-duration 26; expect text 0:26; {tap(MINUS)}; wait 400; expect grind-duration 25;
        expect text 0:25; hold 398 250 450; wait 400; expect grind-duration 26; {tap(MINUS)}; wait 400; expect grind-duration 25;
        expect temperature 93; redraw edit.frames;
        {tap(PILL)}; wait 600; expect grind-active 1; expect text STOP; expect hidden START; expect hidden SECONDS;
        expect text LEFT OF 0:25; redraw start.frames; layout started.json;
        {SWIPE_UP}; wait 500; expect screen grind; expect grind-active 1;
        {tap(HANDLE)}; wait 300; expect grind-active 1; {tap(PLUS)}; {tap(MINUS)}; wait 300; expect grind-duration 25;
        redraw touches.frames; wait 6800; expect text 0:09; expect text 0:16; shot running.bmp; layout running.json;
        redraw running.frames;
        hold 240 376 700; wait 800; expect grind-active 0; expect text START; expect text 0:25; expect text SECONDS;
        redraw stop.frames; layout stopped.json;
        {tap(HANDLE)}; wait 800; expect screen menu; expect mode 1; quit
    """)
    if ok:
        idle = sim.layout("idle.json")
        target = frame(idle, "grind", "GRIND", "SECONDS", "Grind by time")
        checks.equal(target and target["text"], "0:25", "Grind by time: the reading is the time target")
        stepper(idle, "Grind")
        pill(idle, "Grind", "START", PRIMARY, ON_PRIMARY)
        checks.equal(controls(idle), AT_REST, "Grind without a scale: no row and no tare, grinding is by time")
        checks.equal(idle.ring["lit"][0], 0, "Grind at rest: no progress on the ring")
        checks.equal(idle.ring["notch"][0], -1, "Grind: the progress ring has no notch")
        checks.color(brightest(sim, "idle.bmp", target), INK, "Grind: the target is ink")

        running = sim.layout("running.json")
        target = frame(running, "grind", "GRIND", "LEFT OF 0:25", "Grinding by time")
        checks.equal(target and target["text"], "0:16", "Grinding by time: the reading is the time left")
        live = live_value(running, "Grinding by time", r"0:09")
        checks.color(brightest(sim, "running.bmp", live), INK, "Grinding: the elapsed time is ink")
        pill(running, "Grinding", "STOP", INK, ON_INK)
        checks.equal(controls(running), {"pill"}, "Grinding: minus, plus and the handle are hidden; only STOP answers")
        checks.equal(running.ring["tone"][0], "ink", "Grinding: progress is drawn in ink")
        lit = running.ring["lit"][0]
        checks.true(abs(lit - round(9.5 / 25 * 76)) <= 2, f"Grinding by time: the ring shows the share of time gone ({lit} ticks)")
        checks.equal(running.ring["notch"][0], -1, "Grinding: no notch")
        checks.equal(controls(sim.layout("stopped.json")), AT_REST, "Grind, stopped: minus, plus and the handle are back")
        # Both clocks change in the same frame, once a second, wherever the snapshots happen to fall.
        rows = [json.loads(line) for line in (sim.dir / "running.frames").read_text().splitlines() if line.strip()]
        steps = [row["ms"] for row in rows if row["px"] * 100.0 / PANEL_PX >= 1.5]
        gaps = [later - earlier for earlier, later in zip(steps, steps[1:])]
        checks.true(len(gaps) >= 4 and all(930 <= gap <= 1070 for gap in gaps),
                    f"Grinding by time: every second on the clocks lasts a second ({gaps} ms)")
        if gaps:
            notes.append(f"grinding by time, the clocks step every {min(gaps)} to {max(gaps)} ms")

        step(sim, "to-grind.frames", "Standby to Grind")
        step(sim, "start.frames", "Grind START")
        motion(sim, "running.frames", "grinding by time")
        step(sim, "stop.frames", "Grind STOP")
        sim.save("idle.bmp", f"{OUT}/grind-no-scale.png")
        sim.save("running.bmp", f"{OUT}/grinding-time.png")

    sim = Sim("modes-grind-short")
    seed(sim, tgd=5000)
    ok = run(sim, f"""
        wait 3500; mode grind; wait 2500; expect text 0:05; expect grind-duration 5; {tap(MINUS)}; wait 400; expect grind-duration 5;
        expect text 0:05; {tap(PILL)}; wait 2400; expect grind-active 1; layout half.json;
        wait 3600; expect grind-active 0; expect text START; expect text 0:05; expect text SECONDS; layout ended.json; quit
    """)
    if ok:
        half = sim.layout("half.json")
        checks.true(abs(half.ring["lit"][0] - 38) <= 8, f"A five-second grind is half done after 2.5 s ({half.ring['lit'][0]} of 76 ticks)")
        ended = sim.layout("ended.json")
        checks.equal(controls(ended), AT_REST, "A grind that ends by itself returns the controls")
        checks.equal(ended.ring["lit"][0], 0, "A grind that ended leaves no progress on the ring")


def grind_with_scale():
    """The TIME · WEIGHT row, tare, grinding by weight to its target, and the fall back to time when the scale goes."""
    sim = Sim("modes-grind-scale")
    ok = run(sim, f"""
        scale 1; wait 3500; mode grind; wait 2500; expect screen grind; expect text TIME; expect text WEIGHT; expect text 0:25;
        expect text SECONDS; expect text 0.0 G · TARE; redraw to-grind.frames; layout time.json; shot time.bmp;
        weight 7.5; wait 500; expect text 7.5 G · TARE; {tap(SCALE_LINE)}; wait 500; expect text 0.0 G · TARE;
        weight 3.2; wait 500; expect text 3.2 G · TARE; hold 240 190 700; wait 500; expect text 0.0 G · TARE;
        {tap(SEG_TIME)}; wait 400; expect text 0:25; expect grind-weight 180; redraw before-toggle.frames;
        {tap(SEG_WEIGHT)}; wait 500; expect text 18.0; expect text GRAMS; expect hidden SECONDS; expect grind-weight 180;
        expect grind-duration 25; redraw toggle.frames; layout weight.json; shot weight.bmp;
        {tap(SEG_WEIGHT)}; wait 400; expect text 18.0; expect text GRAMS;
        {tap(PLUS)}; wait 400; expect grind-weight 185; expect text 18.5; {tap(MINUS)}; wait 400; expect grind-weight 180;
        expect text 18.0; expect grind-duration 25;
        {tap(PILL)}; wait 500; expect grind-active 1; expect text STOP; expect hidden TIME; expect hidden WEIGHT;
        expect hidden 0.0 G · TARE; expect hidden GRAMS; expect text OF 18.0 G; expect text 0.0; redraw start.frames;
        weight 2.6; wait 1000; weight 5.2; wait 1000; weight 7.9; wait 1000; expect text 7.9;
        redraw early.frames; weight 10.3; wait 1000; redraw digit.frames;
        weight 10.9; wait 800; weight 11.1; wait 800; weight 11.4; wait 800; redraw weighing.frames;
        wait 2500; expect text 11.4; expect text 0:09; shot running.bmp; layout running.json;
        weight 18.4; wait 1200; expect grind-active 0; expect text START; expect text 18.0; expect text GRAMS;
        expect text 18.4 G · TARE; expect text WEIGHT; redraw finish.frames; layout finished.json;
        scale 0; wait 2500; expect text 0:25; expect text SECONDS; expect hidden TIME; expect hidden WEIGHT;
        expect hidden 18.4 G · TARE; expect hidden GRAMS; layout scale-lost.json;
        {tap(PLUS)}; wait 400; expect grind-duration 26; expect grind-weight 180; {tap(MINUS)}; wait 400; expect grind-duration 25;
        scale 1; wait 1000; expect text 18.0; expect text GRAMS; expect text WEIGHT;
        weight 0; wait 400; {tap(PILL)}; wait 500; expect grind-active 1; weight 3; wait 600; expect text 3.0;
        scale 0; wait 2500; expect grind-active 1; expect text STOP; expect text OF 18.0 G; layout scale-lost-running.json;
        {tap(PILL)}; wait 800; expect grind-active 0; expect text 0:25; expect text SECONDS; expect text START; quit
    """)
    if not ok:
        return
    time = sim.layout("time.json")
    frame(time, "grind", "GRIND", "SECONDS", "Grind with a scale")
    stepper(time, "Grind with a scale")
    checks.equal(controls(time), WITH_SCALE, "Grind with a scale offers the row, the tare line, minus, plus, START and the handle")
    track = next((o for o in time.objects if o["kind"] == "obj" and (o["x1"], o["y1"]) == (118, 106)), None)
    checks.true(track is not None and (track["x2"], track["y2"]) == (361, 161), "Grind: the row is a 244 px track at y 106, 56 px tall")
    checks.color(track and track.get("fill"), SURFACE_1, "Grind: the row's track is surface-1")
    chosen, other = time.find("TIME"), time.find("WEIGHT")
    checks.color(chosen and chosen.get("fill"), INK, "Grind by time: TIME is the ink segment")
    checks.color(chosen and chosen.get("color"), ON_INK, "Grind by time: TIME is written on-ink")
    checks.color(other and other.get("color"), MUTED, "Grind by time: WEIGHT is ink-muted")
    line = time.find("0.0 G · TARE")
    checks.true(line is not None and line["baseline"] == 194 and line["font"] == 25 and centred(line, "tx1", "tx2"),
                "Grind: the scale's weight and TARE share one centred label line")
    checks.true(line is not None and track is not None and line["y1"] > track["y2"] and line["y2"] < 218,
                "Grind: the tare line clears the row and the reading")

    weight = sim.layout("weight.json")
    target = frame(weight, "grind", "GRIND", "GRAMS", "Grind by weight")
    checks.equal(target and target["text"], "18.0", "Grind by weight: the reading is the weight target")
    checks.color(weight.find("WEIGHT") and weight.find("WEIGHT").get("fill"), INK, "Grind by weight: WEIGHT is the ink segment")
    checks.true(target is not None and target["x1"] > 111 and target["x2"] < 368, "Grind by weight: the reading stays between the discs")

    running = sim.layout("running.json")
    target = frame(running, "grind", "GRIND", "OF 18.0 G", "Grinding by weight")
    checks.equal(target and target["text"], "11.4", "Grinding by weight: the reading is what has been ground")
    live_value(running, "Grinding by weight", r"0:09")
    pill(running, "Grinding by weight", "STOP", INK, ON_INK)
    checks.equal(controls(running), {"pill"}, "Grinding by weight: the row, the tare line, minus, plus and the handle are hidden")
    checks.equal(running.ring["tone"][0], "ink", "Grinding by weight: progress is drawn in ink")
    checks.equal(running.ring["lit"][0], round(11.4 / 18.0 * 76), "Grinding by weight: the ring shows 11.4 of 18.0 g")
    checks.equal(running.ring["notch"][0], -1, "Grinding by weight: no notch")

    checks.equal(controls(sim.layout("finished.json")), WITH_SCALE, "Ground to the target: every control is back")
    checks.equal(controls(sim.layout("scale-lost.json")), AT_REST, "Scale lost: the row and the tare line go, the target falls back to time")
    checks.equal(controls(sim.layout("scale-lost-running.json")), {"pill"}, "Scale lost while grinding by weight: STOP still answers")

    step(sim, "to-grind.frames", "Standby to Grind with a scale")
    step(sim, "toggle.frames", "TIME to WEIGHT")
    step(sim, "start.frames", "Grind START with a scale")
    motion(sim, "early.frames", "grinding by weight, the first grams", record=False)
    step(sim, "digit.frames", "a reading gaining a digit (7.9 to 10.3 g)")
    motion(sim, "weighing.frames", "grinding by weight")
    step(sim, "finish.frames", "a grind reaching its target")
    sim.save("time.bmp", f"{OUT}/grind-time.png")
    sim.save("weight.bmp", f"{OUT}/grind-weight.png")
    sim.save("running.bmp", f"{OUT}/grinding-weight.png")


def limits():
    """Targets stop at the controller's limits: 0° and 160°, 5 s and 5:00, 5.0 g and 250.0 g."""
    sim = Sim("modes-limits-high")
    seed(sim, tw=159, tgd=299000, tgv=249.5)
    ok = run(sim, f"""
        scale 1; wait 3500; mode water; wait 2500; expect setpoint 159; {tap(PLUS)}; wait 400; expect setpoint 160; expect text 160;
        {tap(PLUS)}; wait 400; expect setpoint 160;
        mode grind; wait 2500; expect text 4:59; {tap(PLUS)}; wait 400; expect grind-duration 300; expect text 5:00;
        {tap(PLUS)}; wait 400; expect grind-duration 300; expect text 5:00;
        {tap(SEG_WEIGHT)}; wait 500; expect text 249.5; {tap(PLUS)}; wait 400; expect grind-weight 2500; expect text 250.0;
        {tap(PLUS)}; wait 400; expect grind-weight 2500; expect text 250.0; layout widest.json; shot widest.bmp;
        expect temperature 93; quit
    """)
    if ok:
        widest = sim.layout("widest.json")
        target = frame(widest, "grind", "GRIND", "GRAMS", "Grind at 250.0 g")
        checks.true(target is not None and target["x1"] > 111 and target["x2"] < 368,
                    "Grind at 250.0 g: the widest reading stays between the discs")
        sim.save("widest.bmp", f"{OUT}/grind-weight-limit.png")

    sim = Sim("modes-limits-low")
    seed(sim, tw=1, tgd=6000, tgv=5.5)
    ok = run(sim, f"""
        scale 1; wait 3500; mode water; wait 2500; expect setpoint 1; {tap(MINUS)}; wait 400; expect setpoint 0; expect text 0;
        {tap(MINUS)}; wait 400; expect setpoint 0; expect text 0; layout off.json;
        mode grind; wait 2500; expect text 0:06; {tap(MINUS)}; wait 400; expect grind-duration 5; expect text 0:05;
        {tap(MINUS)}; wait 400; expect grind-duration 5;
        {tap(SEG_WEIGHT)}; wait 500; expect text 5.5; {tap(MINUS)}; wait 400; expect grind-weight 50; expect text 5.0;
        {tap(MINUS)}; wait 400; expect grind-weight 50; expect text 5.0; expect temperature 93; quit
    """)
    if ok:
        off = sim.layout("off.json")
        checks.equal(off.ring["notch"][0], -1, "Water with its target at 0°: no notch, the boiler is off")


def exceptions():
    """The exception slot at 12 o'clock, and the machine leaving for Standby when the controller goes."""
    sim = Sim("modes-exceptions")
    ok = run(sim, f"""
        wait 3500; mode brew; wait 1500; mode water; wait 2500; expect screen water; layout warning.json; shot warning.bmp;
        {tap(PILL)}; wait 800; expect active 1; layout running.json; {tap(SLOT)}; wait 600; expect screen water; expect active 1;
        {tap(PILL)}; wait 800; expect active 0; layout stopped.json;
        {tap(SLOT)}; wait 800; expect screen warnings; expect mode 3;
        mode steam; wait 2500; expect screen steam; controller disconnected; wait 1500; expect screen standby; expect mode 0; quit
    """)
    if ok:
        warning = sim.layout("warning.json")
        glyph = control_at(warning, SLOT)
        checks.true(glyph is not None, "Water after Brew: the warning glyph is in the slot at 12 o'clock")
        inside = [o for o in warning.objects if o["kind"] == "img" and glyph and o["parent"] == glyph["id"]]
        checks.color(inside and inside[0]["color"], WARNING, "The warning glyph is drawn in warning")
        checks.equal(controls(sim.layout("running.json")), {"pill"}, "Water, running: the exception slot is empty")
        checks.true(control_at(sim.layout("stopped.json"), SLOT) is not None, "Water, stopped: the warning glyph is back")
        sim.save("warning.bmp", f"{OUT}/water-warning.png")


def changes():
    """Every change between the modes, with a scale so Grind is at its fullest, and the Light theme."""
    sim = Sim("modes-changes")
    ok = run(sim, f"""
        scale 1; wait 3500; mode brew; wait 3000; redraw to-brew.frames;
        mode steam; wait 2500; expect screen steam; redraw brew-steam.frames;
        mode water; wait 2500; expect screen water; redraw steam-water.frames;
        mode grind; wait 2500; expect screen grind; redraw water-grind.frames;
        mode steam; wait 2500; redraw grind-steam.frames;
        mode grind; wait 2500; redraw steam-grind.frames;
        mode brew; wait 2500; expect screen brew; redraw grind-brew.frames;
        mode water; wait 2500; redraw brew-water.frames;
        mode standby; wait 2500; expect screen standby; redraw water-standby.frames;
        mode grind; wait 2500; theme 1; wait 800; expect screen grind; layout light.json; shot grind-light.bmp;
        mode steam; wait 2500; shot steam-light.bmp; quit
    """)
    if ok:
        pairs = ("brew-steam", "steam-water", "water-grind", "grind-steam", "steam-grind", "grind-brew", "brew-water", "water-standby")
        worst = {pair: step(sim, f"{pair}.frames", " to ".join(mode.capitalize() for mode in pair.split("-")), record=False) for pair in pairs}
        measured["changes between Brew, Steam, Water, Grind and Standby"] = (max(worst.values()), 25.0)
        notes.append("largest frame of each change: " + ", ".join(f"{pair} {share:.1f}%" for pair, share in worst.items()))
        light = sim.layout("light.json")
        checks.color(light.objects[0]["fill"], "#e9e9e9", "Light: the face is surface-0")
        checks.color(light.find("START") and light.find("START")["fill"], "#0f20ec", "Light: START is primary")
        checks.color(light.find("TIME") and light.find("TIME")["fill"], "#111111", "Light: the chosen segment is ink")
        sim.save("grind-light.bmp", f"{OUT}/grind-light.png")
        sim.save("steam-light.bmp", f"{OUT}/steam-light.png")


def steam_ready():
    """Ten minutes on: the controller's safety limit ends the steam process and the boiler stays hot."""
    sim = Sim("modes-steam-ready")
    ok = run(sim, """
        wait 3500; mode steam; wait 60000; expect active 1; expect text Steaming;
        wait 590000; expect mode 2; expect active 0; expect text Ready; expect hidden Steaming; expect hidden Heating;
        expect text 145°; shot ready.bmp; layout ready.json; quit
    """, timeout=720)
    if ok:
        ready = sim.layout("ready.json")
        frame(ready, "steam", "STEAM", "TARGET °C", "Steam, ready")
        checks.equal(controls(ready), {"minus", "plus", "handle"}, "Steam, ready: minus, plus and the handle")
        live = live_value(ready, "Steam, ready", r"145°")
        checks.color(brightest(sim, "ready.bmp", live), INK, "Steam, ready: the live temperature is ink")
        sim.save("ready.bmp", f"{OUT}/steam-ready.png")


CASES = {"steam": steam, "steam-edits": steam_edits, "water": water, "grind-time": grind_by_time, "grind-scale": grind_with_scale,
         "limits": limits, "exceptions": exceptions, "changes": changes}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--slow", action="store_true", help="also wait ten minutes for Steam's safety limit")
    parser.add_argument("--only", nargs="+", choices=[*CASES, "steam-ready"], help="run these cases only")
    args = parser.parse_args()
    for name, case in CASES.items():
        if not args.only or name in args.only:
            case()
    if args.slow or (args.only and "steam-ready" in args.only):
        steam_ready()
    for what, (share, limit) in measured.items():
        print(f"  largest frame, {what}: {share:.1f}% (limit {limit:g}%)")
    for note in notes:
        print(f"  {note}")
    checks.finish()
