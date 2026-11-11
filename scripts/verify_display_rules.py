#!/usr/bin/env python3
"""Check that every display screen keeps the five minimal-luxury rules, using the real LVGL simulator.

Each checkpoint writes the visible object tree (`layout`) and a frame (`shot`). The checks:

  overlap   no two visible texts touch, and no text sits on a control it does not belong to
  edge      text stays well inside the round panel, controls inside the bezel, both clear of the rim
  faded     no visible control is greyed or disabled (rule 4: unusable controls are hidden)
  primary   at most one outlined primary action; steppers only beside a target being set (rule 1)
  format    units and numbers follow one style: "93°", "9 bar", "36 g", matching precision, no
            placeholder dashes or three-dot ellipses (rule 5)
  rim       no gauge numerals on the rim and no pixel icons (rule 3)
  motion    named transitions produce distinct intermediate frames
  steady    the rim stays whole while a new screen's content enters
  text      status lines that carry a live value match their pattern

Build first with `pio run -e display-sim`. Captures and logs stay in a fresh scratch directory.
"""
import argparse
import json
import math
from pathlib import Path
import re
import tempfile

from PIL import Image, ImageChops, ImageDraw, ImageStat
from verify_display_standby import ROOT, run_case

CENTER = 240
TEXT_RADIUS = 220      # text corners stay this close to the centre at most
CONTROL_RADIUS = 230   # outlined controls and drawn lines
RIM_CLEARANCE = 8      # anything inside a rim arc's span keeps this far from its inner edge

PROFILE = {"id": "classic", "label": "Classic", "type": "standard", "temperature": 93, "dose": 18,
           "phases": [{"name": "Brew", "phase": "brew", "valve": 1, "duration": 28, "pump": 100,
                       "targets": [{"type": "volumetric", "operator": "gte", "value": 36}]}]}
TIMED = {"id": "timed", "label": "Timed", "type": "standard", "temperature": 93,
         "phases": [{"name": "Brew", "phase": "brew", "valve": 1, "duration": 26, "pump": 100}]}
PHASED = {"id": "phased", "label": "Adaptive v2", "type": "pro", "temperature": 93, "dose": 18,
          "phases": [
              {"name": "Preinfuse", "phase": "preinfusion", "valve": 1, "duration": 4, "pump": 20},
              {"name": "Bloom", "phase": "preinfusion", "valve": 1, "duration": 5, "pump": 0},
              {"name": "Ramp to 9 bar", "phase": "brew", "valve": 1, "duration": 20,
               "pump": {"target": "pressure", "pressure": 9, "flow": 0},
               "transition": {"type": "linear", "duration": 5, "adaptive": False},
               "targets": [{"type": "volumetric", "operator": "gte", "value": 36}]}]}
QUIET = {"sp": "classic", "fp": "classic,timed,phased", "wl_temp": "0", "wl_flush": "0"}
WARNED = dict(QUIET, wl_temp="2", wl_flush="1")
FIXTURES = [PROFILE, TIMED, PHASED]


def cap(name, *flags):
    """Script text for one checkpoint. Flags relax a check: steppers, modal."""
    CHECKPOINT_FLAGS[name] = set(flags)
    return f"wait 450; layout {name}.json; shot {name}.bmp"


CHECKPOINT_FLAGS = {}
# Labels whose text follows a live value; each checkpoint must show one label matching its pattern.
TEXT_PATTERNS = {
    "steam-heating-dark": r"\d+°",
    "steam-active": r"\d+°",
    "water-idle-dark": r"\d+°",
    "water-active": r"\d+°",
}

CASES = [
    ("brew", f"""
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; expect screen 2;
        expect text BREW · HEATING TO 93°; expect text °C; expect hidden bar; expect hidden PROFILES;
        expect text Classic; expect hidden UNSAVED; expect text START;
        {cap("brew-heating-dark")}; theme 1; wait 2200; {cap("brew-heating-light")}; theme 2; wait 2200; {cap("brew-heating-amoled")};
        theme 0; wait 70000; expect text BREW · READY; {cap("brew-ready-dark")};
        theme 1; wait 2200; {cap("brew-ready-light")}; theme 0;
        scale 1; weight 18.4; wait 800; expect text TARE; expect text 18.4 g; {cap("brew-scale")};
        quit
    """, QUIET, FIXTURES),
    ("brew-warnings", f"""
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; expect screen 2;
        {cap("brew-warning-dot")};
        tap 240 392; wait 500; expect text Confirm brew; expect text Temperature unstable;
        {cap("brew-confirm", "modal")}; tap 240 414; wait 500; expect hidden Confirm brew;
        tap 240 34; wait 900; expect screen 4; expect text Temperature unstable; {cap("warnings-from-brew")};
        quit
    """, WARNED, FIXTURES),
    ("brew-single", f"""
        pressure-sensor 0; wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; expect screen 2;
        {cap("brew-single-sensor")}; quit
    """, QUIET, FIXTURES),
    ("modes", f"""
        wait 3000; tap 240 240; wait 700; expect screen 4; {cap("modes-normal-dark")};
        theme 1; wait 2200; {cap("modes-normal-light")}; theme 0;
        wifi disconnected; wait 500; {cap("modes-wifi-lost")}; wifi sta; wait 500;
        swipe 370 224 110 224 600; wait 700; expect text All clear; expect hidden BEFORE YOUR NEXT SHOT;
        {cap("warnings-clear")}; tap 240 450; wait 700; expect text Brew; expect hidden All clear;
        {cap("modes-returned")}; quit
    """, QUIET, FIXTURES),
    ("modes-warned", f"""
        wait 3000; tap 240 240; wait 700; expect screen 4; {cap("modes-warning-dot")};
        tap 240 34; wait 900; expect text Warnings; expect text Temperature unstable; expect text ERROR;
        {cap("warnings-list-dark")}; theme 1; wait 2200; {cap("warnings-list-light")}; theme 0;
        tap 240 450; wait 700; expect hidden Warnings; expect text Brew; quit
    """, WARNED, FIXTURES),
    ("steam", f"""
        wait 3000; tap 240 240; wait 500; tap 240 372; wait 700; expect screen 5;
        expect text STEAM; expect hidden STEAM · READY; expect text 145; expect text TARGET °C; expect text –; expect text +;
        {cap("steam-heating-dark", "steppers")}; theme 1; wait 2200; {cap("steam-heating-light", "steppers")}; theme 0;
        tap 404 240; wait 400; expect setpoint 146; expect text 146; tap 76 240; wait 400; expect setpoint 145;
        tap 240 240; wait 400; expect setpoint 145; expect screen 5;
        wait 47000; expect active 1; expect text STEAM; expect hidden STEAMING; expect text STOP & MODES; expect text +;
        {cap("steam-active", "steppers")};
        tap 240 450; wait 600; expect screen 4; quit
    """, QUIET, FIXTURES),
    ("water", f"""
        wait 3000; tap 240 240; wait 500; swipe 240 294 240 216 600; wait 700; tap 240 372; wait 700;
        expect screen 6; expect text START; expect text 80; expect text TARGET °C; expect text +;
        {cap("water-idle-dark", "steppers")}; theme 1; wait 2200; {cap("water-idle-light", "steppers")}; theme 0;
        tap 404 240; wait 400; expect setpoint 81; expect text 81; tap 76 240; wait 400; expect setpoint 80;
        tap 240 392; wait 1200; expect active 1; expect text WATER; expect hidden WATER · DISPENSING; expect text STOP;
        swipe 240 280 240 140; wait 500; expect screen 6; expect active 1; expect setpoint 80;
        {cap("water-active", "steppers")}; tap 240 392; wait 500; expect active 0; quit
    """, QUIET, FIXTURES),
    ("grind", f"""
        scale 1; wait 3000; tap 240 240; wait 500; tap 240 294; wait 700; expect screen 8;
        expect text GRIND; expect hidden GRIND · READY; expect text TIME; expect text WEIGHT; expect text +;
        {cap("grind-time-dark", "steppers")}; theme 1; wait 2200; {cap("grind-time-light", "steppers")}; theme 0;
        tap 404 240; wait 400; expect grind-duration 26; expect text 0:26; tap 76 240; wait 400;
        expect grind-duration 25;
        tap 240 132; wait 500; expect grind-weight 180; expect text 18.0; {cap("grind-weight", "steppers")};
        tap 404 240; wait 400; expect grind-weight 185; tap 76 240; wait 400; expect grind-weight 180;
        tap 240 392; wait 600; expect grind-active 1; expect text GRIND; expect hidden GRINDING; expect hidden TARE; expect hidden +;
        weight 1; wait 400; weight 2; wait 400; expect grind-active 1; {cap("grind-running")};
        weight 25; wait 1200; expect grind-active 0; quit
    """, QUIET, FIXTURES),
    ("modes-single", f"""
        pressure-sensor 0; wait 3000; tap 240 240; wait 500; tap 240 294; wait 700; expect screen 5;
        {cap("steam-single", "steppers")}; tap 240 450; wait 600; tap 240 372; wait 700; expect screen 6;
        {cap("water-single", "steppers")}; quit
    """, dict(QUIET, alt_relay="0"), FIXTURES),
    ("shot-timed", f"""
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 392; wait 5000; expect screen 3;
        expect active 1; expect text STOP; expect hidden SHOT COMPLETE; {cap("shot-running-dark")};
        theme 1; wait 2200; {cap("shot-running-light")}; theme 0;
        wait 26000; expect active 0; expect text SHOT COMPLETE; expect text DONE; {cap("shot-complete-dark")};
        theme 1; wait 2200; {cap("shot-complete-light")}; theme 0;
        tap 240 392; wait 700; expect screen 2; quit
    """, QUIET, FIXTURES),
    ("shot-phased", f"""
        scale 1; wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 392; wait 6500;
        expect screen 3; expect text Bloom; {cap("shot-phase-two")};
        weight 4; wait 4000; weight 10; wait 2000; weight 18; wait 2000; {cap("shot-weighed")};
        weight 26; wait 1500; weight 32; wait 1500; weight 36.4; wait 5000; expect text SHOT COMPLETE;
        {cap("shot-complete-weighed")}; tap 240 392; wait 700; expect screen 2; quit
    """, dict(QUIET, sp="phased"), FIXTURES),
    ("shot-single", f"""
        pressure-sensor 0; wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 392; wait 4000;
        expect screen 3; {cap("shot-single-sensor")}; tap 240 392; wait 700; quit
    """, QUIET, FIXTURES),
    ("standby", f"""
        wait 3000; expect screen 1; expect text STANDBY; expect text WAKE; {cap("standby-dark")};
        theme 1; wait 1500; {cap("standby-light")}; theme 2; wait 1500; {cap("standby-amoled")}; theme 0; wait 1500;
        controller disconnected; wait 700; expect text CONNECTING; {cap("standby-connecting")};
        controller connected; wait 700; protocol 4; wait 700; {cap("standby-mismatch")};
        protocol 3; wait 700; error 4; wait 700; {cap("standby-error")}; error 0; wait 700; quit
    """, dict(QUIET, clk_24h="0"), FIXTURES),
    ("standby-hint", f"""
        wait 3000; expect screen 1; expect text Boiler off · 21° · wakes 7:00 AM; {cap("standby-wake-hint")}; quit
    """, dict(QUIET, clk_24h="0", ab_en="1", ab_schedules="07:00|1111111"), FIXTURES),
    ("standby-warned", f"""
        wait 3000; expect screen 1; {cap("standby-warning")}; quit
    """, WARNED, FIXTURES),
    ("info", f"""
        wait 3000; tap 240 240; wait 500; swipe 240 390 240 90 300; wait 900; swipe 240 320 240 120 250;
        wait 700; tap 240 216; wait 700; expect screen 9; expect text SCAN TO OPEN; expect text GaggiMate-Sim;
        expect text 192.168.1.123; {cap("info-sta-dark")}; theme 1; wait 2200; {cap("info-sta-light")}; theme 0;
        tap 240 386; wait 500; expect text CONTROLLER; expect text sim-3.0; expect hidden SCAN TO OPEN;
        {cap("info-about")}; tap 240 386; wait 500; expect text SCAN TO OPEN;
        wifi ap; wait 600; expect text SCAN TO JOIN; expect text SETUP NETWORK; {cap("info-ap")};
        wifi disconnected; wait 600; expect text Not connected; expect hidden SCAN TO OPEN; {cap("info-offline")};
        wifi sta; wait 600; tap 240 450; wait 700; expect screen 4; quit
    """, QUIET, FIXTURES),
    ("profiles", f"""
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 310; wait 900; expect screen 7;
        expect text PROFILES; expect text Classic; expect text 93° · 18 → 36 g · 28 s; {cap("profiles-browse")};
        swipe 370 224 110 224 600; wait 700; expect text Timed; expect text 93° · 26 s; {cap("profiles-timed")};
        swipe 370 224 110 224 600; wait 700; expect text Preinfuse · Bloom · Ramp to 9 bar; {cap("profiles-phased")};
        theme 1; wait 2200; {cap("profiles-phased-light")}; theme 0;
        swipe 110 224 370 224 600; wait 700; swipe 110 224 370 224 600; wait 700;
        tap 240 392; wait 700; expect text ADJUST; expect text TEMPERATURE; expect hidden SAVE;
        {cap("adjust-temperature", "steppers")};
        tap 384 182; wait 500; expect temperature 94; expect text UNSAVED; expect text SAVE;
        {cap("adjust-dirty", "steppers")};
        tap 320 322; wait 500; expect text TIME; {cap("adjust-time", "steppers")};
        tap 320 322; wait 500; expect text PRESSURE; expect text bar; {cap("adjust-pressure", "steppers")};
        tap 240 392; wait 500; expect text Save changes; expect text USE ONCE; {cap("adjust-sheet")};
        tap 240 346; wait 900; expect screen 2; expect temperature 94; quit
    """, QUIET, FIXTURES),
    ("motion", """
        wait 3000; tap 240 240; wait 800; shot enter-before.bmp; tap 240 372; shot enter-during.bmp;
        wait 700; shot enter-after.bmp; expect screen 5;
        tap 404 240; tap 404 240; tap 404 240; tap 404 240; tap 404 240; wait 1000; shot glide-before.bmp;
        tap 76 240; tap 76 240; tap 76 240; tap 76 240; tap 76 240; shot glide-during.bmp; wait 700;
        shot glide-after.bmp; quit
    """, QUIET, FIXTURES),
    ("motion-steady", """
        wait 3000; tap 240 240; wait 800; tap 240 216; shot rim-during.bmp; wait 700; shot rim-after.bmp;
        expect screen 2; tap 240 310; shot profile-during.bmp; wait 700; shot profile-after.bmp; expect screen 7; quit
    """, QUIET, FIXTURES),
    ("profiles-scale", f"""
        scale 1; wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 310; wait 900;
        tap 240 392; wait 700; tap 320 322; wait 500; expect text OUTPUT; expect text USE TIME;
        {cap("adjust-output", "steppers")}; quit
    """, QUIET, FIXTURES),
]

MOTION = [
    # (case, frames): the middle frame must differ from both ends.
    ("motion", ("enter-before", "enter-during", "enter-after")),
    ("motion", ("glide-before", "glide-during", "glide-after")),
    ("motion-steady", ("rim-after", "profile-during", "profile-after")),
]
STEADY = [
    # (case, during, after): the rim sits in the same place on every screen, so it is already whole while the
    # new content enters. Fading it with the content would repaint the full panel on each frame.
    ("motion-steady", "rim-during", "rim-after"),
]
RIM_BAND = (220, 234)  # radii that hold the rim arcs and their notches, outside every label
STEADY_LIMIT = 0.15    # share of the rim's light that may still change mid-enter


def load(path):
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    return rows[0]["screen"], rows[1:]


def box(row, text=False):
    if text:
        return row["tx1"], row["ty1"], row["tx2"], row["ty2"]
    return row["x1"], row["y1"], row["x2"], row["y2"]


def corners(b):
    x1, y1, x2, y2 = b
    return [(x1, y1), (x2, y1), (x1, y2), (x2, y2)]


def far_extent(row):
    """Furthest visible point from the centre, treating a fully rounded control as a stadium."""
    x1, y1, x2, y2 = box(row)
    w, h = x2 - x1 + 1, y2 - y1 + 1
    r = min(row.get("radius", 0), w // 2, h // 2)
    if r >= min(w, h) // 2 - 1:
        if w >= h:
            centres = [(x1 + r, (y1 + y2) / 2), (x2 - r, (y1 + y2) / 2)]
        else:
            centres = [((x1 + x2) / 2, y1 + r), ((x1 + x2) / 2, y2 - r)]
        return max(math.dist((CENTER, CENTER), c) + r for c in centres)
    return max(math.dist((CENTER, CENTER), c) for c in corners((x1, y1, x2, y2)))


def angle_of(point):
    return math.degrees(math.atan2(point[1] - CENTER, point[0] - CENTER)) % 360


def in_span(angle, start, end):
    start, end = start % 360, end % 360
    return start <= angle <= end if start <= end else angle >= start or angle <= end


def overlaps(a, b, margin=1):
    return not (a[2] + margin < b[0] or b[2] + margin < a[0] or a[3] + margin < b[1] or b[3] + margin < a[1])


def ancestors(rows):
    by_id = {r["id"]: r for r in rows}
    def chain(row):
        out = set()
        while row["parent"] in by_id:
            row = by_id[row["parent"]]
            out.add(row["id"])
        return out
    return {r["id"]: chain(r) for r in rows}


def check(name, rows, flags):
    problems = []
    lineage = ancestors(rows)
    labels = [r for r in rows if r["kind"] == "label" and r["text"].strip() and r.get("zoom", 256) == 256]
    full = lambda r: (r["x2"] - r["x1"]) >= 400 and (r["y2"] - r["y1"]) >= 400
    bordered = [r for r in rows if r["kind"] == "obj" and r["border"] > 0 and r["border_opa"] > 0 and not full(r)]
    rims = [r for r in rows if r["kind"] == "arc" and (r["x2"] - r["x1"]) > 300]

    # overlap
    for i, a in enumerate(labels):
        for b in labels[i + 1:]:
            if overlaps(box(a, True), box(b, True)):
                problems.append(f"overlap: '{a['text']}' touches '{b['text']}'")
        for c in bordered:
            if c["id"] in lineage[a["id"]]:
                continue
            if overlaps(box(a, True), box(c), 0):
                problems.append(f"overlap: '{a['text']}' sits on a control at {box(c)}")

    # edge and rim clearance
    for r in labels:
        d = max(math.dist((CENTER, CENTER), p) for p in corners(box(r, True)))
        if d > TEXT_RADIUS:
            problems.append(f"edge: '{r['text']}' reaches {d:.0f} px from the centre (max {TEXT_RADIUS})")
    for r in bordered + [r for r in rows if r["kind"] in ("line", "qrcode")]:
        if r["kind"] == "line" and r["parent"] >= 0 and any(a["kind"] == "arc" for a in rows if a["id"] == r["parent"]):
            continue
        d = far_extent(r)
        if d > CONTROL_RADIUS and not (r["kind"] == "line" and (r["x2"] - r["x1"]) <= 20):
            problems.append(f"edge: {r['kind']} at {box(r)} reaches {d:.0f} px (max {CONTROL_RADIUS})")
    notch_like = lambda r: r["kind"] == "line" and (r["x2"] - r["x1"]) <= 24 and (r["y2"] - r["y1"]) <= 24
    for arc in rims:
        inner = (arc["x2"] - arc["x1"] + 1) / 2 - max(arc.get("arc_width", 1), 3)
        for r in labels + bordered:
            for p in corners(box(r, r["kind"] == "label")):
                if in_span(angle_of(p), arc["bg_start"], arc["bg_end"]) and \
                        math.dist((CENTER, CENTER), p) > inner - RIM_CLEARANCE:
                    problems.append(f"rim: '{r.get('text', r['kind'])}' within {RIM_CLEARANCE} px of the rim")
                    break

    steppers = [r for r in bordered if (r["x2"] - r["x1"]) < 70 and (r["y2"] - r["y1"]) < 70]

    # faded or disabled controls
    for r in rows:
        if r["kind"] == "obj" and (r["clickable"] or r["border"] > 0) and not full(r):
            if r["disabled"]:
                problems.append(f"faded: disabled control still visible at {box(r)}")
            elif r["opa"] < 255:
                problems.append(f"faded: control at {box(r)} drawn at opacity {r['opa']}")

    # one primary action
    pills = [r for r in bordered if (r["x2"] - r["x1"]) >= 100]
    if len(pills) > 1:
        problems.append(f"primary: {len(pills)} outlined actions: " +
                        ", ".join(next((l["text"] for l in labels if p["id"] in lineage[l["id"]]), "?") for p in pills))
    if steppers and "steppers" not in flags:
        problems.append(f"primary: {len(steppers)} steppers visible outside adjustment")

    # format
    for r in labels:
        t = r["text"]
        if t != "°C" and re.search(r"\d\s*°C", t):
            problems.append(f"format: inline °C in '{t}' (use 93°)")
        in_stepper = any(s["id"] in lineage[r["id"]] for s in steppers)
        if not in_stepper and (re.search(r"(^|\s)[–—-]\s*(g|s|°|bar)?$", t) or t in ("–", "—", "-")):
            problems.append(f"format: placeholder dash in '{t}'")
        if "..." in t:
            problems.append(f"format: three-dot ellipsis in '{t}'")
        m = re.search(r"(\d+(?:\.\d+)?)°?\s*/\s*(\d+(?:\.\d+)?)", t)
        if m and ("." in m.group(1)) != ("." in m.group(2)) and not re.search(r"\d+:\d", t):
            problems.append(f"format: mixed precision in '{t}'")

    # rim numerals and pixel icons
    for r in labels:
        cx, cy = (r["tx1"] + r["tx2"]) / 2, (r["ty1"] + r["ty2"]) / 2
        if re.fullmatch(r"\d+", r["text"]) and math.dist((CENTER, CENTER), (cx, cy)) > 170:
            problems.append(f"rim: gauge numeral '{r['text']}'")
    for r in rows:
        if r["kind"] == "img" and (r["x2"] - r["x1"] + 1) != 217:
            problems.append(f"rim: pixel icon at {box(r)}")

    pattern = TEXT_PATTERNS.get(name)
    if pattern and not any(re.fullmatch(pattern, r["text"]) for r in labels):
        problems.append(f"text: no label matches '{pattern}'")
    return problems


def verify(output):
    failures, count = [], 0
    for case_dir in sorted(p for p in output.iterdir() if p.is_dir()):
        for layout in sorted(case_dir.glob("*.json")):
            _, rows = load(layout)
            problems = check(layout.stem, rows, CHECKPOINT_FLAGS.get(layout.stem, set()))
            count += 1
            for problem in problems:
                failures.append(f"{case_dir.name}/{layout.stem}: {problem}")
    for case, frames in MOTION:
        if not (output / case).is_dir():
            continue
        images = [Image.open(output / case / f"{f}.bmp").convert("RGB") for f in frames]
        before, during, after = images
        if not ImageChops.difference(before, during).getbbox() or not ImageChops.difference(during, after).getbbox():
            failures.append(f"{case}: transition {frames} has no intermediate frame")
        count += 1
    band = rim_band()
    for case, during, after in STEADY:
        if not (output / case).is_dir():
            continue
        moving, still = (Image.open(output / case / f"{f}.bmp").convert("RGB") for f in (during, after))
        light = band_sum(ImageChops.difference(still, Image.new("RGB", still.size, ground(still, band))), band)
        change = band_sum(ImageChops.difference(moving, still), band)
        if light == 0:
            failures.append(f"{case}: {after} shows no rim")
        elif change / light > STEADY_LIMIT:
            failures.append(f"{case}: rim changes {change / light:.0%} while content enters ({during})")
        count += 1
    return count, failures


def rim_band():
    mask = Image.new("L", (2 * CENTER, 2 * CENTER), 0)
    draw = ImageDraw.Draw(mask)
    outer, inner = RIM_BAND[1], RIM_BAND[0]
    draw.ellipse((CENTER - outer, CENTER - outer, CENTER + outer, CENTER + outer), fill=255)
    draw.ellipse((CENTER - inner, CENTER - inner, CENTER + inner, CENTER + inner), fill=0)
    return mask


def band_sum(image, band):
    return sum(ImageStat.Stat(image, band).sum)


def ground(image, band):
    """The commonest colour in the band: the panel behind the rim, whatever the theme."""
    outside = (1, 2, 3)
    masked = Image.composite(image, Image.new("RGB", image.size, outside), band)
    return max(c for c in masked.getcolors(image.width * image.height) if c[1] != outside)[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--case", action="append", choices=[c[0] for c in CASES])
    parser.add_argument("--check-only", action="store_true", help="re-run the checks on an existing --output")
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-rules-"))
    output.mkdir(parents=True, exist_ok=True)
    if not args.check_only:
        for name, script, prefs, profiles in CASES:
            if args.case and name not in args.case:
                continue
            run_case(args.binary.resolve(), output, name, script, prefs, profiles)
            for bmp in (output / name).glob("*.bmp"):
                with Image.open(bmp) as frame:
                    frame.save(bmp.with_suffix(".png"))
    count, failures = verify(output)
    for failure in failures:
        print(failure)
    print(f"Rule checks: {count} checkpoints, {len(failures)} problems. Captures: {output}", flush=True)
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
