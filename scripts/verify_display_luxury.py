#!/usr/bin/env python3
"""Check the minimal-luxury Standby, mode selector, Brew and profile wheel using the real LVGL simulator."""
import argparse
import datetime
import json
from pathlib import Path
import tempfile

from PIL import Image, ImageChops
from verify_display_standby import ROOT, run_case

PROFILE = {"id": "adaptive", "label": "Adaptive v2", "type": "standard", "temperature": 93,
           "phases": [{"name": "Brew", "phase": "brew", "valve": 1, "duration": 28, "pump": 100,
                       "targets": [{"type": "volumetric", "operator": "gte", "value": 36}]}]}
QUIET = {"sp": "adaptive", "wl_temp": "0", "wl_flush": "0"}
CASES = [
    ("appearance", """
        wait 3000; expect screen 1; expect mode 0; expect text STANDBY; expect text WAKE;
        shot standby-dark.bmp; theme 1; wait 2200; shot standby-light.bmp;
        theme 2; wait 2200; shot standby-amoled.bmp; theme 0; wait 2200;
        tap 240 400; wait 500; expect screen 4; expect mode 1; expect active 0;
        expect text Grind; expect text Brew; expect text Steam;
        expect hidden TEMP; expect hidden PRESSURE; expect hidden Adaptive v2 · 36 g · 28 s; shot modes-dark.bmp;
        theme 1; wait 2200; shot modes-light.bmp; theme 2; wait 2200; shot modes-amoled.bmp;
        theme 0; wait 500; wifi disconnected; wait 500; tap 240 34; wait 500; expect screen 9;
        wifi sta; wait 500; tap 240 450; wait 500; expect screen 4; tap 240 442; wait 500;
        expect screen 1; expect mode 0; expect active 0; quit
    """, QUIET),
    ("navigation", """
        wait 3000; tap 240 240; wait 500; expect screen 4;
        swipe 240 294 240 216 600; wait 700; expect screen 4; expect mode 1; expect active 0;
        shot modes-grind-focus.bmp; tap 240 216; wait 500; expect screen 8; expect mode 4;
        tap 240 450; wait 500; expect screen 4;
        tap 240 372; wait 500; expect screen 5; expect mode 2;
        tap 240 450; wait 500; expect screen 4;
        swipe 240 294 240 216 600; wait 700; tap 240 372; wait 500;
        expect screen 6; expect mode 3; tap 240 450; wait 500; expect screen 4;
        tap 240 216; wait 500; expect screen 2; expect mode 1; expect active 0;
        tap 240 312; wait 500; expect screen 7; expect text Adaptive v2;
        tap 240 450; wait 500; expect screen 4;
        swipe 240 390 240 90 300; wait 900; expect screen 4; expect mode 1; expect active 0;
        expect text Info; expect text Water; shot modes-info-focus.bmp;
        swipe 240 320 240 120 250; wait 700; expect screen 4; expect active 0;
        tap 240 216; wait 500; expect screen 9; expect text GaggiMate-Sim;
        tap 240 450; wait 500; expect screen 4;
        swipe 240 140 240 350 250; wait 700; tap 240 216; wait 500;
        expect screen 2; expect mode 1; tap 240 450; wait 500; expect screen 4;
        controller disconnected; wait 500; expect screen 1; expect mode 0;
        tap 240 400; wait 500; expect screen 1; expect mode 0; expect active 0; quit
    """, QUIET),
    ("single-sensor", """
        pressure-sensor 0; wait 3000; tap 240 240; wait 500; expect screen 4;
        expect hidden PRESSURE; expect hidden Grind; expect text Brew; expect text Steam; expect text Water;
        shot modes-three.bmp;
        swipe 240 294 240 216 600; wait 700; swipe 240 294 240 216 600; wait 700;
        expect screen 4; expect mode 1; expect active 0; shot modes-water-focus.bmp;
        tap 240 216; wait 500; expect screen 6; expect mode 3;
        tap 240 450; wait 500; expect screen 4; tap 240 442; wait 500;
        expect screen 1; expect mode 0; quit
    """, dict(QUIET, alt_relay="0")),
    ("warnings", """
        wait 3000; tap 240 240; wait 500; expect screen 4;
        expect hidden Warnings; shot modes-warnings.bmp;
        swipe 370 224 310 224 600; wait 700;
        expect hidden Warnings; expect text Brew; expect mode 1; expect active 0;
        swipe 370 224 110 224 600; shot warning-slide-a.bmp;
        wait 80; shot warning-slide-b.bmp; wait 700; expect text Warnings;
        expect text Temperature unstable; expect text Flush recommended;
        expect text ERROR; expect text WARN; expect hidden Brew; shot warning-details.bmp;
        tap 240 216; swipe 240 330 240 120; wait 400;
        expect screen 4; expect active 0; expect text Warnings;
        swipe 370 224 110 224 600; wait 700; expect text Warnings; expect screen 4;
        theme 1; wait 2200; shot warning-details-light.bmp; theme 2; wait 2200;
        shot warning-details-amoled.bmp; theme 0; wait 2200;
        swipe 110 224 370 224 600; wait 700; expect hidden Warnings; expect text Brew;
        swipe 370 224 110 224 600; wait 700; expect text Warnings;
        tap 240 450; shot warning-return-a.bmp; wait 80; shot warning-return-b.bmp;
        wait 700; expect hidden Warnings; expect text Brew; shot warning-returned.bmp;
        tap 240 34; wait 900; expect text Warnings; tap 240 450; wait 700; expect hidden Warnings;
        tap 240 216; wait 500; expect screen 2; tap 240 392; wait 400;
        expect screen 2; expect active 0; expect text Confirm brew;
        tap 240 414; wait 300; tap 240 450; wait 400; expect screen 4;
        tap 240 442; wait 400; expect screen 1; expect mode 0; quit
    """, dict(QUIET, wl_temp="2", wl_flush="1")),
    ("warnings-clear", """
        wait 3000; tap 240 240; wait 500; expect screen 4;
        swipe 110 224 370 224 600; wait 700; expect screen 4; expect text Brew; expect active 0;
        swipe 240 294 240 216 600; wait 700; expect screen 4; expect mode 1; shot warnings-grind-focus.bmp;
        swipe 370 224 110 224 600; wait 700; expect text All clear; expect hidden Brew;
        expect hidden ERROR; expect hidden WARN; expect mode 1; expect active 0; shot warnings-clear-dark.bmp;
        theme 1; wait 2200; shot warnings-clear-light.bmp; theme 2; wait 2200; shot warnings-clear-amoled.bmp;
        theme 0; wait 2200; swipe 110 224 370 224 600; wait 700; expect hidden All clear; expect text Grind;
        shot warnings-grind-returned.bmp;
        tap 240 216; wait 400; expect screen 8; expect mode 4;
        tap 240 450; wait 400; expect screen 4; expect text Brew;
        swipe 320 52 80 52 160; wait 700; expect text All clear; expect screen 4;
        tap 240 450; controller disconnected; wait 500; expect screen 1; expect active 0;
        controller connected; wait 700; tap 240 240; wait 500;
        expect screen 4; expect text Brew; expect hidden All clear;
        tap 240 442; wait 400; expect screen 1; expect mode 0; quit
    """, QUIET),
    ("fault-guards", """
        wait 3000; controller disconnected; wait 700; shot standby-disconnected.bmp;
        tap 240 400; wait 300; expect screen 1; expect mode 0; expect active 0;
        controller connected; wait 700; protocol 4; wait 700; shot standby-mismatch.bmp;
        tap 240 240; wait 300; expect screen 1; expect mode 0; expect active 0;
        protocol 3; wait 700; error 4; wait 700; shot standby-error.bmp;
        tap 240 240; wait 300; expect screen 1; expect mode 0; expect active 0;
        error 0; wait 700; tap 240 240; wait 400; expect screen 4; expect mode 1; quit
    """, QUIET),
]


BREW_PROFILES = []
for ident, label in [("lungo", "Lungo"), ("classic", "Classic 9 bar"), ("adaptive", "Adaptive v2"),
                     ("turbo", "Turbo"), ("bloom", "Bloom"), ("lever", "Lever"), ("ristretto", "Ristretto")]:
    recipe = dict(PROFILE, id=ident, label=label, dose=18)
    if ident == "adaptive":
        recipe["type"] = "pro"
        recipe["phases"] = [
            {"name": "Preinfuse", "phase": "preinfusion", "valve": 1, "duration": 3, "pump": 20},
            {"name": "Bloom", "phase": "preinfusion", "valve": 1, "duration": 5, "pump": 0},
            {"name": "Ramp to 9 bar", "phase": "brew", "valve": 1, "duration": 20,
             "pump": {"target": "pressure", "pressure": 9, "flow": 0},
             "transition": {"type": "linear", "duration": 5, "adaptive": False},
             "targets": [{"type": "volumetric", "operator": "gte", "value": 36}]},
        ]
    BREW_PROFILES.append(recipe)

CASES.append(("brew-wheel", """
    wait 3000; tap 240 240; wait 400; tap 240 216; wait 500; expect screen 2;
    expect text START; expect hidden IN 18 g · OUT 36 g · 28 s; expect hidden CURRENT TEMP; expect hidden PRESSURE;
    expect text °C; expect hidden bar; expect text BREW · HEATING TO 93°;
    tap 404 210; wait 300; expect temperature 93;
    tap 76 210; wait 300; expect temperature 93;
    tap 240 312; wait 400; expect screen 7; expect text PROFILES; expect text Lungo;
    swipe 370 224 110 224 600; wait 700; expect text Classic 9 bar; expect hidden Lungo;
    swipe 370 224 110 224 600; wait 700; expect text Adaptive v2; expect hidden Classic 9 bar;
    expect text 93° · 18 → 36 g · 28 s; expect text Preinfuse · Bloom · Ramp to 9 bar;
    shot profile-wheel-dark.bmp; theme 1; wait 2200; shot profile-wheel-light.bmp;
    theme 2; wait 2200; shot profile-wheel-amoled.bmp;
    swipe 110 224 370 224 600; wait 700; expect text Classic 9 bar; expect hidden Adaptive v2;
    swipe 370 224 110 224 600; wait 700; expect text Adaptive v2; expect hidden Classic 9 bar;
    tap 240 224; wait 500; expect screen 2; expect text Adaptive v2; expect temperature 93;
    shot brew-amoled.bmp; theme 1; wait 2200; shot brew-light.bmp;
    theme 0; wait 2200; shot brew-dark.bmp;
    tap 240 312; wait 300; tap 240 392; wait 300; expect text ADJUST;
    tap 384 182; wait 300; expect temperature 94; expect text UNSAVED;
    tap 240 392; wait 300; expect text Save changes; tap 240 222; wait 300;
    expect screen 2; expect temperature 94;
    tap 240 312; wait 300; expect text PROFILES; expect text Adaptive v2;
    expect text 94° · 18 → 36 g · 28 s;
    tap 240 450; wait 300; expect screen 4; expect active 0; quit
""", dict(QUIET, sp="lungo", fp="lungo,classic,adaptive,turbo,bloom,lever,ristretto,adaptive"), BREW_PROFILES))


def verify_warning_animation(directory):
    checks = 0
    for names in [("modes-warnings", "warning-slide-a", "warning-slide-b", "warning-details"),
                  ("warning-details", "warning-return-a", "warning-return-b", "warning-returned")]:
        frames = []
        for name in names:
            with Image.open(directory / f"{name}.bmp") as capture:
                frames.append(capture.convert("RGB").crop((40, 66, 440, 360)))
        for before, after in zip(frames, frames[1:]):
            assert ImageChops.difference(before, after).getbbox(), "Warnings must slide across intermediate frames"
            checks += 1
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--case", choices=[c[0] for c in CASES] + ["clock-rest"])
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-luxury-"))
    output.mkdir(parents=True, exist_ok=True)
    count = 0
    for case in CASES:
        name, script, prefs = case[:3]
        if args.case and args.case != name:
            continue
        run_case(args.binary.resolve(), output, name, script, prefs, case[3] if len(case) == 4 else [PROFILE])
        count += script.count("expect ")
        if name == "warnings":
            count += verify_warning_animation(output / name)
        if name == "warnings-clear":
            with Image.open(output / name / "warnings-grind-focus.bmp") as before, \
                    Image.open(output / name / "warnings-grind-returned.bmp") as after:
                region = (70, 130, 410, 390)
                assert not ImageChops.difference(before.crop(region), after.crop(region)).getbbox(), \
                    "Returning from warnings must preserve the mode picker's focus and position"
                count += 1
    if not args.case or args.case == "clock-rest":
        days = ["0"] * 7
        days[(datetime.datetime.now(datetime.timezone.utc).weekday() + 3) % 7] = "1"
        script = """
            wait 3000; expect text STANDBY; shot standby-12h.bmp;
            wait 31000; expect screen 1; expect mode 0; expect hidden WAKE; expect hidden STANDBY;
            shot standby-rest.bmp; wait 61000; shot standby-drift.bmp;
            tap 50 240; wait 500; expect screen 4; expect mode 1; expect active 0;
            tap 240 442; wait 500; expect screen 1; expect text WAKE; shot standby-rest-reset.bmp; quit
        """
        prefs = dict(QUIET, theme="2", clk_24h="0", ab_en="1", ab_schedules=f"07:00|{''.join(days)}")
        run_case(args.binary.resolve(), output, "clock-rest", script, prefs, case[3] if len(case) == 4 else [PROFILE])
        count += script.count("expect ")
        before = Image.open(output / "clock-rest/standby-rest.bmp")
        after = Image.open(output / "clock-rest/standby-drift.bmp")
        assert ImageChops.difference(before, after).getbbox(), "AMOLED clock must drift"
        count += 1
    if not args.case or args.case == "brew-wheel":
        saved = json.loads((output / "brew-wheel/sim_data/littlefs/p/adaptive.json").read_text())
        assert saved["dose"] == 18, "Saving a temperature edit must preserve recipe dose"
        assert saved["temperature"] == 94, "Profile temperature edits must persist through Save"
        count += 2
    for bmp in output.glob("*/*.bmp"):
        with Image.open(bmp) as frame:
            frame.save(bmp.with_suffix(".png"))
    print(f"Luxury checks passed: {count} assertions. Captures: {output}", flush=True)


if __name__ == "__main__":
    main()
