"""Drive the display simulator from a verification script.

    from display_sim import Checks, Sim

    checks = Checks("brew")
    sim = Sim("brew-heating")
    sim.run("wait 3500; mode brew; wait 3000; redraw settle.json; shot brew.bmp; layout brew.json; quit")
    page = sim.layout("brew.json")
    checks.equal(page.screen, "brew", "the Brew screen is on the glass")
    checks.true(page.has("START"), "START is visible")
    checks.at_most(max(sim.redraw("settle.json")), 25.0, "no frame of the screen change repaints over 25%")
    sim.save("brew.bmp", "docs/display/v2/brew/heating.png")
    checks.finish()

Each Sim runs the simulator once, headless, in its own scratch directory (the simulator keeps its state in
./sim_data), so cases never see each other's settings. Script verbs are listed in sim/SimScript.h. Build the
simulator first: pio run -e display-sim. SIM_BIN overrides the program path.
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PANEL_PX = 480 * 480


def same_color(actual, expected, tolerance=8):
    """Compares two "#rrggbb" colors as the 16-bit panel shows them (5, 6 and 5 bits a channel)."""
    if not actual or not expected:
        return False
    a, e = int(actual[1:], 16), int(expected[1:], 16)
    return all(abs(((a >> shift) & 0xFF) - ((e >> shift) & 0xFF)) <= tolerance for shift in (16, 8, 0))


class Page:
    """One `layout` dump: the screen, the ring and every visible object."""

    def __init__(self, path):
        lines = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
        head = lines[0]
        self.screen = head["screen"]
        self.settled = head["settled"]
        self.ring = head["ring"]
        self.objects = lines[1:]

    def texts(self):
        return [o["text"] for o in self.objects if "text" in o]

    def has(self, text):
        return text in self.texts()

    def find(self, text):
        """The object showing exactly this text, or None."""
        return next((o for o in self.objects if o.get("text") == text), None)

    def containing(self, fragment):
        return [o for o in self.objects if fragment in o.get("text", "")]

    def clickable(self):
        return [o for o in self.objects if o["clickable"] and o["depth"] > 0]


class Sim:
    _next_port = 8200

    def __init__(self, name, port=None):
        self.name = name
        self.dir = Path(tempfile.mkdtemp(prefix=f"bm-{name}-"))
        self.program = Path(os.environ.get("SIM_BIN", ROOT / ".pio/build/display-sim/program"))
        if port is None:
            port = int(os.environ.get("SIM_PORT_BASE", Sim._next_port))
            Sim._next_port = port + 1
        self.port = port
        self.log = ""

    def run(self, script, timeout=180, check=True):
        """Runs one script to its `quit`. Returns the exit status; 3 means an `expect` failed."""
        if not self.program.exists():
            raise SystemExit(f"{self.program} not found: run `pio run -e display-sim` first")
        env = dict(os.environ, SIM_HTTP_PORT=str(self.port), SDL_VIDEODRIVER="dummy")
        done = subprocess.run([str(self.program), "--script", script], cwd=self.dir, env=env, capture_output=True, text=True, timeout=timeout)
        self.log = done.stderr + done.stdout
        if check and done.returncode != 0:
            tail = "\n".join(line for line in self.log.splitlines() if "sim-script" in line)
            raise AssertionError(f"[{self.name}] simulator exited with {done.returncode}\n{tail}")
        return done.returncode

    def verified(self):
        """The `expect` steps that passed, as the simulator reported them."""
        return [line.split("verified ", 1)[1] for line in self.log.splitlines() if "[sim-script] verified " in line]

    def layout(self, name):
        return Page(self.dir / name)

    def redraw(self, name):
        """Percent of the panel repainted by each frame recorded in a `redraw` file."""
        rows = [json.loads(line) for line in (self.dir / name).read_text().splitlines() if line.strip()]
        return [row["px"] * 100.0 / PANEL_PX for row in rows]

    def save(self, bmp, destination):
        """Copies a `shot` into the repository as a PNG."""
        target = ROOT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        if shutil.which("sips"):
            subprocess.run(["sips", "-s", "format", "png", str(self.dir / bmp), "--out", str(target)], check=True, capture_output=True)
        else:
            from PIL import Image

            Image.open(self.dir / bmp).save(target)
        return target


class Checks:
    def __init__(self, suite):
        self.suite = suite
        self.passed = 0
        self.failures = []

    def true(self, condition, message):
        if condition:
            self.passed += 1
        else:
            self.failures.append(message)
            print(f"FAIL {message}")

    def equal(self, actual, expected, message):
        self.true(actual == expected, f"{message}: expected {expected!r}, got {actual!r}")

    def color(self, actual, expected, message):
        self.true(same_color(actual, expected), f"{message}: expected {expected}, got {actual}")

    def at_most(self, actual, limit, message):
        self.true(actual <= limit, f"{message}: {actual:.1f} is over {limit}")

    def count(self, sim):
        """Counts the simulator's own `expect` steps as checks."""
        self.passed += len(sim.verified())

    def finish(self):
        print(f"{self.suite}: {self.passed} checks passed, {len(self.failures)} failed")
        if self.failures:
            sys.exit(1)
