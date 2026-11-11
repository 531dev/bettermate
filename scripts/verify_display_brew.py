#!/usr/bin/env python3
"""Exercise Brew/Status controls, themes, pressure capability fallback, and shot lifecycles.

Profile adjustment focuses one value at a time: the slots below the focused value bring temperature,
pressure or output into focus, -/+ change it, and SAVE opens a sheet (SAVE / SAVE AS NEW / USE ONCE).

Build with `pio run -e display-sim` first. Every case runs in isolated simulator state.
"""

import argparse
import copy
import json
import math
from pathlib import Path
import re
import tempfile

from PIL import Image, ImageChops
from verify_display_standby import ROOT, run_case


def polar(angle, radius):
    """Panel pixel at an LVGL angle (0 = 3 o'clock, clockwise) and radius from the centre."""
    return (round(240 + radius * math.cos(math.radians(angle))), round(240 + radius * math.sin(math.radians(angle))))


PHASE_TRACK = 211  # radius of the shot's phase segments (Status)
RIM = 226          # radius of the data rims (temperature, pressure)


def rim_drawn(frame, angle):
    """Whether a rim track or value is drawn at this angle."""
    background = frame.getpixel(polar(angle, 215))
    return any(frame.getpixel(polar(angle, r)) != background for r in range(224, 231))


def labels(path):
    """Visible label texts from a `layout` capture."""
    rows = [json.loads(line) for line in path.read_text().splitlines()[1:] if line.strip()]
    return rows, [r["text"] for r in rows if r["kind"] == "label"]


def modes_control(rows):
    """The ^ control: a clickable target centred at (240, 450)."""
    return any(r["kind"] == "obj" and r["clickable"] and abs((r["x1"] + r["x2"]) / 2 - 240) <= 2 and
               abs((r["y1"] + r["y2"]) / 2 - 450) <= 2 for r in rows)

PRESSURE_PROFILE = {
    "id": "pressure", "label": "Pressure curve", "type": "pro", "temperature": 93, "dose": 18,
    "phases": [
        {"name": "Preinfuse", "phase": "preinfusion", "valve": 1, "duration": 3, "pump": 20},
        {"name": "Ramp", "phase": "brew", "valve": 1, "duration": 5,
         "pump": {"target": "pressure", "pressure": 6, "flow": 0},
         "transition": {"type": "linear", "duration": 3, "adaptive": False}},
        {"name": "Brew", "phase": "brew", "valve": 1, "duration": 20,
         "pump": {"target": "pressure", "pressure": 9, "flow": 0.2},
         "transition": {"type": "ease-out", "duration": 2, "adaptive": False},
         "targets": [{"type": "volumetric", "operator": "gte", "value": 36}]},
    ],
}
POWER_PROFILE = copy.deepcopy(PRESSURE_PROFILE)
POWER_PROFILE.update(id="power", label="Power profile", type="standard")
POWER_PROFILE["phases"][-1]["pump"] = 80
FLOW_PROFILE = copy.deepcopy(PRESSURE_PROFILE)
FLOW_PROFILE.update(id="flow", label="Flow profile")
FLOW_PROFILE["phases"][-1]["pump"] = {"target": "flow", "pressure": 3, "flow": 4}


CASES = [
    ("pressure-profile", """
        scale 1; wait 3000; tap 240 240; wait 300; tap 240 216; wait 700;
        expect screen 2; expect text BREW · HEATING TO 93°; expect hidden CURRENT TEMP; expect hidden PRESSURE;
        expect hidden bar; expect text °C; expect hidden 93° · 18 → 36 g · 28 s;
        expect hidden TARGET TEMPERATURE; expect hidden EDIT; expect hidden MODES;
        expect text Pressure curve; expect hidden UNSAVED; expect text TARE;
        tap 404 210; tap 76 210; wait 300; expect temperature 93; expect active 0;
        shot live-dark.bmp; theme 1; wait 2200; shot live-light.bmp; theme 2; wait 2200; shot live-amoled.bmp;
        theme 0; wait 300; tap 240 450; wait 500; expect screen 4; tap 240 216; wait 700;
        tap 240 310; wait 900; expect screen 7; expect text EDIT;
        tap 240 392; wait 700; expect screen 7; expect text ADJUST; expect text TEMPERATURE; expect text 9.0 bar;
        expect text 36 g; expect hidden SAVE;
        shot profile-adjust.bmp; tap 384 182; wait 300; tap 160 322; wait 500; expect text PRESSURE;
        tap 384 182; wait 300; tap 320 322; wait 500; expect text OUTPUT; tap 384 182; wait 700;
        expect temperature 94; expect text 94°; expect text 9.5 bar; expect target-weight 37; expect text 37.0;
        expect text UNSAVED; expect text SAVE; shot profile-edited.bmp;
        tap 240 450; wait 700; expect screen 7; expect text 94° · 18 → 37 g · 28 s;
        tap 240 392; wait 700; expect text 9.5 bar; tap 240 392; wait 500; expect text Save changes;
        expect text SAVE AS NEW; expect text USE ONCE; shot save-sheet.bmp; tap 240 346; wait 900;
        expect screen 2; expect text UNSAVED; expect text Pressure curve; expect temperature 94;
        tap 240 310; wait 900; tap 240 392; wait 700; expect text 9.5 bar;
        tap 240 392; wait 500; tap 240 222; wait 900; expect screen 2; expect hidden UNSAVED;
        tap 240 310; wait 900; tap 240 392; wait 700; tap 160 322; wait 500; tap 96 182; wait 300;
        tap 160 322; wait 700; expect text 9.0 bar; tap 240 392; wait 500; tap 240 290; wait 900;
        expect screen 2; expect text Copy of Pressure curve;
        expect active 0; expect temperature 94; quit
    """, {"sp": "pressure", "wl_temp": "0", "wl_flush": "0"}, [PRESSURE_PROFILE]),
    ("pressure-power", """
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 700;
        tap 240 310; wait 900; tap 240 392; wait 700; expect text Add; expect text TIME; expect text 28 s;
        tap 160 322; wait 700; expect text PRESSURE; expect text 9.0; expect text bar; expect text UNSAVED;
        tap 384 182; tap 384 182; tap 384 182; tap 384 182; tap 384 182; tap 384 182;
        tap 384 182; wait 700; expect text 12.0; shot pressure-limit.bmp;
        tap 96 182; tap 96 182; tap 96 182; tap 96 182; tap 96 182; tap 96 182;
        wait 700; expect text 9.0; tap 160 322; wait 700; expect text 9.0 bar;
        tap 240 392; wait 500; tap 240 222; wait 900; expect screen 2; expect active 0; quit
    """, {"sp": "power", "wl_temp": "0", "wl_flush": "0"}, [POWER_PROFILE]),
    ("pressure-flow", """
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 700;
        tap 240 310; wait 900; tap 240 392; wait 700; expect text TEMPERATURE; expect text TIME;
        expect hidden PRESSURE; expect hidden Add; tap 160 322; tap 320 322; wait 500;
        expect text TEMPERATURE; expect hidden PRESSURE; expect text ADJUST;
        tap 384 182; wait 500; expect temperature 94; tap 240 322; wait 700; expect text TIME; expect text 94°;
        expect hidden PRESSURE; expect hidden Add; shot flow-profile.bmp;
        tap 240 392; wait 500; tap 240 222; wait 900;
        expect screen 2; expect active 0;
        tap 240 310; wait 900; swipe 370 224 110 224 600; wait 700; expect text Pressure curve;
        tap 240 392; wait 700; expect text 9.0 bar; expect temperature 93;
        tap 384 182; wait 300; tap 160 322; wait 500; tap 384 182; wait 300; tap 160 322; wait 700;
        expect temperature 94; expect text 9.5 bar;
        tap 240 392; wait 500; tap 240 222; wait 900; expect screen 2; expect text Pressure curve; quit
    """, {"sp": "flow", "fp": "pressure,flow,power", "wl_temp": "0", "wl_flush": "0"},
     [FLOW_PROFILE, PRESSURE_PROFILE, POWER_PROFILE]),
    ("themes-profile", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 1000; expect screen 2; expect text START;
        expect text Default; shot brew-dark.bmp;
        theme 1; wait 2200; shot brew-light.bmp; theme 2; wait 2200; shot brew-amoled.bmp;
        tap 240 70; wait 300; expect screen 2; expect text BREW · HEATING TO 93°; expect hidden Warnings;
        expect hidden Flush recommended; expect hidden Temperature unstable; shot readiness.bmp;
        tap 240 310; wait 900; tap 240 392; wait 700; expect text ADJUST; expect temperature 93; expect duration 28;
        expect hidden SAVE; tap 240 392; wait 500; expect text ADJUST; expect hidden Save changes;
        tap 384 182; wait 300; expect temperature 94; tap 96 182; wait 300; expect temperature 93;
        tap 320 322; wait 500; expect text TIME; tap 384 182; wait 300; expect duration 29;
        tap 96 182; wait 300; expect duration 28; shot adjust-timed.bmp;
        tap 240 392; wait 500; tap 240 346; wait 900; expect text START; expect text UNSAVED;
        tap 240 310; wait 900; tap 240 392; wait 700; tap 384 182; wait 300;
        tap 240 392; wait 500; tap 240 222; wait 900; expect text START; expect temperature 94;
        tap 240 310; wait 900; tap 240 392; wait 700; tap 96 182; wait 300;
        tap 240 392; wait 500; tap 240 290; wait 900;
        expect text Copy of Default; expect temperature 93; shot copied-profile.bmp;
        tap 240 310; wait 900; expect screen 7; shot stock-profile.bmp;
        tap 240 450; wait 500; expect screen 4; expect active 0;
        tap 240 216; wait 500; expect screen 2; expect text START;
        tap 240 450; wait 500; expect screen 4; tap 240 442; wait 500; expect screen 1;
        tap 240 240; wait 500; tap 240 216; wait 500; expect screen 2; expect text START; quit
    """, None),
    ("single-ring", """
        wait 3000; pressure-sensor 0; wait 500; tap 240 240; wait 500; tap 240 216; wait 1000;
        expect screen 2; expect text START; shot brew-single-dark.bmp;
        theme 1; wait 2200; shot brew-single-light.bmp; theme 2; wait 2200; shot brew-single-amoled.bmp;
        tap 240 310; wait 900; tap 240 392; wait 700; expect text TIME; expect hidden Add; expect hidden PRESSURE;
        tap 240 322; wait 700; expect text TIME; expect hidden PRESSURE; expect hidden Add;
        tap 384 182; wait 300; expect duration 29;
        tap 240 392; wait 500; tap 240 346; wait 900; tap 240 392; wait 1200; expect screen 3; expect active 1;
        expect hidden PRESSURE; layout status-single.json; shot status-single.bmp;
        swipe 240 290 240 120; wait 500; expect screen 3; expect active 1;
        tap 240 450; wait 300; expect screen 3; expect active 1;
        tap 240 392; wait 700; expect screen 2; expect active 0;
        tap 240 450; wait 500; expect screen 4;
        tap 240 216; wait 500; expect screen 2; expect text START;
        pressure-sensor 1; wait 700; expect text START; shot restored-dual.bmp; quit
    """, None),
    ("volumetric", """
        scale 1; wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; weight 8.5; wait 300;
        expect text 8.5 g; expect text TARE; shot brew-scale.bmp;
        tap 126 392; wait 300; expect text 0.0 g;
        expect target-weight 36;
        tap 240 310; wait 900; tap 240 392; wait 700; expect text 36 g; tap 320 322; wait 700;
        expect text OUTPUT; expect text USE TIME; expect text 36.0; shot adjust-weight.bmp;
        tap 384 182; wait 300; expect target-weight 37; tap 96 182; wait 300; expect target-weight 36;
        tap 240 392; wait 500; tap 240 222; wait 900; tap 240 392; wait 1200; expect screen 3; expect active 1;
        layout status-weight.json; shot status-weight.bmp; theme 1; wait 2200; shot status-weight-light.bmp;
        theme 2; wait 2200; shot status-weight-amoled.bmp;
        weight 50; wait 250; expect active 0; expect text Calibrating; shot calibrating.bmp;
        wait 6000; expect screen 3; expect active 0; expect text SHOT COMPLETE; expect text DONE;
        layout finished-weight.json; shot finished-weight.bmp; theme 0; wait 2200; shot finished-weight-dark.bmp;
        theme 1; wait 2200; shot finished-weight-light.bmp; theme 2; wait 2200; shot finished-weight-amoled.bmp;
        tap 240 392; wait 700; expect screen 2;
        tap 240 310; wait 900; tap 240 392; wait 700; tap 320 322; wait 500; tap 240 266; wait 700;
        expect text TIME; expect hidden OUTPUT; expect hidden USE TIME; expect target-weight 0;
        shot removed-weight.bmp; tap 240 392; wait 500; tap 240 346; wait 900;
        scale 0; wait 2000; tap 240 392; wait 1000; expect screen 3; expect active 1;
        tap 240 392; wait 700; expect screen 2; expect active 0; quit
    """, None),
    ("timed-finished", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 392; wait 3000;
        expect screen 3; expect active 1; expect hidden SHOT TIME; expect text STOP; expect text Default;
        expect text Brew; expect hidden SHOT COMPLETE;
        expect hidden Flush recommended; expect hidden Temperature unstable; expect hidden STOP & MODES; expect hidden MODES;
        tap 240 32; wait 300; expect hidden Warnings; expect screen 3; expect active 1;
        layout status-running.json; shot status-dark.bmp;
        theme 1; wait 2200; shot status-light.bmp; theme 2; wait 2200; shot status-amoled.bmp;
        wait 23600; expect screen 3; expect active 0; expect text 0:28; expect text SHOT COMPLETE; expect text DONE;
        expect hidden STOP & MODES; expect hidden Flush recommended;
        layout finished-timed.json; shot finished-timed.bmp; tap 240 392; wait 700; expect screen 2;
        tap 240 392; wait 1000; expect screen 3; expect active 1;
        tap 240 392; wait 700; expect screen 2; expect active 0; quit
    """, None),
    ("warning-confirm", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700;
        expect text BREW · HEATING TO 93°; expect hidden Temperature unstable; expect hidden Flush recommended;
        tap 240 70; wait 300; expect screen 2; expect hidden Warnings; expect text BREW · HEATING TO 93°;
        tap 240 392; wait 500;
        expect screen 2; expect active 0; expect text Confirm brew; expect text Temperature unstable;
        expect text Flush recommended; expect text CANCEL; shot confirm.bmp;
        tap 240 450; swipe 240 300 240 120; wait 500; expect screen 2; expect active 0; expect text Confirm brew;
        tap 240 414; wait 300; expect hidden Confirm brew;
        tap 240 392; wait 300; tap 240 352; wait 1000; expect screen 3; expect active 1;
        expect hidden Confirm brew; tap 240 392; wait 700; expect screen 2; expect active 0;
        tap 240 392; wait 300; expect text Confirm brew;
        controller disconnected; wait 500; tap 240 352; wait 500; expect active 0;
        controller connected; wait 1000; tap 240 240; wait 500; tap 240 216; wait 700; tap 240 392; wait 300;
        expect text Confirm brew;
        error 4; wait 500; expect screen 1; expect active 0; quit
    """, {"wl_temp": "2", "wl_flush": "2"}),
    ("hold-flush", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; hold 240 392 1200; wait 200;
        expect screen 3; expect active 1; shot flush-draining.bmp;
        wait 5000; expect screen 2; expect active 0;
        wait 2000; expect screen 2; expect active 0; expect text START; quit
    """, {"fl_dur": "0"}),
    ("timed-flush", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 700; hold 240 392 700; wait 500;
        expect screen 3; expect active 1; shot timed-flush.bmp;
        wait 7000; expect screen 2; expect active 0; expect text START; quit
    """, {"fl_dur": "3"}),
    ("heating-pulse", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 1000; expect text BREW · HEATING TO 93°; shot pulse-a.bmp;
        wait 500; shot pulse-b.bmp; expect screen 2; expect active 0;
        tap 240 215; wait 500; expect screen 2; expect active 0; tap 240 450; wait 500; expect screen 4; quit
    """, {"wl_temp": "0", "wl_flush": "0"}),
    ("phased-shot", """
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 500; tap 240 392; wait 1000;
        expect screen 3; expect active 1; expect text Adaptive v2; expect text Preinfuse; expect text STOP;
        shot status-infusion.bmp; wait 3000; expect text Bloom; shot status-bloom.bmp;
        wait 5000; expect text Ramp to 9 bar; shot status-ramp.bmp;
        wait 6500; expect active 0; expect text SHOT COMPLETE; expect text 0:14; expect text DONE;
        shot phased-complete.bmp; wait 2000; shot phased-complete-later.bmp;
        tap 240 392; wait 700; expect screen 2; quit
    """, {"sp": "adaptive", "wl_temp": "0"}, [
        {"id": "adaptive", "label": "Adaptive v2", "type": "standard", "temperature": 93, "dose": 18,
         "phases": [
             {"name": "Preinfuse", "phase": "preinfusion", "duration": 3, "valve": 1, "pump": 30},
             {"name": "Bloom", "phase": "preinfusion", "duration": 5, "valve": 0, "pump": 0},
             {"name": "Ramp to 9 bar", "phase": "brew", "duration": 6, "valve": 1, "pump": 100},
         ]},
    ]),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path, help="New directory for captures and isolated state")
    parser.add_argument("--case", choices=[case[0] for case in CASES], help="Run one case")
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-brew-"))
    output.mkdir(parents=True, exist_ok=True)
    print(f"Captures: {output}", flush=True)
    assertions = 0
    for case in CASES:
        name, script, preferences = case[:3]
        profiles = case[3] if len(case) > 3 else None
        if args.case and name != args.case:
            continue
        run_case(args.binary.resolve(), output, name, script, preferences, profiles)
        assertions += script.count("expect ")
        for bmp in (output / name).glob("*.bmp"):
            with Image.open(bmp) as frame:
                frame.save(bmp.with_suffix(".png"))

    # Saving and copying must persist the edited profile and favorite its new ID.
    if not args.case or args.case == "themes-profile":
        case = output / "themes-profile" / "sim_data"
        profiles = [json.loads(path.read_text()) for path in (case / "littlefs" / "p").glob("*.json")]
        assert any(p.get("label") == "Default" and p.get("temperature") == 94 for p in profiles)
        assert any(p.get("label") == "Copy of Default" and p.get("temperature") == 93 for p in profiles)
        assertions += 2
    for name, source in [("pressure-profile", PRESSURE_PROFILE), ("pressure-power", POWER_PROFILE),
                         ("pressure-flow", FLOW_PROFILE)]:
        if args.case and args.case != name:
            continue
        directory = output / name / "sim_data/littlefs/p"
        saved = json.loads((directory / f"{source['id']}.json").read_text())
        assert saved["dose"] == source["dose"]
        assert saved["type"] == source["type"]
        # Editing the final Brew setpoint must preserve preinfusion, earlier pressure phases and transitions.
        for before, after in zip(source["phases"], saved["phases"]):
            assert after["duration"] == before["duration"]
            assert after["valve"] == before["valve"]
            if "transition" in before:
                for key, value in before["transition"].items():
                    assert after["transition"][key] == value
        assert saved["phases"][0]["pump"] == source["phases"][0]["pump"]
        assert saved["phases"][1]["pump"] == source["phases"][1]["pump"]
        if name == "pressure-profile":
            assert saved["temperature"] == 94
            assert saved["phases"][-1]["pump"] == {"target": "pressure", "pressure": 9.5, "flow": 0.2}
            assert saved["phases"][-1]["targets"][0]["value"] == 37
            copies = [json.loads(path.read_text()) for path in directory.glob("*.json") if path.stem != source["id"]]
            assert len(copies) == 1 and copies[0]["label"] == "Copy of Pressure curve"
            assert copies[0]["phases"][-1]["pump"]["pressure"] == 9
            assert copies[0]["dose"] == 18
        elif name == "pressure-power":
            assert saved["phases"][-1]["pump"] == {"target": "pressure", "pressure": 9, "flow": 0}
        else:
            assert saved["temperature"] == 94
            assert saved["phases"][-1]["pump"] == source["phases"][-1]["pump"]
            edited = json.loads((directory / "pressure.json").read_text())
            assert edited["temperature"] == 94 and edited["phases"][-1]["pump"]["pressure"] == 9.5
        assertions += 1
    if not args.case or args.case == "heating-pulse":
        # The status line's dot sits left of "BREW · HEATING TO 93°" and pulses while heating.
        frames = [Image.open(output / "heating-pulse" / name).convert("RGB").crop((136, 58, 158, 82))
                  for name in ("pulse-a.png", "pulse-b.png")]
        assert ImageChops.difference(*frames).getbbox(), "Heating status dot must pulse"
        pixels = (frame.getpixel((x, y)) for frame in frames
                  for y in range(frame.height) for x in range(frame.width))
        assert any(r > 140 and g > 100 and b < 150 for r, g, b in pixels), "Gold heating dot missing"
        assertions += 2
    if not args.case or args.case == "single-ring":
        case = output / "single-ring"
        with Image.open(case / "brew-single-amoled.png").convert("RGB") as single, \
                Image.open(case / "restored-dual.png").convert("RGB") as dual:
            # Without a pressure sensor temperature keeps the whole dial; the sensor restores the right rim.
            assert rim_drawn(single, 270) and not rim_drawn(single, 60), "Single ring must sweep the whole dial"
            assert rim_drawn(dual, 60) and not rim_drawn(dual, 270), "Pressure rim must return with the sensor"
        _, texts = labels(case / "status-single.json")
        assert not any(text.endswith(" bar") for text in texts), "No live pressure without a sensor"
        assertions += 3
    if not args.case or args.case == "timed-finished":
        case = output / "timed-finished"
        for name in ("status-dark.png", "status-light.png", "status-amoled.png"):
            with Image.open(case / name).convert("RGB") as frame:
                # The Stop action must retain a visible outline in every theme.
                assert frame.getpixel((240, 364)) != frame.getpixel((240, 370)), name
                assertions += 1
        running, texts = labels(case / "status-running.json")
        assert any(re.fullmatch(r"\d+\.\d bar", text) for text in texts), "Live pressure missing while running"
        assert not modes_control(running), "Modes control must stay hidden while the shot runs"
        finished, texts = labels(case / "finished-timed.json")
        assert modes_control(finished), "Modes control must return when the shot is complete"
        assert not any(text.endswith(" bar") for text in texts), "Live pressure must leave with the finished shot"
        assertions += 4
    if not args.case or args.case == "phased-shot":
        case = output / "phased-shot"
        with Image.open(case / "status-infusion.png").convert("RGB") as frame:
            assert frame.getpixel(polar(138, PHASE_TRACK)) != frame.getpixel(polar(42, PHASE_TRACK)), \
                "Time arc must fill from the left"
            infusion_pressure = frame.getpixel(polar(165, RIM))
        with Image.open(case / "status-bloom.png").convert("RGB") as frame:
            assert frame.getpixel(polar(165, RIM)) != infusion_pressure, "Pressure arc must fall when the pump pauses"
            bloom_time = frame.getpixel(polar(280, PHASE_TRACK))
        with Image.open(case / "status-ramp.png").convert("RGB") as frame:
            assert frame.getpixel(polar(280, PHASE_TRACK)) != bloom_time, "Time arc must continue across phase changes"
        with Image.open(case / "phased-complete.png").convert("RGB") as frame:
            # On completion the phase segments fade with the rim; none may stay partly filled.
            assert frame.getpixel(polar(138, PHASE_TRACK)) == frame.getpixel(polar(42, PHASE_TRACK)), \
                "Completed shot must not leave a partial time arc"
        timers = [Image.open(case / name).crop((60, 150, 420, 272))
                  for name in ("phased-complete.png", "phased-complete-later.png")]
        assert not ImageChops.difference(*timers).getbbox(), "Completed timer must stay frozen"
        assertions += 5
    if not args.case or args.case == "volumetric":
        case = output / "volumetric"
        _, texts = labels(case / "status-weight.json")
        assert any(re.fullmatch(r"\d+\.\d / 36\.0 g", text) for text in texts), "Weight / target missing while running"
        _, texts = labels(case / "finished-weight.json")
        summary = [float(m.group(1)) for m in map(re.compile(r"(\d+\.\d) g").fullmatch, texts) if m]
        assert summary and summary[0] >= 50 and not any(" / " in text for text in texts), \
            f"Weighed shot summary missing: {texts}"
        with Image.open(case / "calibrating.png").convert("RGB") as calibrating, \
                Image.open(case / "finished-weight.png").convert("RGB") as finished:
            # A weight-based finish freezes elapsed time. The phase ring of a weighed phase follows the weight, so it
            # may fill at the target; on completion it fades with the rim and no filled arc remains.
            assert len({finished.getpixel(polar(a, PHASE_TRACK)) for a in (150, 210, 270, 330, 30)}) == 1, \
                "The completed shot must not show a filled time arc"
            assert not ImageChops.difference(calibrating.crop((60, 150, 420, 272)),
                                             finished.crop((60, 150, 420, 272))).getbbox(), \
                "A weight-based finish must freeze elapsed time"
        assertions += 4
    print(f"Brew/Status checks passed: {assertions} assertions. Captures: {output}", flush=True)


if __name__ == "__main__":
    main()
