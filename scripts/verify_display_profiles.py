#!/usr/bin/env python3
"""Verify smooth profile scrolling, preview isolation, snapping, and selection.

The PROFILES eyebrow carries no "n / m" count, so each position check records the object tree
(`layout position-…-<n>-of-<m>.json`) and asserts the dots row at y 304: m dots with the n-th one
enlarged, or no dots for a single profile. Name and recipe checks show which profile sits there.

Build with `pio run -e display-sim`. Set SDL_VIDEODRIVER=dummy for headless runs.
Each case uses isolated storage; the interactive simulator's recipes stay intact.
"""

import argparse
import itertools
import json
from pathlib import Path
import tempfile

from PIL import Image, ImageChops, ImageStat
from verify_display_standby import ROOT, run_case


PROFILES = [
    {
        "id": f"profile-{index}", "label": label, "type": "standard",
        "temperature": 90 + index, "dose": 18,
        "phases": [{"name": "Brew", "phase": "brew", "valve": 1,
                    "duration": 25 + index, "pump": 100,
                    "targets": [{"type": "volumetric", "operator": "gte", "value": 36 + index}]}],
    }
    for index, label in enumerate(["Classic", "Bloom", "Turbo", "Lever", "Lungo", "Filter", "Ristretto"])
]
PROFILES[1]["phases"] = [
    {"name": "Preinfuse", "phase": "preinfusion", "valve": 1, "duration": 3, "pump": 20},
    {"name": "Bloom", "phase": "preinfusion", "valve": 0, "duration": 5, "pump": 0},
    {"name": "Brew", "phase": "brew", "valve": 1, "duration": 18, "pump": 100,
     "targets": [{"type": "volumetric", "operator": "gte", "value": 37}]},
]

POSITIONS = itertools.count()


def position(index, count):
    """Script text recording the dots row; main() checks that profile `index` of `count` is focused."""
    return f"layout position-{next(POSITIONS):02d}-{index}-of-{count}.json"


def check_positions(case_dir):
    """Assert every recorded dots row: `count` dots, the focused one enlarged, none for one profile."""
    checked = 0
    for path in sorted(case_dir.glob("position-*.json")):
        _, _, index, _, count = path.stem.split("-")
        index, count = int(index), int(count)
        rows = [json.loads(line) for line in path.read_text().splitlines()[1:] if line.strip()]
        dots = sorted((r for r in rows if r["kind"] == "obj" and 296 <= (r["y1"] + r["y2"]) / 2 <= 312
                       and r["x2"] - r["x1"] == r["y2"] - r["y1"] and r["x2"] - r["x1"] + 1 in (4, 6)),
                      key=lambda r: r["x1"])
        sizes = [r["x2"] - r["x1"] + 1 for r in dots]
        expected = [6 if i == index - 1 else 4 for i in range(count)] if count > 1 else []
        assert sizes == expected, f"{case_dir.name}/{path.name}: dots {sizes}, expected profile {index} of {count}"
        checked += 1
    return checked


CASES = [
    ("tap-animation", PROFILES[:2], f"""
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300; tap 240 310; wait 400;
        expect screen 7; expect text PROFILES; expect text Classic; expect hidden Bloom; {position(1, 2)};
        expect hidden SELECT; shot before.bmp;
        swipe 370 224 110 224 600; shot moving-a.bmp; wait 80; shot moving-b.bmp; wait 700;
        expect text Bloom; expect hidden Classic; {position(2, 2)}; expect text 91° · 18 → 37 g · 26 s;
        expect text Preinfuse · Bloom · Brew; expect hidden 90° · 18 → 36 g · 25 s;
        expect temperature 90; expect active 0; shot settled-dark.bmp;
        theme 1; wait 2200; expect text Bloom; {position(2, 2)}; shot settled-light.bmp;
        theme 2; wait 2200; expect text Bloom; {position(2, 2)}; shot settled-amoled.bmp;
        tap 240 224; shot return-a.bmp; wait 80; shot return-b.bmp; wait 600;
        expect screen 2; expect text Bloom; expect temperature 91; expect active 0; shot returned.bmp;
        expect target-weight 37; expect duration 26;
        tap 240 310; wait 400; expect text Bloom; expect hidden Classic; {position(1, 2)};
        swipe 370 224 110 224 600; wait 700; expect text Classic; {position(2, 2)};
        tap 240 392; wait 400; expect text ADJUST; expect text TEMPERATURE; expect text Classic;
        expect temperature 90;
        tap 240 450; wait 400; expect screen 7; expect text Classic; expect hidden Bloom; {position(1, 2)};
        tap 240 290; wait 500; expect screen 2; expect text Classic; wait 2200; quit
    """),
    ("gesture-limits", PROFILES, f"""
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300; tap 240 310; wait 400;
        swipe 370 224 110 224 600; wait 700;
        expect screen 7; expect text Bloom; expect hidden Classic; expect hidden Turbo; {position(2, 7)};
        expect temperature 90; expect active 0;
        swipe 370 224 110 224 600; wait 700; expect text Turbo; {position(3, 7)};
        swipe 110 224 370 224 600; wait 700; expect text Bloom; {position(2, 7)};
        swipe 400 224 80 224 160; wait 700; swipe 400 224 80 224 160; wait 700;
        swipe 400 224 80 224 160; wait 700; swipe 400 224 80 224 160; wait 700;
        swipe 400 224 80 224 160; wait 700; swipe 400 224 80 224 160; wait 700;
        expect text Ristretto; expect hidden Filter; {position(7, 7)}; expect text 96° · 18 → 42 g · 31 s;
        expect temperature 90; expect active 0; shot last-profile.bmp;
        swipe 370 224 110 224 600; wait 700; expect text Ristretto; {position(7, 7)}; expect screen 7;
        swipe 80 224 400 224 160; wait 700; swipe 80 224 400 224 160; wait 700;
        swipe 80 224 400 224 160; wait 700; swipe 80 224 400 224 160; wait 700;
        swipe 80 224 400 224 160; wait 700; swipe 80 224 400 224 160; wait 700;
        expect text Classic; expect hidden Bloom; {position(1, 7)}; expect temperature 90;
        swipe 110 224 370 224 600; wait 700; expect text Classic; {position(1, 7)}; expect screen 7;
        swipe 240 290 240 150 160; wait 400; expect text Classic; {position(1, 7)}; expect screen 7;
        tap 240 450; wait 400; expect screen 4; expect active 0; quit
    """),
    ("single-profile", PROFILES[:1], f"""
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300; tap 240 310; wait 400;
        expect text PROFILES; expect text Classic; expect text 90° · 18 → 36 g · 25 s; {position(1, 1)};
        shot single-profile.bmp;
        expect hidden SELECT;
        swipe 400 224 80 224 160; wait 700; expect text Classic; {position(1, 1)}; expect screen 7;
        swipe 80 224 400 224 160; wait 700; expect text Classic; {position(1, 1)}; expect screen 7;
        swipe 240 290 240 150 160; wait 400; expect screen 7; expect temperature 90;
        tap 240 224; wait 500; expect screen 2; expect text Classic; expect active 0; quit
    """),
    ("interrupted-return", PROFILES[:2], """
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300; tap 240 310; wait 400;
        tap 240 224; controller disconnected; wait 500; expect screen 1; expect active 0;
        controller connected; wait 700; tap 240 240; wait 300; tap 240 216; wait 400;
        expect screen 2; expect text Classic; expect active 0;
        tap 240 310; wait 400; expect screen 7; expect hidden SELECT;
        tap 240 224; wait 500; expect screen 2; expect active 0; quit
    """),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--case", choices=[case[0] for case in CASES])
    args = parser.parse_args()
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-profiles-"))
    output.mkdir(parents=True, exist_ok=True)
    print(f"Captures: {output}", flush=True)
    assertions = 0
    for name, profiles, script in CASES:
        if args.case and args.case != name:
            continue
        prefs = {"sp": profiles[0]["id"], "fp": ",".join(p["id"] for p in profiles),
                 "wl_temp": "0", "wl_flush": "0"}
        run_case(args.binary.resolve(), output, name, script, prefs, profiles)
        assertions += script.count("expect ")
        assertions += check_positions(output / name)
        for bmp in (output / name).glob("*.bmp"):
            with Image.open(bmp) as frame:
                frame.save(bmp.with_suffix(".png"))
        if name == "tap-animation":
            frames = [Image.open(output / name / f"{frame}.png").convert("RGB").crop((40, 98, 440, 322))
                      for frame in ("before", "moving-a", "moving-b", "settled-dark")]
            for first, second in zip(frames, frames[1:]):
                assert ImageChops.difference(first, second).getbbox(), "Picker must move across intermediate frames"
                assertions += 1
            # Measure the rendered group, including intermediate frames: the
            # gold recipe must move with the profile instead of sitting in a footer.
            captures = [Image.open(output / name / f"{frame}.png").convert("RGB")
                        for frame in ("before", "moving-a", "moving-b", "settled-dark")]
            recipe_bounds = []
            for capture in captures:
                region = capture.crop((70, 110, 410, 360))
                mask = Image.new("1", region.size)
                pixels = region.tobytes()
                # The focused page dot shares the accent; leave the dots row (y 296-312) out.
                mask.putdata([r > 24 and r > g * 1.1 and g > b * 1.2 and not 296 <= 110 + i // region.width <= 312
                              for i, (r, g, b) in enumerate(zip(pixels[::3], pixels[1::3], pixels[2::3]))])
                bounds = mask.getbbox()
                recipe_bounds.append((bounds[0] + 70, bounds[1] + 110, bounds[2] + 70, bounds[3] + 110) if bounds else None)
            assert recipe_bounds[-1], "Focused recipe must be visible"
            assert recipe_bounds[-1][3] < 296, "Recipe should sit with the central profile, above the dots and actions"
            assert any(bounds and abs(bounds[0] - recipe_bounds[-1][0]) > 4
                       for bounds in recipe_bounds[1:3]), "Recipe details must travel with their scrolling row"
            title_region = captures[-1].crop((70, 130, 410, 260))
            title_mask = Image.new("1", title_region.size)
            pixels = title_region.tobytes()
            title_mask.putdata([min(r, g, b) > 190
                                for r, g, b in zip(pixels[::3], pixels[1::3], pixels[2::3])])
            title_bounds = title_mask.getbbox()
            assert title_bounds and recipe_bounds[-1][1] - (title_bounds[3] + 130) <= 64, \
                "Keep the name, stages, and recipe in one compact group"
            assertions += 4
            # The stable °C unit fades in during the return; a live temperature
            # changing cannot satisfy this check for an otherwise instant switch.
            levels = [ImageStat.Stat(Image.open(output / name / f"{frame}.png").convert("RGB")
                                     .crop((226, 242, 254, 256))).mean[0]
                      for frame in ("return-a", "return-b", "returned")]
            assert levels[0] < levels[1] < levels[2], "Returning to Brew must animate across frames"
            assertions += 1
            saved = json.loads((output / name / "sim_data/nvs/controller.json").read_text())
            assert saved["sp"] == profiles[0]["id"], "Selection must persist after browsing and editing"
            assertions += 1
    print(f"Profile scrolling checks passed: {assertions} assertions. Captures: {output}", flush=True)


if __name__ == "__main__":
    main()
