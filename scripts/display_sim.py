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

SIM_PANEL_SIZE=466 runs the same checks on a 466 px panel (the round AMOLED boards). Scripts and layout dumps
stay in the design's 480 px box, which the simulator centres on the panel; a `shot` is in panel pixels, so read
one through SHOT_SHIFT. Redrawn shares are of the panel that is there, and captures go to
docs/display/v2/466/ instead of docs/display/v2/.
"""

import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DESIGN = 480
PANEL = int(os.environ.get("SIM_PANEL_SIZE") or DESIGN)
PANEL_PX = PANEL * PANEL
# Add this to a design coordinate to find it in a `shot`: 0 on a 480 px panel, -7 on a 466 px one.
SHOT_SHIFT = (PANEL - DESIGN) // 2
SHOTS = "docs/display/v2/"


def same_color(actual, expected, tolerance=8):
    """Compares two "#rrggbb" colors as the 16-bit panel shows them (5, 6 and 5 bits a channel)."""
    if not actual or not expected:
        return False
    a, e = int(actual[1:], 16), int(expected[1:], 16)
    return all(abs(((a >> shift) & 0xFF) - ((e >> shift) & 0xFF)) <= tolerance for shift in (16, 8, 0))


def pixels(path):
    """A `shot` as (size, at): at(x, y) -> (red, green, blue), x and y in panel pixels."""
    data = Path(path).read_bytes()
    (offset,) = struct.unpack_from("<I", data, 10)
    width, height = struct.unpack_from("<ii", data, 18)
    if struct.unpack_from("<H", data, 28)[0] != 24:
        raise SystemExit(f"{path}: expected a 24-bit BMP")
    stride = (width * 3 + 3) & ~3

    def at(x, y):
        base = offset + ((height - 1 - y) if height > 0 else y) * stride + x * 3
        blue, green, red = data[base : base + 3]
        return red, green, blue

    return width, at


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

    def run(self, script, timeout=180, check=True, env=None):
        """Runs one script to its `quit`. Returns the exit status; 3 means an `expect` failed.

        `env` adds environment variables for this run (SIM_TRACE_FLUSH=1 for flushes()).
        """
        if not self.program.exists():
            raise SystemExit(f"{self.program} not found: run `pio run -e display-sim` first")
        env = dict(os.environ, SIM_HTTP_PORT=str(self.port), SDL_VIDEODRIVER="dummy", **(env or {}))
        done = subprocess.run([str(self.program), "--script", script], cwd=self.dir, env=env, capture_output=True, text=True, timeout=timeout)
        self.log = done.stderr + done.stdout
        if check and done.returncode != 0:
            tail = "\n".join(line for line in self.log.splitlines() if "sim-script" in line)
            raise AssertionError(f"[{self.name}] simulator exited with {done.returncode}\n{tail}")
        return done.returncode

    def verified(self):
        """The `expect` steps that passed, as the simulator reported them."""
        return [line.split("verified ", 1)[1] for line in self.log.splitlines() if "[sim-script] verified " in line]

    def flushes(self):
        """Every rectangle the run repainted, in order, as (x, y, width, height) in panel pixels. Needs SIM_TRACE_FLUSH."""
        found = []
        for line in self.log.splitlines():
            if line.startswith("[flush] "):
                corner, size = line.split()[-2:]
                found.append((*map(int, corner.split(",")), *map(int, size.split("x"))))
        return found

    def layout(self, name):
        return Page(self.dir / name)

    def redraw(self, name):
        """Percent of the panel repainted by each frame recorded in a `redraw` file."""
        rows = [json.loads(line) for line in (self.dir / name).read_text().splitlines() if line.strip()]
        return [row["px"] * 100.0 / PANEL_PX for row in rows]

    def save(self, bmp, destination):
        """Copies a `shot` into the repository as a PNG.

        A capture that already exists is kept (every run would otherwise rewrite it, if only because the clock
        moved on). Set UPDATE_SHOTS=1 to take them all again.
        """
        if PANEL != DESIGN and str(destination).startswith(SHOTS):
            destination = f"{SHOTS}{PANEL}/{str(destination)[len(SHOTS):]}"
        target = ROOT / destination
        if target.exists() and not os.environ.get("UPDATE_SHOTS"):
            return target
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
