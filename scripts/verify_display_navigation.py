#!/usr/bin/env python3
"""Verify Menu/Info/Profile navigation, favorite ordering, selection and scannable network QR codes.

Modes has no always-on network icons: Info is reached by scrolling the picker to "Info", or through the
Wi-Fi-lost glyph at 12 o'clock while the network is down. Profile positions are checked on the dots row
(see verify_display_profiles.position) because the PROFILES eyebrow no longer shows "n / m".
"""

import argparse
import json
from pathlib import Path
import platform
import subprocess
import tempfile

from PIL import Image
from verify_display_profiles import check_positions, position
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


# Scroll the Modes picker to its last row, then open it.
TO_INFO = ("swipe 240 390 240 90 300; wait 900; swipe 240 320 240 120 250; wait 700; expect text Info; "
           "tap 240 216; wait 700")
QUIET = {"wl_temp": "0", "wl_flush": "0"}

CASES = [
    ("menu-info", f"""
        wait 3000; tap 240 240; wait 500;
        expect screen 4; expect hidden TEMP; expect hidden PRESSURE; expect text Brew; expect text Steam;
        expect text Grind; shot menu-dark.bmp;
        theme 1; wait 2200; shot menu-light.bmp; theme 2; wait 2200; shot menu-amoled.bmp;
        {TO_INFO}; expect screen 9; expect text CONNECTED TO; expect text GaggiMate-Sim;
        expect text 192.168.1.123; expect text SCAN TO OPEN;
        tap 240 386; wait 500; expect text DISPLAY; expect text CONTROLLER; expect text sim-3.0;
        expect text NETWORK; expect hidden SCAN TO OPEN;
        tap 240 386; wait 500; expect text ABOUT; expect hidden CONTROLLER; expect text SCAN TO OPEN;
        shot info-sta-amoled.bmp;
        theme 0; wait 2200; shot info-sta-dark.bmp; theme 1; wait 2200; shot info-sta-light.bmp;
        wifi ap; wait 600; expect text SCAN TO JOIN; expect text SETUP NETWORK; expect text BetterMate;
        expect text 4.4.4.1; shot info-ap.bmp;
        wifi sta; wait 600; expect text SCAN TO OPEN; expect text 192.168.1.123;
        wifi disconnected; wait 600; expect text Not connected; expect text OFFLINE;
        expect text Connect to Wi-Fi to show a code; expect hidden SCAN TO OPEN; expect hidden SCAN TO JOIN;
        shot info-disconnected.bmp; wifi sta; wait 600;
        swipe 240 350 240 120; wait 500; expect screen 4;
        tap 240 442; wait 500; expect screen 1; expect mode 0; tap 240 240; wait 500; expect screen 4; quit
    """, {"wap": PASSWORD}, None),
    ("no-grinder", """
        wait 3000; tap 240 240; wait 500; expect screen 4;
        expect hidden Grind; expect text Brew; expect text Steam; expect text Water; shot menu-three.bmp;
        tap 20 216; wait 500; expect screen 4; tap 240 372; wait 500; expect screen 6; expect mode 3;
        tap 240 450; wait 500; expect screen 4; controller disconnected; wait 500;
        tap 240 216; wait 500; expect mode 0; expect active 0; quit
    """, {"alt_relay": "0"}, None),
    ("profile-favorites", f"""
        wait 3000; tap 240 240; wait 500; tap 240 216; wait 500; tap 240 310; wait 500;
        expect screen 7; expect text PROFILES; expect text First; expect hidden Second; {position(1, 3)};
        expect text 93° · 36 g · 30 s; expect hidden Brew; shot profile-dark.bmp;
        theme 1; wait 2200; shot profile-light.bmp; theme 2; wait 2200; shot profile-amoled.bmp;
        tap 240 62; wait 300; expect screen 7; expect text First; {position(1, 3)};
        swipe 370 224 110 224 600; wait 700; expect text Second; expect hidden First; {position(2, 3)};
        expect text 95° · 30 s; shot profile-timed.bmp;
        swipe 370 224 110 224 600; wait 700; expect text Bloom; {position(3, 3)};
        expect text Wet · Bloom · Brew; expect text 92° · 42 g · 40 s; shot profile-bloom.bmp;
        swipe 370 224 110 224 600; wait 700; expect text Bloom; {position(3, 3)};
        swipe 110 224 370 224 600; wait 700; expect text Second; {position(2, 3)};
        tap 240 224; wait 500; expect screen 2; expect text Second; expect temperature 95;
        tap 240 310; wait 500; tap 240 392; wait 500; expect text ADJUST; tap 384 182; wait 300;
        expect temperature 96; expect text UNSAVED;
        tap 240 392; wait 500; expect text Save changes; tap 240 346; wait 700; expect screen 2;
        tap 240 310; wait 500; expect text Second; {position(1, 3)};
        swipe 370 224 110 224 600; wait 700; expect text First; {position(2, 3)};
        tap 240 224; wait 500; expect screen 2; expect temperature 93;
        tap 240 310; wait 500; tap 240 392; wait 500; expect text ADJUST; expect hidden SAVE;
        tap 240 392; wait 300; expect text ADJUST; expect hidden Save changes;
        tap 240 450; wait 500; expect screen 7; expect text First; tap 240 224; wait 500; expect screen 2;
        tap 240 310; wait 500; tap 240 450; wait 500;
        expect screen 4; expect mode 1; expect active 0; quit
    """, {"sp": "first", "fp": "first,second,first,bloom"}, PROFILES),
    ("single-ring", f"""
        pressure-sensor 0; wait 3000; tap 240 240; wait 500;
        expect screen 4; expect hidden PRESSURE; shot menu-single.bmp;
        {TO_INFO}; expect screen 9; expect text SCAN TO OPEN; shot info-single.bmp;
        tap 240 450; wait 500; tap 240 216; wait 500; tap 240 310; wait 500;
        expect screen 7; expect hidden PRESSURE; shot profile-single.bmp;
        tap 240 392; wait 500; expect text TEMPERATURE; expect hidden PRESSURE; expect hidden Add;
        shot adjust-single.bmp; tap 240 450; wait 500; expect screen 7;
        tap 240 224; wait 500; expect screen 2; quit
    """, None, None),
    ("open-ap", """
        wait 3000; tap 240 240; wait 500; expect screen 4;
        wifi disconnected; wait 600; tap 240 34; wait 700; expect screen 9; expect text OFFLINE;
        wifi ap-open; wait 600; expect text SCAN TO JOIN; expect text SETUP NETWORK; expect text BetterMate;
        shot info-open-ap.bmp; quit
    """, dict(QUIET, wap=""), None),
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
        count += check_positions(output / name)
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
