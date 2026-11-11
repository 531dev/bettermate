#!/usr/bin/env python3
"""Verify Steam/Water/Grind controls, automatic starts, scale targets and sensor fallback."""

import argparse
import json
from pathlib import Path
import tempfile

from PIL import Image
from verify_display_standby import ROOT, run_case


CASES = [
    # Steam, Water and Grind show the target as the reading, with its -/+ at (76, 240) and (404, 240).
    ("steam-water", """
        wait 3000; tap 240 240; wait 500; expect screen 4; tap 240 372; wait 500;
        expect screen 5; expect mode 2; expect active 0; expect text 145; expect text TARGET °C; expect text +;
        expect setpoint 145; shot steam-heating-dark.bmp; theme 1; wait 2200; shot steam-heating-light.bmp;
        theme 2; wait 2200; shot steam-heating-amoled.bmp;
        tap 404 240; wait 300; expect setpoint 146; expect text 146; tap 76 240; wait 300; expect setpoint 145;
        tap 240 392; wait 300; expect active 0; expect hidden START;
        wait 44300; expect screen 5; expect active 1; expect text STEAM; expect hidden STEAMING; shot steam-active.bmp;
        tap 240 450; wait 500; expect screen 4; expect mode 1; expect active 0;
        swipe 240 294 240 216 600; wait 700; tap 240 372; wait 500; expect screen 6; expect mode 3;
        expect text 80; expect text TARGET °C; expect hidden bar; expect setpoint 80;
        tap 404 240; tap 76 240; wait 300; expect setpoint 80; expect active 0;
                tap 404 240; wait 400; expect setpoint 81; expect text 81;
        tap 76 240; wait 400; expect setpoint 80; expect text 80;
        shot water-amoled.bmp; theme 0; wait 2200; shot water-dark.bmp; theme 1; wait 2200; shot water-light.bmp;
        tap 240 392; wait 1000; expect active 1; expect text WATER; expect hidden WATER · DISPENSING; expect text STOP; shot water-active.bmp;
        tap 240 392; wait 300; expect active 0; expect text START;
        tap 240 392; wait 500; expect active 1; swipe 240 290 240 120; wait 500;
        expect screen 6; expect mode 3; expect active 1; tap 240 450; wait 500; expect screen 4; expect active 0; quit
    """, None),
    ("grind-timed", """
        wait 3000; tap 240 240; wait 500; expect screen 4; tap 240 294; wait 500;
        expect screen 8; expect mode 4; expect text GRIND; expect hidden GRIND · READY; expect text 0:25; expect text +; expect grind-duration 25;
        shot grind-dark.bmp; theme 1; wait 2200; shot grind-light.bmp; theme 2; wait 2200; shot grind-amoled.bmp;
        tap 404 240; wait 300; expect grind-duration 26; tap 76 240; wait 300;
        expect grind-duration 25;
        tap 240 392; wait 500; expect grind-active 1; expect text GRIND; expect hidden GRINDING; expect text STOP;
        expect hidden STOP & MODES; shot grind-running.bmp;
        tap 240 392; wait 300; expect grind-active 0; expect text GRIND;
        tap 240 392; wait 500; expect grind-active 1; tap 240 450; wait 500;
        expect screen 4; expect mode 1; expect grind-active 0; quit
    """, None),
    ("grind-weight", """
        scale 1; wait 3000; tap 240 240; wait 500; expect screen 4; tap 240 294; wait 500;
        expect text 0:25; weight 7.5; wait 300; expect text 7.5 g;
        tap 126 392; wait 300; expect text 0.0 g;
        tap 240 132; wait 300; expect text 18.0; expect grind-weight 180;
        tap 404 240; wait 300; expect grind-weight 185; expect text 18.5;
        tap 76 240; wait 300; expect grind-weight 180; shot grind-weight.bmp;
        tap 240 392; wait 500; expect grind-active 1; expect hidden STOP & MODES;
        weight 25; wait 1000; expect grind-active 0;
        expect text GRIND; scale 0; wait 2500; expect text 0:25; expect hidden TARE;
        tap 240 450; wait 500; expect screen 4; quit
    """, None),
    ("target-limits", """
        scale 1; wait 3000; tap 240 240; wait 500; expect screen 4; tap 240 372; wait 500;
        tap 404 240; wait 300; expect setpoint 160;
        tap 240 450; wait 500; swipe 240 294 240 216 600; wait 700; tap 240 372; wait 500;
        tap 76 240; wait 400; expect setpoint 0; expect text 0;
        tap 240 450; wait 500; tap 240 294; wait 500; tap 404 240; wait 300;
        expect grind-duration 300;
        tap 240 132; wait 300; tap 404 240; wait 300; expect grind-weight 2500; quit
    """, {"ts": "160", "tw": "0", "tgd": "300000", "tgv": "250"}),
    ("minimum-fallback", """
        pressure-sensor 0; scale 1; wait 3000; tap 240 240; wait 500; expect screen 4; tap 240 294; wait 500;
        expect hidden PRESSURE; tap 76 240; wait 300; expect grind-duration 5;
        tap 240 392; wait 6500; expect grind-active 0;
        tap 240 132; wait 300; tap 76 240; wait 300; expect grind-weight 50;
        shot grind-single.bmp;
        tap 240 450; wait 500; swipe 240 294 240 216 600; wait 700; tap 240 372; wait 500;
        expect hidden PRESSURE; expect hidden bar; expect text TARGET °C; expect text 80;
        shot water-single.bmp;
        tap 240 450; wait 500; tap 240 372; wait 500; expect hidden PRESSURE; shot steam-single.bmp;
        key 2 down; wait 150; key 2 up; wait 500; expect mode 1; expect screen 2; quit
    """, {"tgd": "5000", "tgv": "5"}),
    # No warnings strip: Grind and Steam show only a dot at 12 o'clock, which opens the Modes warnings page.
    ("warning-details", """
        wait 3000; tap 240 240; wait 500; tap 240 294; wait 500;
        tap 240 392; wait 500; expect grind-active 1; expect text STOP;
        expect hidden Temperature unstable; expect hidden Flush recommended;
        swipe 240 300 240 120; wait 300; expect screen 8; expect grind-active 1; expect grind-duration 25;
        shot grind-warning-dot-dark.bmp; theme 1; wait 2200; shot grind-warning-dot-light.bmp;
        theme 2; wait 2200; shot grind-warning-dot-amoled.bmp;
        tap 240 392; wait 300; expect grind-active 0; tap 240 450; wait 500; expect screen 4;
        tap 240 372; wait 500; expect screen 5; expect text 145; expect text TARGET °C;
        expect hidden Temperature unstable; expect hidden Flush recommended;
        shot steam-warning-dot-amoled.bmp; theme 1; wait 2200; shot steam-warning-dot-light.bmp;
        theme 0; wait 2200; shot steam-warning-dot-dark.bmp;
        tap 240 34; wait 900; expect screen 4; expect active 0; expect text Warnings;
        tap 240 450; wait 700; expect hidden Warnings; expect text Brew;
        tap 240 294; wait 500; expect screen 8; tap 240 392; wait 500; expect grind-active 1;
        tap 240 34; wait 900; expect screen 8; expect grind-active 1; expect hidden Warnings;
        tap 240 392; wait 500; expect grind-active 0;
        tap 240 34; wait 900; expect screen 4; expect text Warnings;
        tap 240 450; wait 700; expect hidden Warnings;
        swipe 370 224 110 224 600; wait 700; expect text Warnings; expect text BEFORE YOUR NEXT SHOT;
        expect text Temperature unstable; expect text Flush recommended; expect text ERROR; expect text WARN;
        tap 240 450; wait 700; expect hidden Warnings; expect text Brew; quit
    """, {"wl_temp": "2", "wl_flush": "1"}),
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
