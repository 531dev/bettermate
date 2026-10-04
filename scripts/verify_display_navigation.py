#!/usr/bin/env python3
"""Verify Menu/Info/Profile navigation, favorite ordering, selection and scannable network QR codes."""

import argparse
import json
from pathlib import Path
import platform
import subprocess
import tempfile

from PIL import Image
from verify_display_standby import ROOT, run_case


PASSWORD = 'test;,:"\\pass'


def phase(name="Brew", duration=30, weight=0, kind="brew"):
    value = {"name": name, "phase": kind, "valve": 1, "duration": duration, "pump": 100}
    if weight:
        value["targets"] = [{"type": "volumetric", "operator": "gte", "value": weight}]
    return value


PROFILES = [
    {"id": "first", "label": "First", "type": "standard", "temperature": 93,
     "phases": [phase(weight=36)]},
    {"id": "second", "label": "Second", "type": "standard", "temperature": 95,
     "phases": [phase()]},
    {"id": "bloom", "label": "Bloom", "type": "standard", "temperature": 92,
     "phases": [phase("Wet", 3, kind="preinfusion"), phase("Bloom", 7, kind="preinfusion"), phase(weight=42)]},
]


CASES = [
    ("menu-info", """
        wait 3000; tap 240 240; wait 500; tap 240 450; wait 500;
        expect screen 4; expect text Choose a mode; expect text BREW; expect text STEAM;
        expect text WATER; expect text GRIND; shot menu-dark.bmp;
        theme 1; wait 500; shot menu-light.bmp; theme 2; wait 500; shot menu-amoled.bmp;
        tap 240 260; wait 500; expect screen 9; expect text BetterMate; expect text GaggiMate-Sim;
        expect text IP: 192.168.1.123; expect text OPEN WEB UI; expect text CONTROLLER sim-3.0; shot info-sta-amoled.bmp;
        theme 0; wait 500; shot info-sta-dark.bmp; theme 1; wait 500; shot info-sta-light.bmp;
        wifi ap; wait 500; expect text JOIN WIFI; expect text BetterMate; expect text IP: 4.4.4.1; shot info-ap.bmp;
        wifi sta; wait 500; expect text OPEN WEB UI; expect text IP: 192.168.1.123;
        wifi disconnected; wait 500; expect text Disconnected; expect hidden OPEN WEB UI; expect hidden JOIN WIFI;
        shot info-disconnected.bmp; wifi sta; wait 500;
        swipe 240 350 240 120; wait 500; expect screen 4;
        tap 240 450; wait 500; expect screen 1; expect mode 0; tap 240 240; wait 500; expect screen 2; quit
    """, {"wap": PASSWORD}, None),
    ("no-grinder", """
        wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; expect screen 4;
        expect hidden GRIND; expect text BREW; expect text STEAM; expect text WATER; shot menu-three.bmp;
        tap 145 335; wait 500; expect screen 4; tap 240 330; wait 500; expect screen 6; expect mode 3;
        tap 240 450; wait 500; expect screen 4; controller disconnected; wait 500;
        tap 145 155; wait 500; expect mode 0; expect active 0; quit
    """, {"alt_relay": "0"}, None),
    ("profile-favorites", """
        wait 3000; tap 240 240; wait 500; tap 142 374; wait 500;
        expect screen 7; expect text CURRENT PROFILE; expect text First; expect text 1 / 3;
        expect text 36.0 g; expect text 1 phase · 1 step; shot profile-dark.bmp;
        theme 1; wait 500; shot profile-light.bmp; theme 2; wait 500; shot profile-amoled.bmp;
        tap 62 240; wait 300; expect text First;
        tap 418 240; wait 300; expect text SELECT PROFILE; expect text Second; expect text 2 / 3;
        expect text 0:30; shot profile-timed.bmp;
        swipe 330 230 140 230; wait 300; expect text Bloom; expect text 3 / 3;
        expect text 2 phases · 3 steps; expect text 42.0 g; shot profile-bloom.bmp;
        tap 418 240; wait 300; expect text Bloom;
        swipe 140 230 330 230; wait 300; expect text Second;
        tap 240 382; wait 500; expect screen 2; expect text Second; expect temperature 95;
        tap 338 374; wait 300; tap 350 170; wait 300; expect temperature 96; tap 240 382; wait 300;
        tap 142 374; wait 500; expect text Second; expect text CURRENT PROFILE;
        tap 418 240; wait 300; expect text First; tap 240 382; wait 500; expect screen 2; expect temperature 93;
        tap 338 374; wait 300; tap 142 382; wait 300; expect text ADJUST PROFILE;
        tap 240 382; wait 300; tap 142 374; wait 500; swipe 240 310 240 120; wait 500;
        expect screen 4; expect mode 1; expect active 0; quit
    """, {"sp": "first", "fp": "first,second,first,bloom"}, PROFILES),
    ("single-ring", """
        pressure-sensor 0; wait 3000; tap 240 240; wait 500; tap 240 450; wait 500;
        expect screen 4; expect hidden PRESSURE; shot menu-single.bmp;
        tap 240 260; wait 500; expect screen 9; expect text OPEN WEB UI; shot info-single.bmp;
        tap 240 450; wait 500; tap 145 155; wait 500; tap 142 374; wait 500;
        expect screen 7; expect hidden PRESSURE; shot profile-single.bmp;
        tap 240 382; wait 500; expect screen 2; quit
    """, None, None),
    ("open-ap", """
        wait 3000; tap 240 240; wait 500; tap 240 450; wait 500; tap 240 260; wait 500;
        wifi ap-open; wait 500; expect text JOIN WIFI; shot info-open-ap.bmp; quit
    """, {"wap": ""}, None),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--case", choices=[name for name, _, _, _ in CASES])
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-navigation-"))
    output.mkdir(parents=True, exist_ok=True)
    count = 0
    for name, script, preferences, profiles in CASES:
        if args.case and args.case != name:
            continue
        run_case(args.binary.resolve(), output, name, script, preferences, profiles)
        count += script.count("expect ")
        for bmp in (output / name).glob("*.bmp"):
            with Image.open(bmp) as frame:
                frame.save(bmp.with_suffix(".png"))
    if not args.case or args.case == "profile-favorites":
        preferences = json.loads((output / "profile-favorites/sim_data/nvs/controller.json").read_text())
        assert preferences["sp"] == "first"
        count += 1
    if platform.system() == "Darwin":
        expected = {}
        if not args.case or args.case == "menu-info":
            for name in ["info-sta-dark", "info-sta-light", "info-sta-amoled"]:
                expected[str(output / f"menu-info/{name}.png")] = "http://192.168.1.123/"
            escaped = "".join(("\\" if c in '\\;,:"' else "") + c for c in PASSWORD)
            expected[str(output / "menu-info/info-ap.png")] = f"WIFI:S:BetterMate;T:WPA;P:{escaped};;"
        if not args.case or args.case == "open-ap":
            expected[str(output / "open-ap/info-open-ap.png")] = "WIFI:S:BetterMate;;;;"
        if expected:
            result = subprocess.check_output([
                "swift", "-module-cache-path", str(output / "swift-cache"),
                str(ROOT / "scripts/detect_display_qr.swift"), *expected,
            ], text=True)
            actual = json.loads(result)
            assert actual == expected, actual
            (output / "qr-decoded.json").write_text(json.dumps(actual, indent=2))
            count += len(expected)
    else:
        print("Rendered QR decode requires macOS Vision; scan Info captures separately.", flush=True)
    print(f"Navigation checks passed: {count} assertions. Captures: {output}", flush=True)


if __name__ == "__main__":
    main()
