#!/usr/bin/env python3
"""Checks Profiles, Adjust and the save sheet: what is on the glass, what the machine took, what each frame repaints.

    pio run -e display-sim && SIM_PORT_BASE=8270 python3 scripts/verify_display_profiles.py

The simulator starts with one profile. Each case here seeds its own before the program starts (seed() below): one
JSON file a profile in sim_data/littlefs/p/<id>.json, the same object the web API saves, and in
sim_data/nvs/controller.json the selected id ("sp") and the favourite ids ("fp", comma separated). A running
simulator takes more over its web UI (http://localhost:$SIM_HTTP_PORT/) or the WebSocket messages
req:profiles:save and req:profiles:favorite (docs/websocket-api.yaml).

Captures go to docs/display/v2/profiles/. The whole run takes about six minutes.
"""

import json

from display_sim import Checks, Sim, same_color

checks = Checks("display profiles")
SHOTS = "docs/display/v2/profiles"

# Display black, as the layout dump reports it.
INK, ON_INK, MUTED, TRACK = "#f2f2f2", "#000000", "#a6a6a6", "#343434"
PRIMARY, ON_PRIMARY, SURFACE_1, SURFACE_2, WARNING = "#5361ff", "#ffffff", "#141414", "#232323", "#f5b400"
CIRCLE = 32767  # LV_RADIUS_CIRCLE

# ---- profiles ------------------------------------------------------------------------------------------------


def phase(name, kind, seconds, pump, valve=1, grams=None):
    """One phase as the profile JSON spells it. `pump` is a power in percent, or a pressure or flow target."""
    p = {"name": name, "phase": kind, "valve": valve, "duration": seconds, "pump": pump}
    if grams:
        p["targets"] = [{"type": "volumetric", "operator": "gte", "value": grams}]
    return p


def bar(pressure):
    return {"target": "pressure", "pressure": pressure, "flow": 0}


def profile(ident, label, temperature, phases, kind="standard"):
    return {"id": ident, "label": label, "type": kind, "description": "", "temperature": temperature, "phases": phases}


# One pump-power phase with a weight target: three facts, no stage list, and BAR without a pressure to show.
CLASSIC = profile("classic", "Classic", 93, [phase("Brew", "brew", 28, 100, grams=36)])
# The design's figure: three stages, a pressure target, three facts.
ADAPTIVE = profile(
    "adaptive",
    "Adaptive v2",
    93,
    [
        phase("Preinfuse", "preinfusion", 6, bar(3)),
        phase("Bloom", "preinfusion", 5, 0, valve=0),
        phase("Ramp", "brew", 18, bar(9), grams=36),
    ],
    "pro",
)
# A name and a stage list too long for their lines, stopped by time: two facts.
LONG = profile(
    "long",
    "Blooming espresso for light roasts",
    96,
    [
        phase("Preinfusion with a slow fill", "preinfusion", 8, 30),
        phase("Bloom and rest", "preinfusion", 12, 0, valve=0),
        phase("Declining pressure extraction", "brew", 22.5, bar(8.5)),
    ],
    "pro",
)
# One timed phase on a flow target: nothing for BAR to edit, so Adjust offers two values.
TURBO = profile("turbo", "Turbo", 91, [phase("Brew", "brew", 15, {"target": "flow", "pressure": 0, "flow": 4})])
LUNGO = profile("lungo", "Lungo", 94, [phase("Brew", "brew", 40, 100, grams=110.5)])
FIVE = [CLASSIC, ADAPTIVE, LONG, TURBO, LUNGO]
NINE = FIVE + [
    profile("ristretto", "Ristretto", 92, [phase("Brew", "brew", 20, bar(9), grams=22)]),
    profile("filter", "Filter", 95, [phase("Brew", "brew", 60, bar(2), grams=180)]),
    profile("lever", "Lever", 90, [phase("Brew", "brew", 30, bar(8), grams=40)]),
    profile("allonge", "Allongé", 97, [phase("Brew", "brew", 35, bar(6), grams=120)]),
]


def seed(sim, profiles, **settings):
    """Puts favourite profiles and settings where the simulator keeps its flash, before it starts."""
    folder = sim.dir / "sim_data" / "littlefs" / "p"
    folder.mkdir(parents=True)
    for p in profiles:
        (folder / f"{p['id']}.json").write_text(json.dumps(p))
    nvs = sim.dir / "sim_data" / "nvs"
    nvs.mkdir(parents=True)
    # The first profile is the one in use. The flush reminder is off unless a case wants the warning glyph.
    values = {"sp": profiles[0]["id"], "fp": ",".join(p["id"] for p in profiles), "wl_flush": "0"}
    values.update(settings)
    (nvs / "controller.json").write_text(json.dumps(values))


def stored(sim, ident):
    """A profile as the simulator left it on its flash."""
    return json.loads((sim.dir / "sim_data" / "littlefs" / "p" / f"{ident}.json").read_text())


def settings_of(sim):
    return json.loads((sim.dir / "sim_data" / "nvs" / "controller.json").read_text())


# ---- script fragments ----------------------------------------------------------------------------------------

BOOT = "wait 3500; mode brew; wait 3000; expect screen brew;"
BOOT_WITH_SCALE = "wait 3500; scale 1; mode brew; wait 3000; expect screen brew;"
OPEN = "tap 240 291; wait 1200; expect screen profiles;"  # the profile name on Brew
NEXT, PREVIOUS = "tap 424 240; wait 500;", "tap 56 240; wait 500;"
SWIPE_NEXT, SWIPE_PREVIOUS = "swipe 330 150 130 150; wait 500;", "swipe 130 150 330 150; wait 500;"
SWIPE_DOWN = "swipe 240 40 240 200; wait 1200;"
SELECT = "tap 206 372; wait 1500; expect screen brew;"
PENCIL = "tap 322 372; wait 1200; expect screen adjust;"
PLUS, MINUS = "tap 398 250; wait 500;", "tap 82 250; wait 500;"
TEMP, BAR, TARGET = "tap 161 134; wait 600;", "tap 239 134; wait 600;", "tap 317 134; wait 600;"  # the row of three
SECOND_OF_TWO = "tap 299 134; wait 600;"
UNIT_LINE = "tap 240 311; wait 600;"  # "G · USE TIME"
ACTION = "tap 240 376; wait 1200;"  # the pill on Adjust: DONE or SAVE
SHEET = ACTION + "expect screen sheet;"
SAVE, SAVE_AS_NEW, USE_ONCE = "tap 240 190; wait 1500;", "tap 240 266; wait 1500;", "tap 240 344; wait 1500;"

ROW = ["TEMP", "BAR", "TIME"]
UNSAVED = "CLASSIC · UNSAVED"
CLASSIC_FACTS = ["93°", "36 G", "28 S"]
ADAPTIVE_FACTS = ["93°", "36 G", "29 S"]
ADAPTIVE_STAGES = "Preinfuse · Bloom · Ramp"

# ---- helpers -------------------------------------------------------------------------------------------------

largest = {}  # the largest frame of every measured change, for the summary


def budget(sim, name, what, limit=25.0):
    """design/reference/motion.md: at most a quarter of the panel in one step of a transition."""
    frames = sim.redraw(name)
    checks.true(len(frames) > 0, f"{what}: something was repainted")
    largest[what] = max(frames, default=0.0)
    checks.at_most(largest[what], limit, f"{what}: no frame repaints over {limit:g}% of the panel")
    return frames


def quiet(sim, name, what):
    checks.equal(sim.redraw(name), [], f"{what}: nothing is repainted")


def width(o):
    return o["x2"] - o["x1"] + 1


def height(o):
    return o["y2"] - o["y1"] + 1


def box(o):
    return (o["x1"], o["y1"], width(o), height(o))


def centre(o):
    return ((o["x1"] + o["x2"] + 1) // 2, (o["y1"] + o["y2"] + 1) // 2)


def text(page, value, baseline=None, color=None, what=None):
    """The object showing `value`, checked against the design's baseline and tone."""
    what = what or f"'{value}'"
    found = [o for o in page.objects if o.get("text") == value]
    checks.true(len(found) > 0, f"{what} is on the glass ({page.texts()})")
    if not found:
        return {}
    # BAR names a segment of the row and the unit under the reading: the baseline says which one is meant.
    o = next((o for o in found if o["baseline"] == baseline), found[0])
    if baseline is not None:
        checks.equal(o["baseline"], baseline, f"{what} sits on its baseline")
    if color is not None:
        checks.color(o["color"], color, f"{what} has its tone")
    return o


def discs(page, radius):
    """Pressable discs of a radius, left to right."""
    found = [o for o in page.objects if o["kind"] == "obj" and o["clickable"] and o["radius"] == CIRCLE]
    return sorted((o for o in found if width(o) == radius * 2), key=lambda o: o["x1"])


def cards(page):
    return sorted((o for o in page.objects if o["kind"] == "obj" and o["radius"] == 14), key=lambda o: o["x1"])


def facts(page):
    """The text of each fact card, left to right."""
    out = []
    for card in cards(page):
        out += [o["text"] for o in page.objects if o["parent"] == card["id"] and "text" in o]
    return out


def dots(page):
    found = [o for o in page.objects if o["kind"] == "obj" and not o["clickable"] and o["radius"] == CIRCLE]
    return sorted((o for o in found if width(o) == 10), key=lambda o: o["x1"])


def reading(page):
    """The numeral on the glass: the value between minus and plus on Adjust, the boiler on Brew."""
    return next((o["text"] for o in page.objects if o["kind"] == "reading"), None)


def no_ring(page, what):
    checks.equal(page.ring["layout"], "none", f"{what} draws no ring")


def check_page(page, index, count, name, fact_texts, stage_line, what):
    """One page of Profiles against screens.profiles of the design."""
    no_ring(page, what)
    if count > 1:
        text(page, f"PROFILE {index} / {count}", 86, MUTED)
    else:
        checks.true(not any(t.startswith("PROFILE") for t in page.texts()), f"{what}: a single profile is not counted")
    shown = text(page, name, 168, INK, f"{what}: the name")
    if shown:
        checks.equal(shown["font"], 53, f"{what}: the name is set in screen-value")
        checks.true(84 <= shown["tx1"] and shown["tx2"] <= 395, f"{what}: the name stays on its line")
    # Only the facts the recipe defines, 96 x 44 with 8 px between them, centred as a group.
    left = 240 - (len(fact_texts) * 104 - 8) // 2
    wanted = [(left + i * 104, 194, 96, 44) for i in range(len(fact_texts))]
    checks.equal(facts(page), fact_texts, f"{what}: the fact cards")
    checks.equal([box(c) for c in cards(page)], wanted, f"{what}: the cards are centred as a group")
    for card in cards(page):
        checks.color(card["fill"], SURFACE_1, f"{what}: a fact card is surface-1")
    for fact in fact_texts:
        text(page, fact, 223, INK)
    if stage_line:
        line = text(page, stage_line, 278, MUTED, f"{what}: the stage names")
        if line:
            checks.true(102 <= line["tx1"] and line["tx2"] <= 377, f"{what}: the stage names stay on their line")
    else:
        checks.true(not any("·" in t for t in page.texts()), f"{what}: a single phase lists no stages")
    # One dot a profile, at most seven, the current one in ink. Past seven the row is a window on the list.
    row = dots(page)
    shown_dots = min(count, 7) if count > 1 else 0
    wanted = [(240 - (shown_dots - 1) * 10 + i * 20, 308) for i in range(shown_dots)]
    checks.equal([centre(d) for d in row], wanted, f"{what}: the dots")
    window = min(max(index - 1 - 3, 0), count - 7) if count > 7 else 0
    for i, dot in enumerate(row):
        checks.color(dot["fill"], INK if window + i == index - 1 else TRACK, f"{what}: dot {i + 1} of {len(row)}")
    # Chevron discs of radius 28 at 9 and 3 o'clock, hidden at the ends.
    wanted = ([(56, 240)] if index > 1 else []) + ([(424, 240)] if index < count else [])
    checks.equal([centre(d) for d in discs(page, 28) if centre(d)[1] == 240], wanted, f"{what}: the chevrons")
    # SELECT with the pencil beside it.
    select = text(page, "SELECT", 380, ON_PRIMARY)
    if select:
        checks.equal(box(select), (130, 340, 152, 64), f"{what}: SELECT is where the design puts it")
        checks.color(select["fill"], PRIMARY, f"{what}: SELECT is the primary action")
    checks.equal([centre(d) for d in discs(page, 28) if centre(d)[1] != 240], [(322, 372)], f"{what}: the pencil disc")
    checks.equal(len([o for o in page.objects if same_color(o.get("fill"), PRIMARY)]), 1, f"{what}: one primary fill")


def check_adjust(page, title, labels, chosen, number, unit, pill, what):
    """Adjust against screens.adjust of the design. `number` is None when the focused value has nothing to show."""
    no_ring(page, what)
    shown = text(page, title, 86, MUTED, f"{what}: the title")
    if shown:
        checks.true(shown["tx2"] - shown["tx1"] < 276, f"{what}: the title fits its line")
    row = [o for o in page.objects if o["depth"] == 2 and o["clickable"] and "text" in o]
    checks.equal([o["text"] for o in row], labels, f"{what}: the row")
    checks.true(all(o["baseline"] == 141 and o["y1"] == 110 and height(o) == 48 for o in row), f"{what}: the row sits at y 106")
    roomy = all(o["tx1"] - o["x1"] >= 6 and o["x2"] - o["tx2"] >= 6 for o in row)
    checks.true(roomy, f"{what}: every label has room in its segment")
    for o in row:
        on = o["text"] == chosen
        checks.color(o["fill"], INK if on else SURFACE_1, f"{what}: {o['text']} is {'chosen' if on else 'not chosen'}")
        checks.color(o["color"], ON_INK if on else MUTED, f"{what}: {o['text']} is lettered for its fill")
    checks.equal([centre(d) for d in discs(page, 30)], [(82, 250), (398, 250)], f"{what}: minus and plus")
    if number is not None:
        value = text(page, number, 284, None, f"{what}: the reading")
        checks.equal(value.get("kind"), "reading", f"{what}: the value is a Reading")
        checks.equal(value.get("font"), 67, f"{what}: the reading is set in screen-hero-sm")
        text(page, unit, 318, MUTED, f"{what}: the unit")
    action = text(page, pill, 384, ON_PRIMARY if pill == "SAVE" else ON_INK, f"{what}: the pill")
    if action:
        checks.equal(box(action), (152, 344, 176, 64), f"{what}: the pill is where the design puts it")
        checks.color(action["fill"], PRIMARY if pill == "SAVE" else INK, f"{what}: {pill} has its fill")
    checks.true(not page.has("DONE" if pill == "SAVE" else "SAVE"), f"{what}: one action")


def check_sheet(page, what):
    """The save sheet against screens.sheet of the design."""
    no_ring(page, what)
    title = text(page, "Save changes", 122, INK, f"{what}: the title")
    checks.equal(title.get("font"), 32, f"{what}: the title is set in screen-title")
    save = text(page, "SAVE", 198, ON_PRIMARY)
    copy = text(page, "SAVE AS NEW", 274, INK)
    once = text(page, "USE ONCE", 350, MUTED)
    if save and copy and once:
        checks.equal(box(save), (118, 158, 244, 64), f"{what}: SAVE is where the design puts it")
        checks.color(save["fill"], PRIMARY, f"{what}: SAVE is the primary choice")
        checks.equal(box(copy), (118, 234, 244, 64), f"{what}: SAVE AS NEW is where the design puts it")
        checks.color(copy["fill"], SURFACE_2, f"{what}: SAVE AS NEW is on surface-2")
        checks.color(once["fill"], ON_INK, f"{what}: USE ONCE has no fill")
        checks.true(once["clickable"] and height(once) >= 56, f"{what}: USE ONCE is a text button with a 56 px hit area")
    checks.equal(len([o for o in page.objects if same_color(o.get("fill"), PRIMARY)]), 1, f"{what}: one primary fill")


# ---- browsing: pages, chevrons, swipes, the ends, a long name, a single phase ----------------------------------

sim = Sim("profiles-browse")
seed(sim, FIVE)
sim.run(
    BOOT + "redraw skip.json;" + OPEN + "redraw open.json; shot first.bmp; layout first.json;"
    + NEXT + "redraw page-chevron.json; shot middle.bmp; layout middle.json;"
    + NEXT + "redraw page-long.json; shot long.bmp; layout long.json; wait 2000; redraw idle.json;"
    + SWIPE_NEXT + "redraw page-swipe.json; shot timed.bmp; layout timed.json;"
    + SWIPE_NEXT + "shot last.bmp; layout last.json; redraw skip.json;"
    + SWIPE_NEXT + "redraw past-the-end.json; expect text PROFILE 5 / 5;"
    + SWIPE_PREVIOUS + "expect text PROFILE 4 / 5; expect text Turbo;"
    + PREVIOUS + "expect text PROFILE 3 / 5;"
    + PREVIOUS + PREVIOUS + "expect text PROFILE 1 / 5; redraw skip.json;"
    + SWIPE_PREVIOUS + "redraw before-the-start.json; expect text PROFILE 1 / 5;"
    # Browsing never touches the machine.
    + "expect temperature 93; expect duration 28; expect target-weight 36; expect active 0;"
    + SWIPE_DOWN + "expect screen brew; expect text Classic; redraw back.json; quit"
)
checks.count(sim)
check_page(sim.layout("first.json"), 1, 5, "Classic", CLASSIC_FACTS, None, "first page")
check_page(sim.layout("middle.json"), 2, 5, "Adaptive v2", ADAPTIVE_FACTS, ADAPTIVE_STAGES, "middle page")
long_page = sim.layout("long.json")
long_name = next((t for t in long_page.texts() if t.startswith("Blooming")), "")
long_stages = next((t for t in long_page.texts() if t.startswith("Preinfusion")), "")
cut_in_place = long_name.endswith("...") and len(long_name) > len("Blooming...")
checks.true(cut_in_place, f"a long name is cut where it stops fitting, not at a word: '{long_name}'")
checks.true(long_stages.endswith("..."), f"a long stage list ends in an ellipsis: '{long_stages}'")
check_page(long_page, 3, 5, long_name, ["96°", "42.5 S"], long_stages, "long name")
check_page(sim.layout("timed.json"), 4, 5, "Turbo", ["91°", "15 S"], None, "single timed phase")
check_page(sim.layout("last.json"), 5, 5, "Lungo", ["94°", "110.5 G", "40 S"], None, "last page")
budget(sim, "open.json", "Brew to Profiles")
frames = budget(sim, "page-chevron.json", "page change by chevron")
checks.equal(len([f for f in frames if f > 5.0]), 1, "a page change is one cut: one frame carries the new page")
budget(sim, "page-long.json", "page change to a long name")
frames = budget(sim, "page-swipe.json", "page change by swipe")
checks.equal(len(frames), 1, "a swipe changes the page in one frame")
quiet(sim, "idle.json", "a page at rest, long name included")
quiet(sim, "past-the-end.json", "a swipe past the last profile")
quiet(sim, "before-the-start.json", "a swipe before the first profile")
budget(sim, "back.json", "Profiles to Brew by swipe down")
for name in ("first", "middle", "long", "timed", "last"):
    sim.save(f"{name}.bmp", f"{SHOTS}/profiles-{name}.png")

# ---- selecting: the machine takes the profile on screen; the one in use only returns to Brew ---------------------

sim = Sim("profiles-select")
seed(sim, FIVE)
sim.run(
    BOOT + OPEN + NEXT + "redraw skip.json;" + SELECT + "redraw select.json;"
    + "expect temperature 93; expect duration 29; expect target-weight 36; expect text Adaptive v2; expect active 0;"
    # The profile in use is the first page now. SELECT on it changes nothing and returns to Brew.
    + OPEN + "expect text PROFILE 1 / 5; expect text Adaptive v2; layout reopened.json;"
    + SELECT + "expect temperature 93; expect duration 29; expect target-weight 36; expect text Adaptive v2;"
    + OPEN + NEXT + NEXT + NEXT + "expect text Turbo;" + SELECT
    + "expect temperature 91; expect duration 15; expect target-weight 0; expect text Turbo; wait 2500; quit"
)
checks.count(sim)
check_page(sim.layout("reopened.json"), 1, 5, "Adaptive v2", ADAPTIVE_FACTS, ADAPTIVE_STAGES, "profile in use")
budget(sim, "select.json", "Profiles to Brew by SELECT")
checks.equal(settings_of(sim)["sp"], "turbo", "the selection is stored")

# ---- adjusting: each field reaches the machine, UNSAVED, the sheet, SAVE keeps the change -----------------------

sim = Sim("profiles-adjust")
seed(sim, FIVE)
sim.run(
    BOOT + OPEN + "redraw skip.json;" + PENCIL + "redraw to-adjust.json; shot adjust.bmp; layout adjust.json;"
    + PLUS + "expect temperature 94; redraw first-step.json; shot unsaved.bmp; layout unsaved.json;"
    + PLUS + "expect temperature 95; redraw step.json;"
    + MINUS + "expect temperature 94; redraw skip.json;"
    # Held, plus repeats until the finger lifts.
    + "hold 398 250 1500; wait 400; redraw hold.json; layout held.json;"
    # Classic pumps at full power: BAR has nothing to show until the first step gives the phase a target.
    + BAR + "expect text No pressure target; shot bar-unset.bmp; layout bar-unset.json; redraw skip.json;"
    + PLUS + "redraw first-bar.json; expect hidden No pressure target; shot bar.bmp; layout bar.json;"
    + PLUS + MINUS + MINUS + "layout bar-lowered.json;"
    + TARGET + "shot time.bmp; layout time.json;"
    + PLUS + "expect duration 29;" + MINUS + MINUS + "expect duration 27; layout time-lowered.json; redraw skip.json;"
    + SHEET + "redraw to-sheet.json; shot sheet.bmp; layout sheet.json;"
    + SWIPE_DOWN + "expect screen adjust; redraw sheet-back.json; layout back.json;"
    + SHEET + "redraw skip.json;" + SAVE + "expect screen brew; redraw saved.json;"
    + "expect duration 27; expect target-weight 36; expect text Classic;"
    # Saved: another profile and back, and the change is still there.
    + OPEN + NEXT + "expect text Adaptive v2;" + SELECT + "expect duration 29;"
    + OPEN + NEXT + "expect text Classic; layout saved-page.json;" + SELECT + "expect duration 27; wait 2500; quit"
)
checks.count(sim)
check_adjust(sim.layout("adjust.json"), "CLASSIC", ROW, "TEMP", "93", "°C", "DONE", "Adjust, nothing changed")
check_adjust(sim.layout("unsaved.json"), UNSAVED, ROW, "TEMP", "94", "°C", "SAVE", "Adjust, unsaved")
held_temperature = int(reading(sim.layout("held.json")) or 0)
checks.true(held_temperature >= 94 + 5, f"a held plus keeps stepping: 94 became {held_temperature}")
unset = sim.layout("bar-unset.json")
check_adjust(unset, UNSAVED, ROW, "BAR", None, None, "SAVE", "Adjust, BAR without a target")
checks.equal(reading(unset), None, "a phase without a pressure target shows no number")
text(unset, "No pressure target", 258, MUTED)
check_adjust(sim.layout("bar.json"), UNSAVED, ROW, "BAR", "9.0", "BAR", "SAVE", "Adjust, the first pressure step")
checks.equal(reading(sim.layout("bar-lowered.json")), "8.5", "pressure moves in half bars")
check_adjust(sim.layout("time.json"), UNSAVED, ROW, "TIME", "28", "S", "SAVE", "Adjust, time")
checks.equal(reading(sim.layout("time-lowered.json")), "27", "time moves in seconds")
check_sheet(sim.layout("sheet.json"), "save sheet")
check_adjust(sim.layout("back.json"), UNSAVED, ROW, "TIME", "27", "S", "SAVE", "Adjust, back from the sheet")
saved_facts = [f"{held_temperature}°", "36 G", "27 S"]
check_page(sim.layout("saved-page.json"), 2, 5, "Classic", saved_facts, None, "saved profile")
saved = stored(sim, "classic")
checks.equal(round(saved["temperature"]), held_temperature, "SAVE wrote the temperature the display showed")
checks.equal(saved["phases"][0]["duration"], 27, "SAVE wrote the duration")
checks.equal(saved["phases"][0]["pump"], bar(8.5), "SAVE wrote the pressure target")
checks.equal(saved["phases"][0]["targets"][0]["value"], 36, "SAVE left the weight target alone")
budget(sim, "to-adjust.json", "Profiles to Adjust")
budget(sim, "first-step.json", "first change on Adjust (title and pill change too)")
budget(sim, "step.json", "one step on Adjust", 8.0)
budget(sim, "hold.json", "held plus on Adjust", 8.0)
budget(sim, "first-bar.json", "a reading appears on Adjust")
budget(sim, "to-sheet.json", "Adjust to the sheet")
budget(sim, "sheet-back.json", "the sheet back to Adjust")
budget(sim, "saved.json", "the sheet to Brew by SAVE")
sim.save("adjust.bmp", f"{SHOTS}/adjust.png")
sim.save("unsaved.bmp", f"{SHOTS}/adjust-unsaved.png")
sim.save("bar-unset.bmp", f"{SHOTS}/adjust-bar-unset.png")
sim.save("bar.bmp", f"{SHOTS}/adjust-bar.png")
sim.save("time.bmp", f"{SHOTS}/adjust-time.png")
sim.save("sheet.bmp", f"{SHOTS}/sheet.png")

# ---- SAVE AS NEW: one more profile, the original untouched --------------------------------------------------------

sim = Sim("profiles-as-new")
seed(sim, FIVE)
sim.run(
    BOOT + OPEN + PENCIL + PLUS + "expect temperature 94;" + SHEET + "redraw skip.json;" + SAVE_AS_NEW
    + "expect screen brew; redraw as-new.json; expect temperature 94; expect text Copy of Classic;"
    + OPEN + "shot copy.bmp; layout copy.json;" + NEXT + "layout original.json;"
    + SELECT + "expect temperature 93; expect text Classic; wait 2500; quit"
)
checks.count(sim)
check_page(sim.layout("copy.json"), 1, 6, "Copy of Classic", ["94°", "36 G", "28 S"], None, "new profile")
check_page(sim.layout("original.json"), 2, 6, "Classic", CLASSIC_FACTS, None, "original after SAVE AS NEW")
files = sorted(p.stem for p in (sim.dir / "sim_data" / "littlefs" / "p").glob("*.json"))
checks.equal(len(files), 6, "SAVE AS NEW added one profile")
added = [stored(sim, name) for name in files if name not in [p["id"] for p in FIVE]]
added = [(p["label"], round(p["temperature"])) for p in added]
checks.equal(added, [("Copy of Classic", 94)], "the new profile carries the change")
checks.equal(stored(sim, "classic")["temperature"], 93, "the original is as it was")
checks.equal(len(settings_of(sim)["fp"].split(",")), 6, "the new profile is a favourite")
budget(sim, "as-new.json", "the sheet to Brew by SAVE AS NEW")
sim.save("copy.bmp", f"{SHOTS}/profiles-copy.png")

# ---- USE ONCE: the change is live and still unsaved ----------------------------------------------------------------

sim = Sim("profiles-use-once")
seed(sim, FIVE)
sim.run(
    BOOT + OPEN + PENCIL + PLUS + SHEET + "redraw skip.json;"
    + USE_ONCE + "expect screen brew; redraw once.json; expect temperature 94;"
    + OPEN + "layout live.json;" + PENCIL + "layout still-unsaved.json;"
    # Back to Profiles and SELECT on the same profile: still live, still unsaved.
    + SWIPE_DOWN + "expect screen profiles;" + SELECT + "expect temperature 94;"
    # Another profile and back: the profile comes from flash again, without the change.
    + OPEN + NEXT + SELECT + "expect temperature 93; expect text Adaptive v2;"
    + OPEN + NEXT + "expect text Classic;" + SELECT + "expect temperature 93; wait 2500; quit"
)
checks.count(sim)
check_page(sim.layout("live.json"), 1, 5, "Classic", ["94°", "36 G", "28 S"], None, "profile used once")
check_adjust(sim.layout("still-unsaved.json"), UNSAVED, ROW, "TEMP", "94", "°C", "SAVE", "Adjust after USE ONCE")
checks.equal(stored(sim, "classic")["temperature"], 93, "USE ONCE wrote nothing")
budget(sim, "once.json", "the sheet to Brew by USE ONCE")

# ---- the weight target: YIELD with a scale, removing it, and the row of two ---------------------------------------

sim = Sim("profiles-weight")
seed(sim, FIVE)
sim.run(
    BOOT_WITH_SCALE + OPEN + PENCIL + "layout with-scale.json;"
    + TARGET + "shot yield.bmp; layout yield.json;"
    + PLUS + "expect target-weight 37;" + MINUS + MINUS + "expect target-weight 35; redraw skip.json;"
    # The unit line is the control that drops the weight target (checklist item 5): the profile stops by time.
    + UNIT_LINE + "redraw use-time.json; expect target-weight 0; expect duration 28; shot no-weight.bmp; layout no-weight.json;"
    + PLUS + "expect duration 29; expect target-weight 0;"
    + SHEET + SAVE + "expect screen brew; expect target-weight 0; expect duration 29;"
    # Turbo runs on a flow target: no pressure to edit, so the row has two choices.
    + OPEN + NEXT + NEXT + NEXT + "expect text Turbo;" + PENCIL + "expect temperature 91; shot two.bmp; layout two.json;"
    + SECOND_OF_TWO + "layout two-time.json;" + PLUS + "expect duration 16;"
    # Without a pressure sensor BAR goes for every profile.
    + SWIPE_DOWN + NEXT + "expect text Classic;" + PENCIL + "expect text CLASSIC; layout sensor.json;"
    + "pressure-sensor 0; wait 800; expect screen adjust; layout no-sensor.json; wait 2000; quit"
)
checks.count(sim)
with_yield = ["TEMP", "BAR", "YIELD"]
check_adjust(sim.layout("with-scale.json"), "CLASSIC", with_yield, "TEMP", "93", "°C", "DONE", "Adjust with a scale")
check_adjust(sim.layout("yield.json"), "CLASSIC", with_yield, "YIELD", "36", "G · USE TIME", "DONE", "Adjust, weight")
use_time = sim.layout("yield.json").find("G · USE TIME") or {}
checks.true(use_time.get("clickable") and height(use_time) >= 44, "the unit line is a control while the weight is focused")
no_weight = sim.layout("no-weight.json")
check_adjust(no_weight, UNSAVED, ROW, "TIME", "28", "S", "SAVE", "Adjust, weight target removed")
checks.true(not any("USE TIME" in t for t in no_weight.texts()), "nothing offers to remove a weight target that is gone")
check_adjust(sim.layout("two.json"), "TURBO", ["TEMP", "TIME"], "TEMP", "91", "°C", "DONE", "Adjust, no pressure phase")
check_adjust(sim.layout("two-time.json"), "TURBO", ["TEMP", "TIME"], "TIME", "15", "S", "DONE", "Adjust, row of two")
check_adjust(sim.layout("sensor.json"), "CLASSIC", ROW, "TEMP", "93", "°C", "DONE", "Adjust with a pressure sensor")
check_adjust(sim.layout("no-sensor.json"), "CLASSIC", ["TEMP", "TIME"], "TEMP", "93", "°C", "DONE", "Adjust, no pressure sensor")
saved = stored(sim, "classic")
checks.true("targets" not in saved["phases"][0], "SAVE wrote the profile without its weight target")
checks.equal(saved["phases"][0]["duration"], 29, "the profile now stops by time")
budget(sim, "use-time.json", "removing the weight target")
sim.save("yield.bmp", f"{SHOTS}/adjust-yield.png")
sim.save("no-weight.bmp", f"{SHOTS}/adjust-weight-removed.png")
sim.save("two.bmp", f"{SHOTS}/adjust-two.png")

# ---- a weight held down to nothing leaves a timed profile; the same press does not go on to shorten the time -------

sim = Sim("profiles-hold")
seed(sim, FIVE)
sim.run(
    BOOT_WITH_SCALE + OPEN + PENCIL + TARGET + "expect text YIELD; hold 82 250 7000; wait 500;"
    + "expect target-weight 0; expect duration 28; layout held.json;" + MINUS + "expect duration 27; quit"
)
checks.count(sim)
check_adjust(sim.layout("held.json"), UNSAVED, ROW, "TIME", "28", "S", "SAVE", "Adjust, weight held down to nothing")

# ---- DONE with nothing changed -------------------------------------------------------------------------------------

sim = Sim("profiles-done")
seed(sim, FIVE)
sim.run(
    BOOT + OPEN + PENCIL + "expect text DONE; expect hidden SAVE; redraw skip.json;"
    # Looking at another value changes nothing.
    + BAR + TARGET + TEMP + "expect text CLASSIC; expect text DONE; redraw skip.json;"
    + ACTION + "expect screen brew; redraw done.json; expect temperature 93; expect duration 28; expect target-weight 36;"
    # The page still shows the recipe as it was. A swipe down leaves Adjust for Profiles, and Profiles for Brew.
    + OPEN + "layout unchanged.json;" + PENCIL + "expect text CLASSIC;"
    + SWIPE_DOWN + "expect screen profiles; redraw adjust-back.json;" + SWIPE_DOWN + "expect screen brew; wait 2500; quit"
)
checks.count(sim)
check_page(sim.layout("unchanged.json"), 1, 5, "Classic", CLASSIC_FACTS, None, "profile after DONE")
checks.equal(stored(sim, "classic"), CLASSIC, "DONE wrote nothing")
budget(sim, "done.json", "Adjust to Brew by DONE")
budget(sim, "adjust-back.json", "Adjust to Profiles by swipe down")

# ---- one profile: no count, no dots, no chevrons -------------------------------------------------------------------

sim = Sim("profiles-single")
seed(sim, [CLASSIC])
sim.run(
    BOOT + OPEN + "shot single.bmp; layout single.json; redraw skip.json;"
    + SWIPE_NEXT + SWIPE_PREVIOUS + "redraw swipes.json; expect screen profiles;" + SELECT + "expect temperature 93; quit"
)
checks.count(sim)
check_page(sim.layout("single.json"), 1, 1, "Classic", CLASSIC_FACTS, None, "single profile")
quiet(sim, "swipes.json", "swipes with a single profile")
sim.save("single.bmp", f"{SHOTS}/profiles-single.png")

# ---- nine profiles: seven dots in a window that follows the page; a name with an accent in capitals -----------------

sim = Sim("profiles-many")
seed(sim, NINE)
sim.run(
    BOOT + OPEN + "layout one.json;" + NEXT * 4 + "shot many.bmp; layout five.json;" + NEXT * 4 + "layout nine.json;"
    + PENCIL + "expect temperature 97; expect duration 35; expect target-weight 120; layout accent.json; quit"
)
checks.count(sim)
check_page(sim.layout("one.json"), 1, 9, "Classic", CLASSIC_FACTS, None, "first of nine")
check_page(sim.layout("five.json"), 5, 9, "Lungo", ["94°", "110.5 G", "40 S"], None, "fifth of nine")
check_page(sim.layout("nine.json"), 9, 9, "Allongé", ["97°", "120 G", "35 S"], None, "last of nine")
check_adjust(sim.layout("accent.json"), "ALLONGÉ", ROW, "TEMP", "97", "°C", "DONE", "Adjust, accented name")
sim.save("many.bmp", f"{SHOTS}/profiles-many.png")

# ---- a long name on Adjust: the title keeps UNSAVED and cuts the name ----------------------------------------------

sim = Sim("profiles-long-title")
seed(sim, [LONG, CLASSIC])
sim.run(
    BOOT + OPEN + PENCIL + "layout long.json;"
    + MINUS + "expect temperature 95; layout long-unsaved.json; shot long-unsaved.bmp; quit"
)
checks.count(sim)
check_adjust(sim.layout("long.json"), "BLOOMING ESPRESSO...", ROW, "TEMP", "96", "°C", "DONE", "Adjust, long name")
long_unsaved = sim.layout("long-unsaved.json")
check_adjust(long_unsaved, "BLOOMING... · UNSAVED", ROW, "TEMP", "95", "°C", "SAVE", "Adjust, long name unsaved")
sim.save("long-unsaved.bmp", f"{SHOTS}/adjust-long-name.png")

# ---- the budget where Brew is at its heaviest: three digits, a scale line, the warning glyph ------------------------

sim = Sim("profiles-heavy")
seed(sim, [ADAPTIVE, CLASSIC, LONG, TURBO, LUNGO], wl_flush="1", ts="160")
sim.run(
    # Steam heats the boiler past 100 degrees; back on Brew it reads three digits for the next half minute.
    "wait 3500; scale 1; mode steam; wait 40000; mode brew; wait 2500; expect screen brew; layout hot.json; redraw skip.json;"
    + OPEN + "redraw brew-profiles.json;" + SWIPE_DOWN + "expect screen brew; redraw profiles-brew.json;"
    + OPEN + "redraw skip.json;" + SELECT + "redraw select-brew.json;"
    + OPEN + PENCIL + "redraw skip.json;" + ACTION + "expect screen brew; redraw adjust-brew.json;"
    + OPEN + PENCIL + PLUS + SHEET + "redraw skip.json;"
    + USE_ONCE + "expect screen brew; redraw sheet-brew.json; layout still-hot.json; quit",
    timeout=240,
)
checks.count(sim)
hot = sim.layout("hot.json")
checks.equal(len(reading(hot) or ""), 3, "the boiler reads three digits on Brew")
checks.true(any("TARE" in t for t in hot.texts()), "Brew carries the scale line")
glyph = any(o["kind"] == "img" and same_color(o.get("color"), WARNING) for o in hot.objects)
checks.true(glyph, "Brew carries the warning glyph")
budget(sim, "brew-profiles.json", "hot Brew to Profiles")
budget(sim, "profiles-brew.json", "Profiles to hot Brew by swipe down")
budget(sim, "select-brew.json", "Profiles to hot Brew by SELECT")
budget(sim, "adjust-brew.json", "Adjust to hot Brew by DONE")
budget(sim, "sheet-brew.json", "the sheet to hot Brew by USE ONCE")
checks.equal(len(reading(sim.layout("still-hot.json")) or ""), 3, "the boiler still read three digits at the last change")

# ---- Light is a setting ----------------------------------------------------------------------------------------------

sim = Sim("profiles-light")
seed(sim, FIVE)
sim.run(
    BOOT + "theme 1; wait 800;" + OPEN + NEXT + "shot profiles.bmp; layout profiles.json;"
    # A theme change rebuilds every screen. Each comes back as it was: the page, the sheet, and Adjust behind it.
    + NEXT + "theme 0; wait 800; expect screen profiles; layout profiles-rebuilt.json; theme 1; wait 800;" + PREVIOUS
    + PENCIL + PLUS + "shot adjust.bmp;" + SHEET + "shot sheet.bmp; layout sheet.json;"
    + "theme 0; wait 800; expect screen sheet; layout rebuilt.json;"
    + SWIPE_DOWN + "expect screen adjust; expect text ADAPTIVE V2 · UNSAVED; expect temperature 94; quit"
)
checks.count(sim)
light = sim.layout("profiles.json")
checks.color(light.objects[0]["fill"], "#e9e9e9", "Light paints the face in surface-0")
checks.color((light.find("Adaptive v2") or {}).get("color"), "#111111", "Light sets the name in ink")
checks.color((sim.layout("sheet.json").find("SAVE AS NEW") or {}).get("fill"), "#ffffff", "Light keeps SAVE AS NEW on surface-2")
check_page(sim.layout("profiles-rebuilt.json"), 3, 5, long_name, ["96°", "42.5 S"], long_stages, "page after a theme change")
check_sheet(sim.layout("rebuilt.json"), "save sheet after a theme change")
sim.save("profiles.bmp", f"{SHOTS}/profiles-light.png")
sim.save("adjust.bmp", f"{SHOTS}/adjust-light.png")
sim.save("sheet.bmp", f"{SHOTS}/sheet-light.png")

print("largest frame of each change, percent of the panel:")
for what, share in sorted(largest.items(), key=lambda item: -item[1]):
    print(f"  {share:5.1f}  {what}")
checks.finish()
