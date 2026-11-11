#!/usr/bin/env python3
"""Regression checks for accidental stops, gesture navigation, recipe and scale actions.

Uses isolated simulator state and real LVGL input. Set SDL_VIDEODRIVER=dummy for
headless execution; the simulator also renders screenshots with that backend.
"""
import argparse
from pathlib import Path
import tempfile

from PIL import Image
from verify_display_standby import ROOT, run_case
from verify_display_luxury import BREW_PROFILES, QUIET

PREFS = dict(QUIET, fp=','.join(p['id'] for p in BREW_PROFILES), alt_relay='1')
CASES = [
    # Water shows only a warning dot; tapping it leaves for the Modes warnings page, so that check comes last.
    ('water-readout', '''
        wait 3000; tap 240 240; wait 300; swipe 240 294 240 216 600; wait 700; tap 240 372; wait 300;
        expect screen 6; expect text TARGET °C; expect hidden bar; expect text 80; expect text +;
        expect hidden Flush recommended; expect hidden Temperature unstable;
        tap 240 392; wait 400; expect active 1; expect hidden STOP & MODES; expect text STOP;
        tap 240 240; wait 300; expect screen 6; expect active 1;
        swipe 240 280 240 140; wait 300; expect screen 6; expect active 1;
        shot water-active.bmp; theme 1; wait 2200; expect hidden STOP & MODES; shot water-active-light.bmp;
        theme 2; wait 2200; expect hidden STOP & MODES; shot water-active-amoled.bmp; theme 0;
        tap 240 392; wait 300; expect active 0;
        expect hidden STOP & MODES; tap 240 392; wait 300; expect active 1;
        tap 240 450; wait 300; expect screen 4; expect active 0;
        swipe 370 224 110 224 600; wait 700; expect text Warnings;
        expect text Flush recommended; expect text Temperature unstable; expect text ERROR; expect text WARN;
        tap 240 450; wait 700; expect hidden Warnings;
        swipe 240 294 240 216 600; wait 700; tap 240 372; wait 500; expect screen 6;
        tap 240 34; wait 900; expect screen 4; expect active 0; expect text Warnings; quit
    '''),
    ('shot-readout', '''
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300;
        tap 240 392; wait 600; expect screen 3; expect active 1;
        expect hidden SHOT TIME; expect hidden STOP & MODES; expect hidden MODES; expect text STOP;
        tap 240 450; wait 300; expect screen 3; expect active 1;
        tap 240 210; wait 300; expect screen 3; expect active 1;
        swipe 240 290 240 140; wait 300; expect screen 3; expect active 1;
        shot shot-active.bmp; tap 240 394; wait 300; expect screen 2; expect active 0; quit
    '''),
    ('recipe-gesture', '''
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300;
        expect screen 2; expect hidden CURRENT TEMP; expect hidden PRESSURE; expect text °C; expect hidden bar; expect hidden EDIT;
        swipe 240 340 240 180; wait 300; expect screen 4; expect active 0; quit
    '''),
    # The count in the eyebrow is gone; the focused card's name is the position check.
    ('wheel-neighbor', '''
        wait 3000; tap 240 240; wait 300; tap 240 216; wait 300;
        tap 240 310; wait 300; swipe 370 224 110 224 600; wait 700;
        swipe 370 224 110 224 600; wait 700; expect text PROFILES;
        expect text Classic 9 bar; expect hidden Turbo; expect hidden Bloom;
        shot wheel.bmp; swipe 370 224 110 224 600; wait 700; expect hidden Classic 9 bar;
        expect text Turbo; expect hidden Bloom;
        swipe 370 224 110 224 600; wait 700; expect hidden Turbo; expect text Bloom;
        swipe 110 224 370 224 600; wait 700; expect text Turbo;
        tap 240 224; wait 300; expect screen 2; expect text Turbo; quit
    '''),
    ('brew-scale-edit', '''
        scale 1; wait 3000; tap 240 240; wait 300; tap 240 216; wait 300;
        weight 8.5; wait 300; expect text 8.5 g; expect text TARE;
        tap 126 392; wait 300; expect text 0.0 g; expect active 0; expect screen 2;
        tap 404 176; wait 300; expect temperature 93; expect hidden UNSAVED;
        shot brew-scale.bmp; theme 1; wait 2200; shot brew-light.bmp;
        theme 2; wait 2200; shot brew-amoled.bmp;
        tap 240 310; wait 300; tap 240 392; wait 300; expect text ADJUST; expect text TEMPERATURE;
        tap 384 182; wait 300; expect temperature 94;
        tap 240 392; wait 300; expect text USE ONCE; tap 240 346; wait 500; expect text UNSAVED;
        tap 240 310; wait 300; tap 240 392; wait 300; tap 240 392; wait 300; tap 240 222; wait 500;
        expect screen 2; expect temperature 94; expect hidden CURRENT TEMP; expect text °C; expect hidden UNSAVED;
        tap 290 392; wait 400; expect screen 3; expect active 1;
        tap 240 394; wait 300; expect active 0; quit
    '''),
    ('grind-progress', '''
        wait 3000; tap 240 240; wait 300; tap 240 294; wait 300;
        expect text 0:25; tap 240 392; wait 300;
        expect grind-active 1; expect text GRIND; expect hidden GRINDING; expect hidden STOP & MODES;
        tap 240 240; wait 300; expect screen 8; expect grind-active 1; expect hidden +;
        swipe 240 300 240 150; wait 300; expect screen 8; expect grind-active 1;
        shot grind-active.bmp; tap 240 392; wait 300; expect grind-active 0;
        expect text 0:25; quit
    '''),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    output = args.output or Path(tempfile.mkdtemp(prefix='bettermate-usability-'))
    output.mkdir(parents=True, exist_ok=True)
    for name, script in CASES:
        prefs = dict(PREFS, wl_temp='2', wl_flush='1') if name == 'water-readout' else PREFS
        run_case(ROOT / '.pio/build/display-sim/program', output, name, script, prefs, BREW_PROFILES)
    for bmp in output.glob('*/*.bmp'):
        with Image.open(bmp) as frame:
            frame.save(bmp.with_suffix('.png'))
    print(f"Usability checks passed: {sum(s.count('expect ') for _, s in CASES)} assertions. Captures: {output}")


if __name__ == '__main__':
    main()
