#!/usr/bin/env python3
"""Checks the Shot screen: a shot in progress and its result, a flush, and what each frame repaints.

    pio run -e display-sim && SIM_PORT_BASE=8210 python3 scripts/verify_display_shot.py

Every case drives a real shot in the simulator: it seeds a profile, taps START and reads what is on the glass
(`layout`), what the stage bars look like (the pixels of a `shot`) and what each frame repainted (`redraw`). The
simulator runs in real time and its boiler needs 45 s to come within 2 degrees of a 93 degree profile, so the
suite takes about five minutes. Cases that do not look at the boiler brew at 23 degrees and start at once.
"""

import json
import os
import re
import struct

from display_sim import SHOT_SHIFT, Checks, Sim, same_color

os.environ.setdefault("SIM_PORT_BASE", "8210")

OUT = "docs/display/v2/shot"
# Display black, the default theme, and Light.
INK, ON_INK, MUTED, HEAT_TEXT, PRIMARY, ON_PRIMARY = "#f2f2f2", "#000000", "#a6a6a6", "#ff9a70", "#5361ff", "#ffffff"
LIGHT_INK, LIGHT_ON_INK, LIGHT_MUTED = "#111111", "#ffffff", "#555555"
# design/reference/components/bundle.js, screens.shot
LABEL_BASELINE, TIMER_BASELINE, VALUE_BASELINE, CAPTION_BASELINE = 94, 206, 296, 324
LEFT, CENTRE, RIGHT = 172, 240, 308
BARS = {"x": 130, "y": 228, "width": 220, "height": 8, "gap": 6}
PILL = {"x1": 156, "y1": 344, "x2": 323, "y2": 407}
# Distance from the top of a line to its baseline in the hero and value faces.
HERO_ASCENT, VALUE_ASCENT = 83, 43
# Percent of the panel: less than any one cell of the timer, more than the label.
ONE_HERO_DIGIT = 2.4
TICKS_HALF, TICKS_FULL, MAX_TEMPERATURE, MAX_PRESSURE = 36, 76, 160.0, 16.0
PRESSURE = (r"\d+\.\d", "BAR")

checks = Checks("display shot")
measured = {}


# ---- seeding -----------------------------------------------------------------------------------------------


def phase(name, seconds, pressure=None, kind="brew", valve=1, ramp=0, weight=0):
    """One profile phase: a pressure target in bar, or full pump power when there is none."""
    return {
        "name": name,
        "phase": kind,
        "valve": valve,
        "duration": seconds,
        "temperature": 0,
        "transition": {"type": "linear" if ramp else "instant", "target": "time", "duration": ramp, "adaptive": False},
        "pump": 100 if pressure is None else {"target": "pressure", "pressure": pressure, "flow": 0},
        "targets": [{"type": "volumetric", "operator": "gte", "value": weight}] if weight else [],
    }


def profile(label, phases, temperature=93, dose=0):
    data = {"id": "seeded", "label": label, "type": "pro", "description": "", "temperature": temperature,
            "favorite": True, "selected": True, "utility": False, "phases": phases}
    if dose:
        data["dose"] = dose
    return data


def seeded(name, recipe=None, **settings):
    """A simulator whose state holds one selected profile and the given settings (keys of Settings.h)."""
    sim = Sim(name)
    nvs = {"ws": "GaggiMate-Sim", "wp": "simulator"}
    if recipe is not None:
        folder = sim.dir / "sim_data" / "littlefs" / "p"
        folder.mkdir(parents=True)
        (folder / "seeded.json").write_text(json.dumps(recipe))
        nvs.update(sp="seeded", fp="seeded")
    nvs.update({key: str(value) for key, value in settings.items()})
    (sim.dir / "sim_data" / "nvs").mkdir(parents=True, exist_ok=True)
    (sim.dir / "sim_data" / "nvs" / "controller.json").write_text(json.dumps(nvs))
    return sim


# ---- reading what is on the glass --------------------------------------------------------------------------


def centre(obj):
    """Centre x of a reading's glyphs or of a label's text."""
    return (obj.get("tx1", obj["x1"]) + obj.get("tx2", obj["x2"]) + 1) / 2


def top_label(page):
    return next((o for o in page.objects if o["kind"] == "label" and o.get("baseline") == LABEL_BASELINE), None)


def timer(page):
    return next((o for o in page.objects if o["kind"] == "reading" and o["y1"] + HERO_ASCENT == TIMER_BASELINE), None)


def values(page):
    """The second rank, left to right, as [(centre x, value, caption, the caption's object)]."""
    captions = [o for o in page.objects if o["kind"] == "label" and o.get("baseline") == CAPTION_BASELINE]
    found = []
    for o in page.objects:
        if o["kind"] != "reading" or o["y1"] + VALUE_ASCENT != VALUE_BASELINE:
            continue
        caption = next((c for c in captions if abs(centre(c) - centre(o)) <= 2), None)
        found.append((round(centre(o)), o["text"], caption["text"] if caption else None, caption))
    return sorted(found, key=lambda value: value[0])


def notch(value, top, ticks=TICKS_HALF):
    return round(value / top * (ticks - 1))


def face(page, what, label, tone=MUTED, time=None, second=(), pill="STOP", ring="split"):
    """One state of the screen against the design: where everything sits, what it says and in which tone."""
    checks.equal(page.screen, "shot", f"{what}: the Shot screen is on the glass")
    checks.equal(page.ring["layout"], ring, f"{what}: the ring")
    checks.equal(page.ring["tone"][0], "heat", f"{what}: the ring's first arc is temperature")
    checks.true(page.ring["notch"][0] >= 0, f"{what}: the temperature arc carries its notch")
    top = top_label(page)
    text = top["text"] if top else None
    matches = top is not None and (label.fullmatch(text) if hasattr(label, "fullmatch") else text == label)
    wanted = getattr(label, "pattern", label)
    checks.true(matches, f"{what}: the label on baseline {LABEL_BASELINE} reads {wanted!r}, got {text!r}")
    checks.color(top and top.get("color"), tone, f"{what}: the label's tone")
    checks.true(top is not None and abs(centre(top) - CENTRE) <= 1, f"{what}: the label is centred")
    clock = timer(page)
    checks.true(clock is not None and abs(centre(clock) - CENTRE) <= 1,
                f"{what}: the timer is the hero reading, centred on baseline {TIMER_BASELINE}")
    if time is not None:
        checks.equal(clock and clock["text"], time, f"{what}: the timer")
    shown = values(page)
    checks.equal(len(shown), len(second), f"{what}: values in the second rank ({[v[:3] for v in shown]})")
    for (cx, value, caption, obj), (want_x, (want_value, want_caption)) in zip(shown, second):
        checks.true(abs(cx - want_x) <= 1, f"{what}: the value {value!r} is centred on x {want_x}, got {cx}")
        checks.true(re.fullmatch(want_value, value) is not None,
                    f"{what}: the value at x {want_x} matches {want_value!r}, got {value!r}")
        checks.equal(caption, want_caption, f"{what}: the caption under {value!r}")
        checks.color(obj and obj.get("color"), LIGHT_MUTED if tone == LIGHT_MUTED else MUTED,
                     f"{what}: the caption {caption!r} is muted")
    button = page.find(pill)
    checks.true(button is not None and all(button[k] == PILL[k] for k in PILL), f"{what}: the {pill} pill is 168 x 64 at y 344")
    checks.equal([o.get("text") for o in page.clickable()], [pill],
                 f"{what}: {pill} is the only control (no handle, no exception slot)")
    return button or {}


# ---- the stage bars, read off a screenshot -----------------------------------------------------------------


def bitmap(path):
    """Pixel reader for the simulator's 24-bit BMP: at(x, y) -> (red, green, blue), x and y in the design's box."""
    data = path.read_bytes()
    (offset,) = struct.unpack_from("<I", data, 10)
    width, height = struct.unpack_from("<ii", data, 18)
    (depth,) = struct.unpack_from("<H", data, 28)
    assert depth == 24, f"{path}: expected a 24-bit bitmap"
    stride = (width * 3 + 3) & ~3

    def at(x, y):
        x, y = x + SHOT_SHIFT, y + SHOT_SHIFT
        base = offset + ((height - 1 - y) if height > 0 else y) * stride + x * 3
        blue, green, red = data[base:base + 3]
        return red, green, blue

    return at


def stage_bars(sim, bmp):
    """The bars as [(left, width, filled)] in pixels from the row's left edge, read along its centre line."""
    at = bitmap(sim.dir / bmp)
    y = BARS["y"] + BARS["height"] // 2
    row = range(BARS["x"], BARS["x"] + BARS["width"])
    kinds = []
    for x in row:
        light = sum(at(x, y)) // 3
        kinds.append("ink" if light > 150 else "track" if light > 25 else None)
    found, x = [], 0
    while x < len(kinds):
        if kinds[x] is None:
            x += 1
            continue
        start = x
        while x < len(kinds) and kinds[x] is not None:
            x += 1
        found.append((start, x - start, kinds[start:x].count("ink")))
    # A bar is 8 px tall: the rows just above and below it are the face.
    clean = all(sum(at(x, BARS["y"] - 2)) < 30 and sum(at(x, BARS["y"] + BARS["height"] + 1)) < 30 for x in row)
    return found, clean


def planned_bars(seconds):
    """Where the design puts the bars: each as wide as its share of the plan, 6 px apart, none shorter than a dot."""
    room = BARS["width"] - BARS["gap"] * (len(seconds) - 1)
    dots = set()
    while True:
        total = sum(s for i, s in enumerate(seconds) if i not in dots)
        free = room - BARS["height"] * len(dots)
        short = next((i for i, s in enumerate(seconds) if i not in dots and free * s / total < BARS["height"]), None)
        if short is None:
            break
        dots.add(short)
    out, at = [], 0.0
    for i, s in enumerate(seconds):
        wide = BARS["height"] if i in dots else free * s / total
        out.append((round(at), round(at + wide) - round(at)))
        at += wide + BARS["gap"]
    return out


def bars(sim, bmp, what, seconds, done, running=None):
    """`done` phases are full, the next is `running` (lowest, highest fraction) of the way and the rest are empty."""
    found, clean = stage_bars(sim, bmp)
    plan = planned_bars(seconds)
    checks.equal(len(found), len(plan), f"{what}: one stage bar per phase")
    checks.true(clean, f"{what}: the bars are 8 px tall")
    if len(found) != len(plan):
        return
    checks.true(all(abs(f[0] - p[0]) <= 1 and abs(f[1] - p[1]) <= 1 for f, p in zip(found, plan)),
                f"{what}: each bar is as wide as its phase's share of the plan: expected {plan}, got {[f[:2] for f in found]}")
    for i, (left, width, filled) in enumerate(found):
        if i < done:
            checks.equal(filled, width, f"{what}: the bar of a phase that has run is full ({i + 1})")
        elif i == done and running is not None:
            low, high = (max(BARS["height"], fraction * width + slack) for fraction, slack in zip(running, (-2, 2)))
            checks.true(low <= filled <= high, f"{what}: the running phase's bar is {running} filled, got {filled} of {width} px")
        else:
            checks.equal(filled, 0, f"{what}: the bar of a phase still to come is empty ({i + 1})")


def budget(sim, name, limit, what, key):
    """No frame of a `redraw` log repaints more than `limit` percent of the panel."""
    frames = sim.redraw(name)
    worst = max(frames) if frames else 0.0
    measured[key] = max(measured.get(key, 0.0), worst)
    checks.at_most(worst, limit, f"{what} repaints at most {limit:g}% of the panel in any frame")
    return frames


# ---- 1. The design's three figures: preinfusion, pulling by weight, finished --------------------------------
# The brew valve stays closed in this profile, so the simulated cup holds exactly what the script puts in it.

PLAN = [6, 9, 15]
sim = seeded("shot-design", profile("Classic", [
    phase("Preinfuse", PLAN[0], 3, kind="preinfusion", valve=0),
    phase("Bloom", PLAN[1], 3, valve=0),
    phase("Ramp to 9 bar", PLAN[2], 9, valve=0, ramp=2, weight=36),
], dose=18))
sim.run(
    "wait 3500; mode brew; scale 1; weight 0; wait 46000; expect screen brew; expect text START; layout brew.json;"
    # The shot starts about 330 ms after the finger goes down: 120 ms of tap, then the scale's tare.
    "redraw boot.json; tap 240 372; wait 700; expect screen shot; expect active 1; redraw settle.json;"
    "wait 3400; weight 0.8; wait 500; layout pre.json; shot pre.bmp;"
    "wait 15600; weight 21.7; wait 450; layout pull.json; shot pull.bmp;"
    "wait 8850; redraw run.json; weight 36.4; wait 800; expect active 0; redraw finish.json;"
    "layout calibrating.json; shot calibrating.bmp;"
    "wait 4000; expect text SHOT COMPLETE; redraw complete.json; layout done.json; shot done.bmp;"
    "wait 2500; expect screen shot; layout stay.json;"
    "tap 240 376; wait 1500; expect screen brew; expect active 0; expect text START; redraw back.json; layout brew2.json; quit"
)
checks.count(sim)
brew = sim.layout("brew.json")
pre = sim.layout("pre.json")
stop = face(pre, "preinfusion", "PREINFUSE", time="0:04", second=[(LEFT, PRESSURE), (RIGHT, (r"0\.8", "/ 36 G"))])
checks.color(stop.get("fill"), INK, "preinfusion: STOP is ink")
checks.color(stop.get("color"), ON_INK, "preinfusion: STOP is lettered in on-ink")
checks.equal(pre.ring["tone"][1], "primary", "preinfusion: pressure is the second arc, in primary")
checks.equal(pre.ring["notch"][1], notch(3, MAX_PRESSURE), "preinfusion: the pressure notch is the phase's 3 bar")
checks.equal(pre.ring["notch"][0], notch(93, MAX_TEMPERATURE), "preinfusion: the temperature notch is the shot's 93 degrees")
checks.equal((brew.ring["layout"], brew.ring["notch"][0], brew.ring["tone"][0]),
             ("split", pre.ring["notch"][0], pre.ring["tone"][0]),
             "the shot starts on Brew's ring: same layout, same temperature arc")
checks.true(abs(float(values(pre)[0][1]) - 3.0) <= 0.3, f"preinfusion: pressure reads about its 3 bar, got {values(pre)[0][1]}")
bars(sim, "pre.bmp", "preinfusion", PLAN, done=0, running=(0.62, 0.86))

pull = sim.layout("pull.json")
face(pull, "pulling by weight", "RAMP TO 9 BAR", time="0:20", second=[(LEFT, PRESSURE), (RIGHT, (r"21\.7", "/ 36 G"))])
checks.equal(pull.ring["notch"][1], notch(9, MAX_PRESSURE), "pulling: the pressure notch followed the phase to 9 bar")
checks.true(abs(float(values(pull)[0][1]) - 9.0) <= 0.2, f"pulling: pressure reads about 9 bar, got {values(pull)[0][1]}")
checks.true(abs(pull.ring["lit"][1] - round(9 / MAX_PRESSURE * TICKS_HALF)) <= 1, "pulling: the pressure ticks show 9 of 16 bar")
# A phase that ends by weight fills its bar by weight: 21.7 of 36 g.
bars(sim, "pull.bmp", "pulling", PLAN, done=2, running=(0.55, 0.65))

calibrating = sim.layout("calibrating.json")
done = sim.layout("done.json")
for page, what, label in ((calibrating, "calibrating", "CALIBRATING"), (done, "finished", "SHOT COMPLETE")):
    result = [(LEFT, (r"36\.4", "GRAMS")), (RIGHT, (r"1:2\.0", "RATIO"))]
    button = face(page, what, label, time="0:29", second=result, pill="DONE")
    checks.color(button.get("fill"), PRIMARY, f"{what}: DONE is primary")
    checks.color(button.get("color"), ON_PRIMARY, f"{what}: DONE is lettered in on-primary")
    checks.equal(page.ring["notch"][1], -1, f"{what}: the pressure notch is gone with the phase")
checks.true(calibrating.ring["lit"][1] < pull.ring["lit"][1], "the pressure ticks walk down when the pump stops")
checks.equal(done.ring["lit"][1], 0, "finished: no pressure tick stays lit")
bars(sim, "done.bmp", "finished", PLAN, done=3)
stay = sim.layout("stay.json")
checks.equal((stay.screen, timer(stay)["text"], top_label(stay)["text"]), ("shot", "0:29", "SHOT COMPLETE"),
             "the result stays, its timer frozen, until it is acknowledged")
back = sim.layout("brew2.json")
checks.equal((back.screen, back.ring["layout"]), ("brew", "split"), "DONE returns to Brew on the same ring")
checks.true(back.find("DONE") is None and timer(back) is None and not values(back), "nothing of the shot is left on Brew")

budget(sim, "settle.json", 25.0, "brew:start, the settle", "settle")
budget(sim, "run.json", 8.0, "a running shot (by weight, three phases)", "running")
finish = budget(sim, "finish.json", 25.0, "the finish", "finish")
# After the three frames of the finish only the ring moves. Down the right side a tick's box is 450 to 600 px,
# so two ticks and the last pixels of the stage bars stay under 0.58% of the panel, and three do not.
walk = finish[finish.index(max(finish)) + 3:]
measured["ring walk after the finish"] = max(walk)
checks.true(len([f for f in walk if f > 0.05]) >= 5 and max(walk) <= 0.58,
            f"the pressure ticks walk down two a frame: {' '.join(f'{f:.2f}' for f in walk)}")
budget(sim, "complete.json", 8.0, "CALIBRATING to SHOT COMPLETE", "calibrating to complete")
budget(sim, "back.json", 25.0, "DONE, the return to Brew", "return to Brew")
sim.save("pre.bmp", f"{OUT}/preinfusion.png")
sim.save("pull.bmp", f"{OUT}/pulling.png")
sim.save("calibrating.bmp", f"{OUT}/calibrating.png")
sim.save("done.bmp", f"{OUT}/complete.png")

# ---- 2. A shot by time on a boiler that is still heating: the label, the timer's cadence, the result --------
# The stock default profile: one 28 s phase at full pump power, so there is no pressure target and no notch.

sim = seeded("shot-time")
sim.run(
    "wait 3500; mode brew; wait 30000; expect screen brew; redraw boot.json;"
    "tap 240 366; wait 600; expect screen shot; expect active 1; redraw settle.json; layout stray.json; shot stray.bmp;"
    "wait 16800; layout run.json; shot run.bmp; redraw run.json2;"
    "wait 8000; redraw quiet.json;"
    "wait 3600; expect active 0; redraw finish.json; layout done.json; shot done.bmp;"
    "wait 2000; expect screen shot; expect text DONE;"
    "tap 240 376; wait 1500; expect screen brew; expect active 0; quit"
)
checks.count(sim)
stray = sim.layout("stray.json")
face(stray, "boiler off target", re.compile(r"TEMPERATURE 8\d°"), tone=HEAT_TEXT, time="0:00",
     second=[(LEFT, PRESSURE), (RIGHT, (r"8\d", "°C"))])
checks.equal(top_label(stray)["text"], f"TEMPERATURE {values(stray)[1][1]}°",
             "the label and the value show the same temperature")
checks.equal(stray.ring["notch"][1], -1, "a phase that sets pump power has no pressure notch")
run = sim.layout("run.json")
face(run, "by time", "BREW", time="0:17", second=[(LEFT, PRESSURE), (RIGHT, (r"9[1-3]", "°C"))])
bars(sim, "run.bmp", "by time", [28], done=0, running=(0.57, 0.67))
done = sim.layout("done.json")
face(done, "finished by time", "SHOT COMPLETE", time="0:28", second=[], pill="DONE")
checks.true(done.find("BAR") is None, "finished: pressure is a number only while the shot is brewing")
bars(sim, "done.bmp", "finished by time", [28], done=1)
budget(sim, "settle.json", 25.0, "brew:start without a scale, the settle", "settle")
budget(sim, "run.json2", 8.0, "a running shot (by time, the boiler recovering)", "running")
budget(sim, "finish.json", 25.0, "the finish by time", "finish")
# Eight seconds at steady pressure and temperature: only the timer and the stage bar change.
quiet = budget(sim, "quiet.json", 8.0, "the timer's digit snap", "running")
flips = [f for f in quiet if f >= ONE_HERO_DIGIT]
steps = [f for f in quiet if 0 < f <= 0.05]
checks.true(7 <= len(flips) <= 9, f"the timer repaints once a second, never per frame: {len(flips)} digit repaints in 8 s")
checks.true(len(steps) >= 40, f"the stage bar grows a pixel at a time: {len(steps)} repaints of a few columns in 8 s")
measured["stage advance"] = max((f for f in quiet if f < ONE_HERO_DIGIT), default=0.0)
checks.at_most(measured["stage advance"], 1.0, "stage advance: under 1% a frame")
sim.save("stray.bmp", f"{OUT}/temperature.png")
sim.save("run.bmp", f"{OUT}/by-time.png")
sim.save("done.bmp", f"{OUT}/complete-by-time.png")

# ---- 3. No pressure sensor: temperature keeps the whole ring, and one value sits on the centre line --------
# Then, with the sensor back: Light is a setting, and STOP ends a shot.

PLAN = [3, 5]
GRAMS = (r"\d+\.\d", "GRAMS")
sim = seeded("shot-single", profile("Decline", [phase("Preinfuse", PLAN[0], 3, kind="preinfusion"),
                                                phase("Pressure decline to 6 bar", PLAN[1], 6)]))
sim.run(
    "wait 3500; mode brew; pressure-sensor 0; scale 1; weight 0; wait 46000; expect screen brew;"
    "tap 240 372; wait 1500; layout first.json; wait 3000; expect screen shot; layout run.json; shot run.bmp;"
    "wait 5000; expect active 0; layout done.json; shot done.bmp;"
    "tap 240 376; wait 1500; expect screen brew; pressure-sensor 1; wait 1500;"
    "tap 240 372; wait 1200; expect screen shot; theme 1; wait 700; expect screen shot; expect active 1;"
    "layout light.json; shot light.bmp; press 240 376; wait 130; layout pressed.json; release;"
    "wait 1200; expect screen brew; expect active 0; quit"
)
checks.count(sim)
first = sim.layout("first.json")
face(first, "no pressure sensor", "PREINFUSE", second=[(CENTRE, GRAMS)], ring="single")
run = sim.layout("run.json")
face(run, "a long phase name", "PRESSURE DECL...", second=[(CENTRE, GRAMS)], ring="single")
checks.true(float(values(run)[0][1]) > float(values(first)[0][1]),
            "with a scale and no target the cup's weight counts up over GRAMS")
checks.equal(run.ring["notch"][0], notch(93, MAX_TEMPERATURE, TICKS_FULL), "the single ring carries the temperature notch")
checks.true(run.find("BAR") is None, "without a pressure sensor there is no pressure value")
bars(sim, "run.bmp", "two phases", PLAN, done=1, running=(0.05, 0.6))
done = sim.layout("done.json")
face(done, "finished without a dose", "SHOT COMPLETE", time="0:08", second=[(CENTRE, GRAMS)], pill="DONE", ring="single")
checks.true(done.find("RATIO") is None, "a profile without a dose shows no ratio")
light = sim.layout("light.json")
stop = face(light, "light theme", "PREINFUSE", tone=LIGHT_MUTED, second=[(LEFT, PRESSURE), (RIGHT, GRAMS)])
checks.color(stop.get("fill"), LIGHT_INK, "light theme: STOP is ink")
checks.color(stop.get("color"), LIGHT_ON_INK, "light theme: STOP is lettered in on-ink")
pressed = sim.layout("pressed.json").find("STOP")
checks.true(pressed is not None and not same_color(pressed.get("fill"), LIGHT_INK), "a pressed STOP inverts before it acts")
sim.save("run.bmp", f"{OUT}/single-ring.png")
sim.save("done.bmp", f"{OUT}/complete-single-ring.png")
sim.save("light.bmp", f"{OUT}/light.png")

# ---- 4. A real shot by weight, the cup filling: the busiest the screen gets --------------------------------

PLAN = [4, 9]
OF_TARGET = (r"\d+\.\d", "/ 36 G")
sim = seeded("shot-flow", profile("Flow", [phase("Preinfuse", PLAN[0], 3, kind="preinfusion"),
                                           phase("Ramp to 9 bar", PLAN[1], 9, ramp=3, weight=36)], temperature=23))
sim.run(
    "wait 3500; mode brew; scale 1; weight 0; wait 3000; expect screen brew; redraw boot.json;"
    "tap 240 372; wait 700; expect screen shot; redraw settle.json; wait 1500; layout early.json;"
    "wait 9500; layout late.json; wait 500; redraw run.json;"
    "wait 1900; expect active 0; redraw finish.json; layout calibrating.json; wait 4300; layout done.json; quit"
)
checks.count(sim)
early, late = sim.layout("early.json"), sim.layout("late.json")
face(early, "filling, early", "PREINFUSE", second=[(LEFT, PRESSURE), (RIGHT, OF_TARGET)])
face(late, "filling, late", "RAMP TO 9 BAR", time="0:11", second=[(LEFT, PRESSURE), (RIGHT, OF_TARGET)])
checks.true(float(values(late)[1][1]) > float(values(early)[1][1]) > 0, "the weight counts up toward its target")
budget(sim, "settle.json", 25.0, "brew:start with the scale line on Brew, the settle", "settle")
budget(sim, "run.json", 8.0, "a running shot (cup filling, pressure ramping)", "running")
budget(sim, "finish.json", 25.0, "the finish by weight", "finish")
face(sim.layout("calibrating.json"), "weighing the last drops", "CALIBRATING", time="0:13", second=[(CENTRE, GRAMS)], pill="DONE")
face(sim.layout("done.json"), "finished, no dose", "SHOT COMPLETE", time="0:13", second=[(CENTRE, GRAMS)], pill="DONE")

# ---- 5. Without delay adjustment the result is complete the moment the pump stops ---------------------------
# A swipe up asks for the mode menu, as on Brew: nothing happens while the pump runs, and the result gives way.

QUICK = profile("Quick", [phase("Brew", 8, 9, valve=0, weight=10)], temperature=23, dose=5)
sim = seeded("shot-no-calibration", QUICK, del_ad=0)
sim.run(
    "wait 3500; mode brew; scale 1; weight 0; wait 3000; tap 240 372; wait 1500; swipe 240 300 240 120; wait 400;"
    "expect screen shot; expect active 1; wait 300; weight 10.5;"
    "wait 700; expect active 0; expect screen shot; expect text SHOT COMPLETE; expect hidden CALIBRATING; layout done.json;"
    "swipe 240 300 240 120; wait 800; expect screen menu; expect active 0; quit"
)
checks.count(sim)
face(sim.layout("done.json"), "finished, no calibration", "SHOT COMPLETE", time="0:02",
     second=[(LEFT, (r"10\.5", "GRAMS")), (RIGHT, (r"1:2\.1", "RATIO"))], pill="DONE")

# ---- 6. A flush: the START pill held on Brew ---------------------------------------------------------------
# Flush duration 0 flushes for as long as the finger stays down, then drains for a second and leaves by itself.

BOILER = (r"\d+", "°C")
sim = seeded("shot-flush-held", fl_dur=0)
sim.run(
    "wait 3500; mode brew; scale 1; weight 0; wait 3000; expect screen brew; redraw boot.json;"
    "press 240 372; wait 1900; expect screen shot; expect active 1; redraw settle.json; layout flush.json; shot flush.bmp;"
    "wait 1200; expect text FLUSH; release; wait 450; expect screen shot; expect text DRAIN; layout drain.json;"
    "wait 1400; expect screen brew; expect active 0; expect text START; quit"
)
checks.count(sim)
# The boiler is cold and a scale is connected: a flush still names itself, and it is not weighed.
face(sim.layout("flush.json"), "flush", "FLUSH", time="0:01", second=[(LEFT, PRESSURE), (RIGHT, BOILER)])
bars(sim, "flush.bmp", "flush", [60, 1], done=0, running=(0.0, 0.1))
face(sim.layout("drain.json"), "drain", "DRAIN", second=[(LEFT, PRESSURE), (RIGHT, BOILER)])
budget(sim, "settle.json", 25.0, "a held flush, the settle", "settle")
sim.save("flush.bmp", f"{OUT}/flush.png")

# The default flush runs five seconds whether or not the finger stays; STOP ends it like a shot.
sim = seeded("shot-flush-timed")
sim.run(
    "wait 3500; mode brew; wait 3000; press 240 366; wait 1500; release; wait 500; expect screen shot; expect active 1;"
    "expect text FLUSH; layout flush.json; shot flush.bmp; tap 240 376; wait 1200; expect screen brew; expect active 0; quit"
)
checks.count(sim)
face(sim.layout("flush.json"), "timed flush", "FLUSH", time="0:01", second=[(LEFT, PRESSURE), (RIGHT, BOILER)])
bars(sim, "flush.bmp", "timed flush", [5, 1], done=0, running=(0.2, 0.5))

# ---- 7. Many phases: one bar each, for as many as the row holds --------------------------------------------
# 220 px hold sixteen 8 px dots with 6 px between them. Twelve phases are four bars and eight dots; sixteen are
# all but dots. (What a profile of more than sixteen phases should show is not decided: it shows its first sixteen.)

TWELVE = [3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1]
sim = seeded("shot-twelve", profile("Twelve", [phase(f"Stage {i + 1}", seconds, 6, valve=0) for i, seconds in enumerate(TWELVE)],
                                    temperature=23))
sim.run(
    "wait 3500; mode brew; wait 3000; expect screen brew; redraw boot.json; tap 240 372; wait 700; expect screen shot;"
    # The shot is about 0.1 s younger than the waits since the tap: 7.3 s here, then 16.5 s, half-way through a dot.
    "redraw settle.json; wait 6700; expect text STAGE 3; shot mid.bmp; wait 9200; redraw run.json;"
    "expect text STAGE 9; shot dots.bmp; wait 7500; expect active 0; expect text SHOT COMPLETE; shot done.bmp; quit"
)
checks.count(sim)
checks.equal(len(planned_bars(TWELVE)), 12, "twelve phases are planned as twelve bars")
bars(sim, "mid.bmp", "twelve phases, the third running", TWELVE, done=2, running=(0.3, 0.65))
bars(sim, "dots.bmp", "twelve phases, the ninth running", TWELVE, done=8, running=(0.0, 1.0))
bars(sim, "done.bmp", "twelve phases, finished", TWELVE, done=12)
budget(sim, "settle.json", 25.0, "brew:start with twelve stage bars, the settle", "settle")
budget(sim, "run.json", 8.0, "a running shot of twelve phases", "running")
sim.save("mid.bmp", f"{OUT}/twelve-phases.png")

SIXTEEN = [3, 3, 3] + [1] * 13
sim = seeded("shot-sixteen", profile("Sixteen", [phase(f"Stage {i + 1}", seconds, 6, valve=0) for i, seconds in enumerate(SIXTEEN)],
                                     temperature=23))
sim.run(
    "wait 3500; mode brew; wait 3000; expect screen brew; tap 240 372; wait 700; expect screen shot;"
    "wait 9900; expect text STAGE 5; shot mid.bmp; quit"
)
checks.count(sim)
bars(sim, "mid.bmp", "sixteen phases, the fifth running", SIXTEEN, done=4, running=(0.0, 1.0))
sim.save("mid.bmp", f"{OUT}/sixteen-phases.png")

print("largest frame, percent of the panel: " + ", ".join(f"{key} {value:.2f}" for key, value in measured.items()))
checks.finish()
