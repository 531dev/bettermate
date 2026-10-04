#!/usr/bin/env python3
"""Verify Steam/Water/Grind controls, automatic starts, scale targets and gauge fallback."""

import argparse
import json
from pathlib import Path
import tempfile

from PIL import Image
from verify_display_standby import ROOT, run_case


CASES = [
    ("steam-water", """
        wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; tap 335 145; wait 500;
        expect screen 5; expect mode 2; expect active 0; expect text STEAM; expect text Heating automatically;
        expect setpoint 145; shot steam-heating-dark.bmp; theme 1; wait 500; shot steam-heating-light.bmp;
        theme 2; wait 500; shot steam-heating-amoled.bmp;
        tap 338 374; wait 300; expect setpoint 146; tap 142 374; wait 300; expect setpoint 145;
        tap 240 382; wait 300; expect active 0;
        wait 44000; expect screen 5; expect active 1; expect text Steaming; shot steam-active.bmp;
        tap 240 450; wait 500; expect screen 4; expect mode 1; expect active 0;
        tap 335 335; wait 500; expect screen 6; expect mode 3; expect text WATER; expect setpoint 80;
        tap 338 374; wait 300; expect setpoint 81; tap 142 374; wait 300; expect setpoint 80;
        shot water-amoled.bmp; theme 0; wait 500; shot water-dark.bmp; theme 1; wait 500; shot water-light.bmp;
        tap 240 382; wait 1000; expect active 1; expect text Dispensing; shot water-active.bmp;
        tap 240 382; wait 300; expect active 0; expect text Hot water;
        tap 240 382; wait 500; expect active 1; swipe 240 290 240 120; wait 500;
        expect screen 4; expect mode 1; expect active 0; quit
    """, None),
    ("grind-timed", """
        wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; tap 145 335; wait 500;
        expect screen 8; expect mode 4; expect text GRIND; expect text TIME TARGET; expect grind-duration 25;
        shot grind-dark.bmp; theme 1; wait 500; shot grind-light.bmp; theme 2; wait 500; shot grind-amoled.bmp;
        tap 338 374; wait 300; expect grind-duration 26; tap 142 374; wait 300; expect grind-duration 25;
        tap 240 382; wait 500; expect grind-active 1; expect text Grinding; shot grind-running.bmp;
        tap 240 382; wait 300; expect grind-active 0; expect text Set your dose;
        tap 240 382; wait 500; expect grind-active 1; tap 240 450; wait 500;
        expect screen 4; expect mode 1; expect grind-active 0; quit
    """, None),
    ("grind-weight", """
        scale 1; wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; tap 145 335; wait 500;
        expect text TIME TARGET; weight 7.5; wait 300; expect text 7.5 g;
        hold 240 132 1000; wait 300; expect text 0.0 g;
        tap 240 132; wait 300; expect text WEIGHT TARGET; expect grind-weight 180;
        tap 338 374; wait 300; expect grind-weight 185; expect text 18.5;
        tap 142 374; wait 300; expect grind-weight 180; shot grind-weight.bmp;
        tap 240 382; wait 500; expect grind-active 1; weight 25; wait 1000; expect grind-active 0;
        expect text Set your dose; scale 0; wait 2500; expect text TIME TARGET; expect hidden 25.0 g;
        tap 240 450; wait 500; expect screen 4; quit
    """, None),
    ("target-limits", """
        scale 1; wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; tap 335 145; wait 500;
        tap 338 374; wait 300; expect setpoint 160;
        tap 240 450; wait 500; tap 335 335; wait 500; tap 142 374; wait 300; expect setpoint 0;
        tap 240 450; wait 500; tap 145 335; wait 500; tap 338 374; wait 300; expect grind-duration 300;
        tap 240 132; wait 300; tap 338 374; wait 300; expect grind-weight 2500; quit
    """, {"ts": "160", "tw": "0", "tgd": "300000", "tgv": "250"}),
    ("minimum-fallback", """
        pressure-sensor 0; scale 1; wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; tap 145 335; wait 500;
        expect hidden PRESSURE; tap 142 374; wait 300; expect grind-duration 5;
        tap 240 382; wait 6500; expect grind-active 0;
        tap 240 132; wait 300; tap 142 374; wait 300; expect grind-weight 50; shot grind-single.bmp;
        tap 240 450; wait 500; tap 335 335; wait 500; expect hidden PRESSURE; shot water-single.bmp;
        tap 240 450; wait 500; tap 335 145; wait 500; expect hidden PRESSURE; shot steam-single.bmp;
        key 2 down; wait 150; key 2 up; wait 500; expect mode 1; expect screen 2; quit
    """, {"tgd": "5000", "tgv": "5"}),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--case", choices=[name for name, _, _ in CASES])
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-modes-"))
    output.mkdir(parents=True, exist_ok=True)
    count = 0
    for name, script, preferences in CASES:
        if args.case and args.case != name:
            continue
        run_case(args.binary.resolve(), output, name, script, preferences)
        count += script.count("expect ")
        for bmp in (output / name).glob("*.bmp"):
            with Image.open(bmp) as frame:
                frame.save(bmp.with_suffix(".png"))
    if not args.case or args.case == "steam-water":
        preferences = json.loads((output / "steam-water/sim_data/nvs/controller.json").read_text())
        assert preferences["ts"] == "145" and preferences["tw"] == "80"
        count += 1
    print(f"Mode checks passed: {count} assertions. Captures: {output}", flush=True)


if __name__ == "__main__":
    main()
