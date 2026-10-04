#!/usr/bin/env python3
"""Exercise the ported Brew/Status controls and capture themes, gauge fallback and shot lifecycles.

Build with `pio run -e display-sim` first. Every case runs in isolated simulator state.
"""

import argparse
import json
from pathlib import Path
import tempfile

from PIL import Image
from verify_display_standby import ROOT, run_case


CASES = [
    ("themes-profile", """
        wait 3000; tap 240 240; wait 1000; expect screen 2; expect text BREW; shot brew-dark.bmp;
        theme 1; wait 1000; shot brew-light.bmp; theme 2; wait 1000; shot brew-amoled.bmp;
        tap 240 35; wait 300; expect text Machine warnings; expect text Flush recommended; shot warnings.bmp;
        tap 240 366; wait 300; expect hidden Machine warnings;
        tap 338 374; wait 300; expect text ADJUST PROFILE; expect temperature 93; expect duration 28;
        tap 142 382; wait 300; expect text ADJUST PROFILE;
        tap 350 170; wait 300; expect temperature 94; tap 130 170; wait 300; expect temperature 93;
        tap 350 261; wait 300; expect duration 29; tap 130 261; wait 300; expect duration 28; shot adjust-timed.bmp;
        tap 240 382; wait 300; expect text BREW;
        tap 338 374; wait 300; tap 350 170; wait 300; tap 142 382; wait 300;
        expect text BREW; expect temperature 94;
        tap 338 374; wait 300; tap 130 170; wait 300; tap 338 382; wait 300;
        expect text Copy of Default; expect temperature 93; shot copied-profile.bmp;
        tap 142 374; wait 300; expect screen 7; shot stock-profile.bmp;
        swipe 240 310 240 120; wait 500; expect screen 4; expect active 0;
        tap 145 145; wait 500; expect screen 2; expect text BREW;
        tap 240 450; wait 500; expect screen 4; tap 240 450; wait 500; expect screen 1;
        tap 240 240; wait 500; expect screen 2; expect text BREW; quit
    """, None),
    ("single-ring", """
        wait 3000; pressure-sensor 0; wait 500; tap 240 240; wait 1000;
        expect screen 2; expect hidden PRESSURE; shot brew-single-dark.bmp;
        theme 1; wait 1000; shot brew-single-light.bmp; theme 2; wait 1000; shot brew-single-amoled.bmp;
        tap 338 374; wait 300; expect text DURATION; tap 350 261; wait 300; expect duration 29;
        tap 240 382; wait 300; tap 240 382; wait 1200; expect screen 3; expect active 1;
        expect hidden PRESSURE; shot status-single.bmp;
        swipe 240 290 240 120; wait 500; expect screen 4; expect active 0;
        tap 145 145; wait 500; expect screen 2; expect text BREW;
        pressure-sensor 1; wait 500; expect text PRESSURE; shot restored-dual.bmp; quit
    """, None),
    ("volumetric", """
        scale 1; wait 3000; tap 240 240; wait 500; weight 8.5; wait 300;
        expect text 8.5 g; shot brew-scale.bmp;
        hold 240 132 1000; wait 300; expect text 0.0 g;
        tap 240 132; wait 300; expect target-weight 36;
        tap 338 374; wait 300; expect text WEIGHT; shot adjust-weight.bmp;
        tap 350 261; wait 300; expect target-weight 37; tap 130 261; wait 300; expect target-weight 36;
        tap 142 382; wait 300; tap 240 382; wait 1200; expect screen 3; expect active 1;
        shot status-weight.bmp; weight 50; wait 250; expect active 0; expect text Calibrating...; shot calibrating.bmp;
        wait 4500; expect screen 3; expect active 0; expect text SHOT COMPLETE; expect text Finished;
        shot finished-weight.bmp; tap 240 386; wait 500; expect screen 2;
        tap 338 374; wait 300; tap 240 315; wait 300; expect text DURATION; expect target-weight 0;
        shot removed-weight.bmp; tap 240 382; wait 300;
        scale 0; wait 2000; tap 240 382; wait 1000; expect screen 3; expect active 1;
        tap 240 386; wait 500; expect screen 2; expect active 0; quit
    """, None),
    ("timed-finished", """
        wait 3000; tap 240 240; wait 500; tap 240 382; wait 3000;
        expect screen 3; expect active 1; expect text SHOT TIME; shot status-dark.bmp;
        theme 1; wait 1000; shot status-light.bmp; theme 2; wait 1000; shot status-amoled.bmp;
        wait 26000; expect screen 3; expect active 0; expect text Finished; expect text SHOT COMPLETE;
        shot finished-timed.bmp; tap 240 386; wait 500; expect screen 2;
        tap 240 382; wait 1000; expect screen 3; expect active 1;
        tap 240 386; wait 500; expect screen 2; expect active 0; quit
    """, None),
    ("warning-confirm", """
        wait 3000; tap 240 240; wait 500; tap 240 382; wait 500;
        expect screen 2; expect active 0; expect text Confirm brew; expect text Temperature not stable; shot confirm.bmp;
        tap 240 450; swipe 240 300 240 120; wait 500; expect screen 2; expect active 0;
        tap 168 366; wait 300; expect hidden Confirm brew;
        tap 240 382; wait 300; tap 312 366; wait 1000; expect screen 3; expect active 1;
        expect hidden Confirm brew; tap 240 386; wait 500; expect screen 2; expect active 0;
        tap 240 382; wait 300; expect text Confirm brew;
        controller disconnected; wait 500; tap 312 366; wait 500; expect active 0;
        controller connected; wait 1000; tap 240 240; wait 500; tap 240 382; wait 300; expect text Confirm brew;
        error 4; wait 500; expect screen 1; expect active 0; quit
    """, {"wl_temp": "2", "wl_flush": "2"}),
    ("hold-flush", """
        wait 3000; tap 240 240; wait 500; hold 240 382 1200; wait 200;
        expect screen 3; expect active 1; shot flush-draining.bmp;
        wait 5000; expect screen 2; expect active 0;
        wait 2000; expect screen 2; expect active 0; expect text BREW; quit
    """, {"fl_dur": "0"}),
    ("timed-flush", """
        wait 3000; tap 240 240; wait 500; hold 240 382 700; wait 500;
        expect screen 3; expect active 1; shot timed-flush.bmp;
        wait 7000; expect screen 2; expect active 0; expect text BREW; quit
    """, {"fl_dur": "3"}),
    ("heating-pulse", """
        wait 3000; tap 240 240; wait 1000; shot pulse-a.bmp;
        wait 500; shot pulse-b.bmp; expect screen 2; expect active 0;
        tap 240 215; wait 500; expect screen 4; expect active 0; quit
    """, None),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path, help="New directory for captures and isolated state")
    parser.add_argument("--case", choices=[name for name, _, _ in CASES], help="Run one case")
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-brew-"))
    output.mkdir(parents=True, exist_ok=True)
    print(f"Captures: {output}", flush=True)
    assertions = 0
    for name, script, preferences in CASES:
        if args.case and name != args.case:
            continue
        run_case(args.binary.resolve(), output, name, script, preferences)
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
    if not args.case or args.case == "heating-pulse":
        # Check the actual rendered rim: both snapshots must contain heat ticks and their tint must alternate.
        counts = []
        for name in ("pulse-a.png", "pulse-b.png"):
            with Image.open(output / "heating-pulse" / name).convert("RGB") as frame:
                bright = soft = 0
                for y in range(480):
                    for x in range(240):
                        if 204**2 <= (x - 240)**2 + (y - 240)**2 <= 224**2:
                            r, g, b = frame.getpixel((x, y))
                            bright += r > 240 and 105 < g < 140 and 50 < b < 90
                            soft += 60 < r < 90 and 20 < g < 45 and b < 25
                counts.append((bright, soft))
        assert all(bright + soft > 100 for bright, soft in counts), counts
        assert (counts[0][0] > counts[0][1]) != (counts[1][0] > counts[1][1]), counts
        assertions += 2
    if not args.case or args.case == "timed-finished":
        for name in ("status-dark.png", "status-light.png", "status-amoled.png"):
            with Image.open(output / "timed-finished" / name).convert("RGB") as frame:
                # The square stop glyph must be visible against the action disc in every theme.
                assert frame.getpixel((240, 386)) != frame.getpixel((240, 355)), name
                assertions += 1
    print(f"Brew/Status checks passed: {assertions} assertions. Captures: {output}", flush=True)


if __name__ == "__main__":
    main()
