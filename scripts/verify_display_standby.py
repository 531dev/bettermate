#!/usr/bin/env python3
"""Verify Standby navigation and wake guards, and capture its themes and AMOLED rest behavior.

Build first with `pio run -e display-sim`, then run this script. Screenshots and logs stay in a fresh
scratch directory (printed at the end), never in the simulator's usual persisted state.
"""

import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def run_case(binary, output, name, script, preferences=None):
    case = output / name
    case.mkdir()
    if preferences:
        nvs = case / "sim_data" / "nvs"
        nvs.mkdir(parents=True)
        (nvs / "controller.json").write_text(json.dumps(preferences))
    print(f"Checking {name}...", flush=True)
    env = dict(os.environ, SIM_HTTP_PORT="8090")
    with (case / "simulator.log").open("w") as log:
        subprocess.run([str(binary), "--script", script], cwd=case, env=env, stdout=log,
                       stderr=subprocess.STDOUT, check=True, timeout=140)
    print(f"Passed {name}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", type=Path, default=ROOT / ".pio/build/display-sim/program")
    parser.add_argument("--output", type=Path, help="New directory for screenshots, logs and isolated simulator state")
    args = parser.parse_args()
    binary = args.binary.resolve()
    if not binary.is_file():
        parser.error("Build the simulator with pio run -e display-sim first")
    output = args.output.resolve() if args.output else Path(tempfile.mkdtemp(prefix="bettermate-standby-"))
    if args.output:
        output.mkdir(parents=True)
    print(f"Captures: {output}", flush=True)

    run_case(binary, output, "themes-navigation", """
        wait 3000; expect screen 1; expect mode 0; expect active 0; shot standby-dark.bmp;
        theme 1; wait 1500; shot standby-light.bmp;
        theme 2; wait 1500; shot standby-amoled.bmp;
        tap 240 240; wait 1000; expect screen 2; expect mode 1; expect active 0; shot wake-brew.bmp;
        tap 240 450; wait 1000; expect screen 4; shot menu.bmp;
        tap 240 450; wait 1000; expect screen 1; expect mode 0; shot return-standby.bmp;
        tap 50 240; wait 1000; expect screen 2; expect mode 1; expect active 0; quit
    """)

    # A schedule several days away exercises the weekday label without waking during this check.
    days = ["0"] * 7
    days[(datetime.datetime.now(datetime.timezone.utc).weekday() + 3) % 7] = "1"
    run_case(binary, output, "clock-rest", """
        wait 3000; shot standby-12h-scheduled.bmp;
        wait 31000; expect screen 1; expect mode 0; shot standby-rest.bmp;
        wait 61000; shot standby-drift.bmp;
        tap 240 240; wait 1000; expect screen 2; expect mode 1; expect active 0; shot rest-wake-brew.bmp;
        tap 240 450; wait 1000; expect screen 4;
        tap 240 450; wait 1000; expect screen 1; shot rest-reset-standby.bmp; quit
    """, {"theme": "2", "clk_24h": "0", "ab_en": "1", "ab_schedules": f"07:00|{''.join(days)}"})

    run_case(binary, output, "wake-guards", """
        wait 3000; controller disconnected; wait 1500; shot disconnected.bmp;
        tap 240 240; wait 1000; expect screen 1; expect mode 0; expect active 0;
        controller connected; wait 1500; protocol 4; wait 1500; shot mismatch-display.bmp;
        tap 240 240; wait 1000; expect screen 1; expect mode 0; expect active 0;
        protocol 2; wait 1500; shot mismatch-controller.bmp;
        tap 240 240; wait 1000; expect screen 1; expect mode 0; expect active 0;
        protocol 3; wait 1000; error 4; wait 1000; shot temperature-error.bmp;
        tap 240 240; wait 1000; expect screen 1; expect mode 0; expect active 0;
        error 1; wait 1000; shot unknown-error.bmp;
        tap 240 240; wait 1000; expect screen 1; expect mode 0; expect active 0;
        error 0; wait 1000; autotune; wait 200; shot autotuning.bmp;
        tap 240 240; expect screen 1; expect mode 0; expect active 0;
        wait 2000; tap 240 240; wait 1000; expect screen 2; expect mode 1; expect active 0;
        update; wait 1000; shot updating.bmp;
        tap 240 240; wait 1000; expect screen 1; expect mode 0; expect active 0; quit
    """)
    print(f"Standby checks passed. Inspect screenshots in {output}", flush=True)


if __name__ == "__main__":
    main()
