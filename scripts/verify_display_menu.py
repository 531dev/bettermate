#!/usr/bin/env python3
"""Checks the mode menu, Information and Warnings: what is on the glass in each state, where every control
leads, what the QR codes say, and what each frame of a change repaints.

    pio run -e display-sim && SIM_PORT_BASE=8250 python3 scripts/verify_display_menu.py

The simulator needs no verb of its own for any of this. Settings are changed the way a person changes them,
through its web API on SIM_HTTP_PORT, while a script runs:

    grinder               POST /api/settings altRelayFunction=1 (the default) or 0
    warning levels        warnFlush, warnTemperature, warnWaterLevel, warnSteamSwitch, warnScaleConnected:
                          0 ignore, 1 warn, 2 error
    Flush recommended     entering Brew raises it (at warn level by default)
    Temperature unstable  raised while the boiler heats
    Scale disconnected    savedScale=<any address>: the simulator has no Bluetooth scale to find
    Water low             emptyTankDistance=44, fullTankDistance=10: the mock tank reads 40 mm
    Steam switch on       script verbs `key 2 down`, then `mode brew`
    confirm question      a tap on START in Brew while a warning is at error level; answered from outside
                          over the web socket: req:brew:confirm:cancel, or req:process:activate with
                          ignoreWarnings

The QR codes are decoded from the captures with scripts/detect_display_qr.swift (macOS, Vision).
"""

import base64
import json
import math
import os
import shutil
import socket
import struct
import subprocess
import threading
import time
import urllib.parse
import urllib.request

from display_sim import ROOT, Checks, Sim, same_color

checks = Checks("display menu")
SHOTS = "docs/display/v2/menu"
BUDGET = 25.0  # percent of the panel in one frame of a change (design/reference/motion.md)
peaks = []  # (what, largest frame in percent), for the summary

# Display black, the default theme (design/tokens.json); the panel shows 16-bit color, so colors are compared
# with a tolerance.
INK, ON_INK, MUTED = "#f2f2f2", "#000000", "#a6a6a6"
SURFACE_0, SURFACE_1, SURFACE_2 = "#000000", "#141414", "#232323"
PRIMARY, ON_PRIMARY = "#5361ff", "#ffffff"
WARNING, WARNING_SOFT, DANGER, DANGER_SOFT = "#f5b400", "#3d2e00", "#ff6b6b", "#4a1414"
QR_GROUND = "#ffffff"

DISC = 58  # a mode disc is 116 px
MODES = ["BREW", "STEAM", "WATER", "GRIND", "INFO"]
NO_GRINDER = ["BREW", "STEAM", "WATER", "INFO"]
AP_PASSWORD = "simulator-ap"  # made up; it must show in the setup network's code and nowhere else


# ---- the simulator from outside ------------------------------------------------------------------------------


def settings(sim, **values):
    """POSTs settings to the simulator's web API and returns all of them, as the web UI's Settings page does."""
    data = urllib.parse.urlencode(values).encode()
    for _ in range(200):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{sim.port}/api/settings", data=data, timeout=3) as reply:
                return json.loads(reply.read().decode())
        except OSError:
            time.sleep(0.05)
    raise RuntimeError("the simulator's web API did not answer")


def socket_send(sim, message):
    """Sends one message over the web socket the web UI uses (RFC 6455: a handshake, then one masked text frame)."""
    link = socket.create_connection(("127.0.0.1", sim.port), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    link.sendall(
        f"GET /ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n".encode()
    )
    head = b""
    while b"\r\n\r\n" not in head:
        head += link.recv(1024)
    if b" 101 " not in head.split(b"\r\n", 1)[0]:
        raise RuntimeError(f"no web socket: {head[:60]!r}")
    payload = json.dumps(message).encode()
    mask = os.urandom(4)
    size = bytes([0x80 | len(payload)]) if len(payload) < 126 else bytes([0x80 | 126]) + struct.pack(">H", len(payload))
    link.sendall(bytes([0x81]) + size + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload)))
    time.sleep(0.2)
    link.close()


def drive(sim, script, steps=()):
    """Runs a script while acting on the simulator from outside. A step is (file, action): the action runs once
    the script has written that file with a `layout` or `redraw` step, so nothing here depends on timing."""
    for name, _ in steps:
        (sim.dir / name).unlink(missing_ok=True)
    reached, over = [], threading.Event()

    def watch():
        for name, action in steps:
            while not (sim.dir / name).exists():
                if over.wait(0.02):
                    return
            try:
                action()
            except (OSError, RuntimeError) as error:
                reached.append(f"{name} failed: {error}")
                return
            reached.append(name)

    watcher = threading.Thread(target=watch, daemon=True)
    watcher.start()
    try:
        sim.run(script)
    finally:
        over.set()
        watcher.join(timeout=10)
    checks.count(sim)
    if steps:
        wanted = [name for name, _ in steps]
        checks.true(reached == wanted, f"[{sim.name}] acted from outside at {wanted}: got {reached}")


def seeded(name, **values):
    """A simulator whose settings were changed before its first real run (they persist in its sim_data)."""
    sim = Sim(name)
    drive(sim, "wait 500; layout seeded.json; wait 900; quit", [("seeded.json", lambda: settings(sim, **values))])
    return sim


def case(body):
    """One group of checks. An `expect` step that fails stops its script; the rest of the group is skipped."""
    try:
        body()
    except (AssertionError, FileNotFoundError, StopIteration, KeyError, TypeError) as error:
        checks.true(False, f"{body.__name__}: {type(error).__name__}: {str(error).strip()[:400]}")


def budget(sim, name, what, limit=BUDGET):
    frames = sim.redraw(name) or [0.0]
    peaks.append((what, max(frames)))
    checks.at_most(max(frames), limit, f"{what}: no frame repaints over {limit:.0f}% of the panel")


def note(sim, name, what):
    """A change this lane cannot bring under the budget (it says why in the summary): measured, not judged."""
    frames = sim.redraw(name) or [0.0]
    peaks.append((what + " (not judged)", max(frames)))


def decode(paths):
    """The content of the QR code in each capture, read back from the pixels."""
    swift = shutil.which("swift")
    if swift is None:
        return None
    done = subprocess.run([swift, str(ROOT / "scripts/detect_display_qr.swift"), *map(str, paths)], capture_output=True, text=True, timeout=300)
    return json.loads(done.stdout) if done.returncode == 0 else {}


# ---- reading a layout dump -----------------------------------------------------------------------------------


def box(obj):
    return (obj["x1"], obj["y1"], obj["x2"], obj["y2"])


def parent(page, obj):
    return next(o for o in page.objects if o["id"] == obj["parent"])


def children(page, obj, kind=None):
    return [o for o in page.objects if o["parent"] == obj["id"] and (kind is None or o["kind"] == kind)]


def at(page, area, kind="obj"):
    """The object with exactly this box, or None."""
    return next((o for o in page.objects if box(o) == area and o["kind"] == kind and o["depth"] > 0), None)


def spots(count):
    """Where the design puts `count` discs: on a 134 px circle, clockwise from 12 o'clock (bundle.js, screens.menu)."""
    angles = [math.radians(-90 + i * 360 / count) for i in range(count)]
    return [(math.floor(240 + 134 * math.cos(a) + 0.5), math.floor(240 + 134 * math.sin(a) + 0.5)) for a in angles]


def check_menu(page, names, active, what, ink=INK, on_ink=ON_INK, muted=MUTED, card=SURFACE_1, disc=SURFACE_2):
    """The menu as the design draws it: each named disc in its place with its glyph and name, `active` in ink."""
    checks.equal(page.screen, "menu", f"{what}: the menu is on the glass")
    checks.equal(page.ring["layout"], "none", f"{what}: the menu draws no ring")
    shown = [t for t in page.texts() if t in MODES]
    checks.equal(sorted(shown), sorted(names), f"{what}: the discs on the glass")
    for name, (cx, cy) in zip(names, spots(len(names))):
        label = page.find(name)
        if label is None:
            continue
        body = parent(page, label)
        on = name == active
        checks.equal(box(body), (cx - DISC, cy - DISC, cx + DISC - 1, cy + DISC - 1), f"{what}: {name} is a 116 px disc at {cx}, {cy}")
        checks.true(body["clickable"] and body["radius"] >= DISC, f"{what}: {name} is one round control")
        checks.color(body.get("fill"), ink if on else card, f"{what}: {name} is {'ink' if on else 'surface-1'}")
        checks.color(label["color"], on_ink if on else muted, f"{what}: the name {name} is {'on-ink' if on else 'muted'}")
        checks.equal(label["baseline"], cy + 32, f"{what}: the name {name} sits 32 px under the disc's centre")
        glyphs = children(page, body, "img")
        checks.true(len(glyphs) == 1 and box(glyphs[0]) == (cx - 18, cy - 32, cx + 17, cy + 3), f"{what}: {name} carries a 36 px icon 14 px above its centre")
        if glyphs:
            checks.color(glyphs[0]["color"], on_ink if on else ink, f"{what}: the icon of {name} is {'on-ink' if on else 'ink'}")
    power = at(page, (196, 196, 283, 283))
    checks.true(power is not None and power["clickable"], f"{what}: the power disc is at the centre, 88 px across")
    if power is not None:
        checks.color(power.get("fill"), disc, f"{what}: the power disc is surface-2")
        glyphs = children(page, power, "img")
        checks.true(len(glyphs) == 1 and box(glyphs[0]) == (222, 222, 257, 257), f"{what}: the power disc carries a 36 px icon")


def slot(page):
    """The exception glyph at 12 o'clock, or None."""
    body = at(page, (212, 6, 267, 61))
    glyphs = children(page, body, "img") if body else []
    return glyphs[0] if glyphs else None


def check_cards(page, rows, what):
    """Warnings: one surface-1 card for each row, 384 x 64 at x 48 and 72 px apart from y 138, its chip and sentence."""
    cards = [o for o in page.objects if o["kind"] == "obj" and o["depth"] == 1 and o["x1"] == 48 and o["x2"] == 431 and o["y2"] - o["y1"] == 63]
    checks.equal([c["y1"] for c in cards], [138 + 72 * i for i in range(len(rows))], f"{what}: {len(rows)} cards, 72 px apart from y 138")
    for card, (level, sentence) in zip(cards, rows):
        error = level == "ERROR"
        checks.color(card.get("fill"), SURFACE_1, f"{what}: the card of '{sentence}' is surface-1")
        checks.equal(card["radius"], 20, f"{what}: the card of '{sentence}' has a 20 px corner")
        texts = children(page, card, "label")
        chip = next((t for t in texts if t["text"] == level), None)
        line = next((t for t in texts if t["text"] == sentence), None)
        checks.true(chip is not None and line is not None, f"{what}: a card reads {level} and '{sentence}'")
        if chip is None or line is None:
            continue
        width = 90 if error else 76
        checks.equal(box(chip), (62, card["y1"] + 14, 62 + width - 1, card["y1"] + 49), f"{what}: the {level} chip is {width} x 36, 14 px into its card")
        checks.color(chip.get("fill"), DANGER_SOFT if error else WARNING_SOFT, f"{what}: the {level} chip sits on {'danger' if error else 'warning'}-soft")
        checks.color(chip["color"], DANGER if error else WARNING, f"{what}: the word {level} is {'danger' if error else 'warning'}")
        checks.equal((line["x1"], line["baseline"]), (62 + width + 14, card["y1"] + 40), f"{what}: '{sentence}' starts 14 px after its chip, baseline 40 px down")
        checks.color(line["color"], INK, f"{what}: '{sentence}' is ink")
        checks.equal(line["font"], 26, f"{what}: '{sentence}' is set in screen-body")


def check_pill(page, text, fill, ink, what):
    pill = page.find(text)
    checks.true(pill is not None and box(pill) == (156, 340, 323, 403) and pill["clickable"], f"{what}: {text} is the 168 x 64 pill at y 340")
    if pill is not None:
        checks.color(pill.get("fill"), fill, f"{what}: the {text} pill's fill")
        checks.color(pill["color"], ink, f"{what}: the {text} pill's label")


# ---- the menu ------------------------------------------------------------------------------------------------


def menu_from_standby():
    sim = Sim("menu-standby")
    drive(
        sim,
        "wait 3500; expect screen standby; redraw skip.redraw;"
        "tap 240 362; wait 1300; expect screen menu; expect mode 1; expect active 0; redraw wake.redraw;"
        "shot menu.bmp; layout menu.json;"
        # The corner of a disc's box is not the disc.
        "tap 186 52; wait 500; expect screen menu; redraw skip.redraw;"
        # The 14 px where the slot's touch disc and the top disc overlap belong to the slot.
        "tap 240 55; wait 1300; expect screen warnings; redraw lens.redraw;"
        "tap 240 372; wait 1500; expect screen menu; redraw done.redraw; layout back.json;"
        "tap 240 240; wait 1700; expect screen standby; expect mode 0; redraw power.redraw; quit",
    )
    page = sim.layout("menu.json")
    check_menu(page, MODES, "BREW", "opened with WAKE")
    glyph = slot(page)
    checks.true(glyph is not None and box(glyph) == (226, 20, 253, 47), "opened with WAKE: the warning glyph is 28 px at 12 o'clock")
    if glyph is not None:
        checks.color(glyph["color"], WARNING, "opened with WAKE: the glyph is warning (flush recommended after waking)")
        top = parent(page, page.find("BREW"))
        checks.true(glyph["y2"] < top["y1"], "opened with WAKE: the glyph ends above the top disc and neither covers the other")
    check_menu(sim.layout("back.json"), MODES, "BREW", "back from the warnings")
    budget(sim, "wake.redraw", "Standby to Menu (WAKE)")
    budget(sim, "lens.redraw", "Menu to Warnings (glyph)")
    budget(sim, "done.redraw", "Warnings to Menu (DONE)")
    budget(sim, "power.redraw", "Menu to Standby (power disc)")
    sim.save("menu.bmp", f"{SHOTS}/menu-from-standby.png")


def menu_from_brew():
    sim = Sim("menu-brew")
    drive(
        sim,
        "wait 3500; mode brew; wait 2500; expect screen brew; redraw skip.redraw;"
        "tap 240 446; wait 1300; expect screen menu; expect mode 1; redraw handle.redraw; layout handle.json;"
        # A swipe down puts the menu away: back to the mode it was opened from.
        "swipe 436 200 436 360; wait 1500; expect screen brew; expect mode 1; redraw down.redraw;"
        "swipe 240 250 240 90; wait 1300; expect screen menu; redraw up.redraw;"
        # So does a tap on the ink disc.
        "tap 240 106; wait 1500; expect screen brew; expect mode 1; redraw brew.redraw;"
        "tap 240 446; wait 1300; expect screen menu; redraw skip.redraw;"
        "press 367 199; wait 130; layout pressed.json; shot pressed.bmp; release; wait 1500;"
        "expect screen steam; expect mode 2; redraw steam.redraw;"
        # Opened from Steam the menu puts the machine back in Brew and draws STEAM in ink.
        "tap 240 446; wait 1300; expect screen menu; expect mode 1; layout from-steam.json; shot from-steam.bmp;"
        "swipe 436 200 436 360; wait 1500; expect screen steam; expect mode 2;"
        "tap 240 446; wait 1300; expect screen menu; redraw skip.redraw;"
        "tap 319 348; wait 1500; expect screen water; expect mode 3; redraw water.redraw;"
        "tap 240 446; wait 1300; expect screen menu; layout from-water.json; redraw skip.redraw;"
        "tap 161 348; wait 1500; expect screen grind; expect mode 4; redraw grind.redraw;"
        "tap 240 446; wait 1300; expect screen menu; layout from-grind.json; redraw skip.redraw;"
        "tap 113 199; wait 1500; expect screen info; expect mode 1; redraw info.redraw;"
        "tap 240 446; wait 1300; expect screen menu; redraw back.redraw; layout after-info.json; quit",
    )
    check_menu(sim.layout("handle.json"), MODES, "BREW", "opened with the handle")
    pressed = sim.layout("pressed.json")
    steam = parent(pressed, pressed.find("STEAM"))
    checks.color(steam.get("fill"), INK, "a pressed disc inverts to ink")
    checks.color(pressed.find("STEAM")["color"], ON_INK, "a pressed disc's name inverts to on-ink")
    checks.color(children(pressed, steam, "img")[0]["color"], ON_INK, "a pressed disc's icon inverts to on-ink")
    check_menu(sim.layout("from-steam.json"), MODES, "STEAM", "opened from Steam")
    check_menu(sim.layout("from-water.json"), MODES, "WATER", "opened from Water")
    check_menu(sim.layout("from-grind.json"), MODES, "GRIND", "opened from Grind")
    check_menu(sim.layout("after-info.json"), MODES, "GRIND", "back from Information: the ink disc stays where it was")
    budget(sim, "handle.redraw", "Brew to Menu (handle)")
    budget(sim, "down.redraw", "Menu to Brew (swipe down)")
    budget(sim, "up.redraw", "Brew to Menu (swipe up)")
    budget(sim, "brew.redraw", "Menu to Brew (ink disc)")
    budget(sim, "steam.redraw", "Menu to Steam")
    budget(sim, "water.redraw", "Menu to Water")
    budget(sim, "grind.redraw", "Menu to Grind")
    budget(sim, "info.redraw", "Menu to Information")
    budget(sim, "back.redraw", "Information to Menu (handle)")
    sim.save("from-steam.bmp", f"{SHOTS}/menu-from-steam.png")
    sim.save("pressed.bmp", f"{SHOTS}/menu-pressed.png")


def menu_grinder():
    # The grinder is switched off and on while the menu is on the glass: the discs that move leave in one
    # frame and come back re-spaced, a rank a frame.
    sim = Sim("menu-grinder")
    drive(
        sim,
        "wait 3500; tap 240 362; wait 1300; expect screen menu; expect text GRIND; redraw skip.redraw; layout five.json;"
        "wait 1500; expect hidden GRIND; redraw off.redraw; layout four.json;"
        "wait 1500; expect text GRIND; redraw on.redraw; layout again.json;"
        "wait 1500; expect hidden GRIND; quit",
        [
            ("five.json", lambda: settings(sim, altRelayFunction=0)),
            ("four.json", lambda: settings(sim, altRelayFunction=1)),
            ("again.json", lambda: settings(sim, altRelayFunction=0, warnFlush=0)),
        ],
    )
    check_menu(sim.layout("four.json"), NO_GRINDER, "BREW", "grinder switched off")
    check_menu(sim.layout("again.json"), MODES, "BREW", "grinder switched on again")
    budget(sim, "off.redraw", "Menu re-spaced, five discs to four")
    budget(sim, "on.redraw", "Menu re-spaced, four discs to five")

    # Started without a grinder, and with the flush reminder ignored: four discs and an empty 12 o'clock.
    drive(
        sim,
        "wait 3500; redraw skip.redraw; tap 240 362; wait 1300; expect screen menu; expect hidden GRIND; redraw wake.redraw;"
        "shot four.bmp; layout four.json;"
        # Where Grind sits with a grinder there is nothing to press now.
        "tap 161 348; wait 500; expect screen menu; expect mode 1; redraw skip.redraw;"
        # With no glyph above it the top disc answers to its upper edge.
        "tap 240 55; wait 1500; expect screen brew; redraw brew.redraw;"
        "tap 240 446; wait 1300; expect screen menu; redraw skip.redraw;"
        "tap 240 374; wait 1500; expect screen water; expect mode 3; redraw water.redraw; quit",
    )
    page = sim.layout("four.json")
    check_menu(page, NO_GRINDER, "BREW", "no grinder")
    checks.true(slot(page) is None, "no grinder, flush ignored: nothing at 12 o'clock while all is normal")
    budget(sim, "wake.redraw", "Standby to Menu (four discs)")
    budget(sim, "brew.redraw", "Menu to Brew (four discs)")
    budget(sim, "water.redraw", "Menu to Water (four discs)")
    sim.save("four.bmp", f"{SHOTS}/menu-no-grinder.png")


def menu_forced():
    # A change the menu did not ask for: a mode set from the web UI, a button on the machine, the standby
    # timeout. The host takes the menu's ranks away one a frame, with nothing put away beforehand.
    sim = Sim("menu-forced")
    drive(
        sim,
        "wait 3500; tap 240 362; wait 1300; expect screen menu; redraw skip.redraw;"
        "mode brew; wait 1500; expect screen brew; redraw brew.redraw;"
        "tap 240 446; wait 1300; expect screen menu; redraw skip.redraw;"
        "key 2 down; wait 1500; expect screen steam; expect mode 2; redraw steam.redraw; key 2 up; wait 1500; expect screen brew;"
        "tap 240 446; wait 1300; expect screen menu; redraw skip.redraw;"
        "mode standby; wait 1700; expect screen standby; redraw standby.redraw; quit",
    )
    budget(sim, "brew.redraw", "Menu to Brew, forced (mode set elsewhere)")
    budget(sim, "steam.redraw", "Menu to Steam, forced (steam switch)")
    # Standby's clock repaints on each of its three frames (13.2, 13.8 and 15.6% with its label, line and
    # WAKE). With the menu's 34% that is over three quarters of the panel in three frames: it cannot fit.
    note(sim, "standby.redraw", "Menu to Standby, forced (mode set elsewhere)")


def menu_disconnected():
    # Without the controller the display sits on Standby and WAKE is away, so the menu is only reached from
    # Information. The script's `mode brew` is a shortcut the display itself never offers; what it shows is
    # the menu while no mode can be entered.
    sim = Sim("menu-disconnected")
    drive(
        sim,
        "wait 3500; tap 240 362; wait 1300; expect screen menu; redraw skip.redraw;"
        "controller disconnected; wait 2500; expect screen standby; expect hidden WAKE; redraw lost.redraw;"
        "mode brew; wait 1500; expect screen brew; tap 240 446; wait 1300; expect screen menu;"
        "expect hidden BREW; expect hidden STEAM; expect hidden WATER; expect hidden GRIND; expect text INFO;"
        "shot alone.bmp; layout alone.json;"
        # Nothing where the modes were.
        "tap 367 199; wait 500; expect screen menu; tap 319 348; wait 500; expect screen menu;"
        # A swipe down has no ink disc to go back to: it falls back to the screen of the machine's mode.
        "swipe 436 200 436 360; wait 1500; expect screen brew; tap 240 446; wait 1300; expect screen menu;"
        # Information still answers, alone at the top.
        "tap 240 106; wait 1500; expect screen info; tap 240 446; wait 1300; expect screen menu; redraw skip.redraw;"
        "controller connected; wait 2500; expect text BREW; expect text GRIND; redraw found.redraw; layout found.json;"
        "controller disconnected; wait 2500; expect screen standby; mode brew; wait 1500; tap 240 446; wait 1300;"
        "expect screen menu; tap 240 240; wait 1700; expect screen standby; expect mode 0; quit",
    )
    page = sim.layout("alone.json")
    check_menu(page, ["INFO"], None, "controller lost")
    check_menu(sim.layout("found.json"), MODES, "BREW", "controller back")
    budget(sim, "found.redraw", "Menu re-spaced, one disc to five")
    # Not the menu's doing, and the same from Brew: the controller's loss starts the busy comet on a ring
    # that is not drawn yet, TickRing::plan gives that arc a pace of all 76 ticks, and 76 areas in one frame
    # are more than LVGL keeps (32), so it repaints the panel once.
    note(sim, "lost.redraw", "Menu to Standby, forced by the controller's loss")
    sim.save("alone.bmp", f"{SHOTS}/menu-disconnected.png")


# ---- Information ---------------------------------------------------------------------------------------------


def information():
    # The setup network's password is generated on first start; a fixed one keeps the captures the same.
    sim = seeded("info", apPassword=AP_PASSWORD)
    seen = {}
    drive(
        sim,
        "wait 3500; tap 240 362; wait 1300; tap 113 199; wait 1500; expect screen info;"
        "expect text CONNECTED TO; expect text GaggiMate-Sim; expect text 192.168.1.123; expect text SCAN TO OPEN;"
        "expect text ABOUT; expect hidden DISPLAY; shot station.bmp; layout station.json; redraw skip.redraw;"
        # ABOUT swaps the code for the versions, and NETWORK swaps back.
        "tap 240 400; wait 900; expect text NETWORK; expect hidden ABOUT; expect text DISPLAY; expect text CONTROLLER;"
        "expect text sim-3.0; expect hidden SCAN TO OPEN; expect hidden 192.168.1.123; expect text GaggiMate-Sim;"
        "redraw about.redraw; shot about.bmp; layout about.json;"
        "tap 240 400; wait 900; expect text ABOUT; expect hidden DISPLAY; expect text SCAN TO OPEN; redraw network.redraw;"
        "shot station-again.bmp;"
        # The setup network: its name, the address of the portal and a code that joins it.
        "wifi ap; wait 900; expect text SETUP NETWORK; expect text BetterMate; expect text 4.4.4.1; expect text SCAN TO JOIN;"
        "expect hidden SCAN TO OPEN; shot ap.bmp; layout ap.json;"
        "wifi ap-open; wait 900; expect text SETUP NETWORK; shot ap-open.bmp; layout ap-open.json;"
        # Nothing to scan: a sentence instead of a code.
        "wifi disconnected; wait 900; expect text OFFLINE; expect text The machine is not on Wi-Fi.;"
        "expect hidden SCAN TO OPEN; expect hidden SCAN TO JOIN; expect hidden GaggiMate-Sim; expect text ABOUT;"
        "shot offline.bmp; layout offline.json;"
        "tap 240 400; wait 900; expect text DISPLAY; expect text sim-3.0; expect hidden The machine is not on Wi-Fi.;"
        "shot offline-about.bmp; tap 240 400; wait 900; expect text The machine is not on Wi-Fi.;"
        "wifi sta; wait 900; expect text CONNECTED TO; expect text SCAN TO OPEN; redraw skip.redraw;"
        # Back: the handle, a swipe down, and the swipe up that reaches the menu from every other screen.
        "tap 240 446; wait 1300; expect screen menu; redraw handle.redraw;"
        "tap 113 199; wait 1500; expect screen info; redraw skip.redraw;"
        "swipe 240 150 240 330; wait 1300; expect screen menu; redraw down.redraw;"
        "tap 113 199; wait 1500; expect screen info; swipe 240 330 240 150; wait 1300; expect screen menu;"
        # Leaving with the versions showing, and coming back to the code.
        "tap 113 199; wait 1500; tap 240 400; wait 900; expect text DISPLAY; redraw skip.redraw;"
        "tap 240 446; wait 1300; expect screen menu; redraw from-about.redraw;"
        "tap 113 199; wait 1500; expect screen info; expect text ABOUT; expect text SCAN TO OPEN; expect hidden DISPLAY; quit",
        # What the machine holds as the setup network's password, read before `wifi ap-open` clears it.
        [("station.json", lambda: seen.update(settings(sim)))],
    )
    page = sim.layout("station.json")
    checks.equal(page.ring["layout"], "none", "Information draws no ring")
    for text, baseline, color, size, what in (
        ("CONNECTED TO", 84, MUTED, 25, "the label, screen-label in ink-muted"),
        ("GaggiMate-Sim", 122, INK, 32, "the network's name, screen-title in ink"),
        ("192.168.1.123", 322, INK, 25, "the address, screen-label in ink"),
        ("SCAN TO OPEN", 350, MUTED, 25, "the caption, screen-label in ink-muted"),
        ("ABOUT", 400, INK, 19, "ABOUT, screen-button in ink"),
    ):
        obj = page.find(text)
        checks.true(obj is not None and obj["baseline"] == baseline and obj["font"] == size, f"Information: {what}, baseline {baseline}")
        if obj is not None:
            checks.color(obj["color"], color, f"Information: {what}")
            checks.true(abs((obj["tx1"] + obj["tx2"]) / 2 - 239.5) <= 1.5, f"Information: {text} is centred")
    about = page.find("ABOUT")
    checks.true(about["clickable"] and about["y2"] - about["y1"] + 1 >= 56, "Information: ABOUT is a text button with a 56 px hit area")
    card = at(page, (166, 142, 313, 289))
    checks.true(card is not None and card["radius"] == 14, "Information: the QR card is 148 px at 166, 142 with a 14 px corner")
    checks.color(card and card.get("fill"), QR_GROUND, "Information: the QR card is white")
    code = children(page, card, "qrcode") if card else []
    checks.true(len(code) == 1 and box(code[0]) == (177, 153, 302, 278), "Information: the code keeps an 11 px quiet zone inside its card")
    handle = at(page, (212, 418, 267, 473))
    checks.true(handle is not None and handle["clickable"] and len(children(page, handle, "img")) == 1, "Information: the handle is the visible way back")

    versions = sim.layout("about.json")
    checks.true(not [o for o in versions.objects if o["kind"] == "qrcode"], "ABOUT: the code is away")
    captions = [versions.find("DISPLAY"), versions.find("CONTROLLER")]
    stated = sorted((o for o in versions.objects if o.get("font") == 26), key=lambda o: o["y1"])
    checks.true(None not in captions and len(stated) == 2, "ABOUT: the display's and the controller's version, each under its label")
    if None not in captions and len(stated) == 2:
        checks.true(captions[0]["y2"] < stated[0]["y1"] < captions[1]["y1"] < stated[1]["y1"], "ABOUT: label, version, label, version from the top")
        checks.true(stated[0]["text"].startswith("v") and stated[0]["x2"] - stated[0]["x1"] < 277, "ABOUT: the display's version stays inside the text square")
        checks.equal(stated[1]["text"], "sim-3.0", "ABOUT: the controller's version is the one it reported")
        checks.true(all(same_color(o["color"], INK) for o in stated) and all(same_color(o["color"], MUTED) for o in captions), "ABOUT: versions in ink under muted labels")

    ap = sim.layout("ap.json")
    password = seen.get("apPassword", "")
    checks.equal(password, AP_PASSWORD, "the setup network has a password to keep off the glass")
    for name in ("station.json", "about.json", "ap.json", "ap-open.json", "offline.json"):
        texts = sim.layout(name).texts()
        checks.true(not any(password in t or "simulator" in t for t in texts), f"{name}: no Wi-Fi password is ever a label")
    checks.true(at(ap, (166, 142, 313, 289)) is not None, "setup network: the QR card is in its place")
    offline = sim.layout("offline.json")
    checks.true(not [o for o in offline.objects if o["kind"] == "qrcode"] and at(offline, (166, 142, 313, 289)) is None, "offline: no code and no card")
    sentence = offline.find("The machine is not on Wi-Fi.")
    checks.true(sentence is not None and sentence["font"] == 26 and sentence["ty2"] - sentence["ty1"] < 30, "offline: one sentence in screen-body, on one line")
    checks.true(sentence is not None and same_color(sentence["color"], MUTED), "offline: the sentence is ink-muted")

    budget(sim, "about.redraw", "Information, the code to the versions")
    budget(sim, "network.redraw", "Information, the versions to the code")
    budget(sim, "handle.redraw", "Information to Menu (handle)")
    budget(sim, "down.redraw", "Information to Menu (swipe down)")
    budget(sim, "from-about.redraw", "Information to Menu (from the versions)")

    shots = {
        "station.bmp": f"{SHOTS}/info-station.png",
        "station-again.bmp": str(sim.dir / "station-again.png"),  # read back only; the same picture as the first
        "about.bmp": f"{SHOTS}/info-about.png",
        "ap.bmp": f"{SHOTS}/info-access-point.png",
        "ap-open.bmp": f"{SHOTS}/info-access-point-open.png",
        "offline.bmp": f"{SHOTS}/info-offline.png",
        "offline-about.bmp": f"{SHOTS}/info-offline-about.png",
    }
    saved = {bmp: sim.save(bmp, png) for bmp, png in shots.items()}
    expected = {
        "station.bmp": ("http://192.168.1.123/", "on Wi-Fi the code opens the web app"),
        "station-again.bmp": ("http://192.168.1.123/", "the code is back after ABOUT and NETWORK"),
        "ap.bmp": (f"WIFI:S:BetterMate;T:WPA;P:{password};;", "the setup network's code joins it"),
        "ap-open.bmp": ("WIFI:S:BetterMate;;;;", "an open setup network's code joins it"),
    }
    found = decode([saved[bmp] for bmp in expected])
    checks.true(found is not None, "swift is here to decode the QR codes (macOS)")
    for bmp, (content, what) in expected.items():
        checks.equal((found or {}).get(str(saved[bmp])), content, f"{what}: read back from the capture")


# ---- Warnings ------------------------------------------------------------------------------------------------


def warnings_from_brew():
    # Awake and heating: the flush reminder and the boiler, both at warn level. Then the levels change on
    # the glass, as someone changes them in the web UI.
    sim = Sim("warnings-brew")
    drive(
        sim,
        "wait 3500; mode brew; wait 2500; expect screen brew; redraw skip.redraw;"
        "tap 240 34; wait 1300; expect screen warnings; expect text BEFORE YOUR NEXT SHOT; redraw open.redraw;"
        "shot two.bmp; layout two.json;"
        "wait 1200; expect text ERROR; redraw level.redraw; shot error.bmp; layout error.json;"
        "wait 1200; expect text All clear; expect hidden WARN; expect hidden ERROR; expect text DONE; redraw clear.redraw;"
        "shot clear.bmp; layout clear.json;"
        "tap 240 372; wait 1500; expect screen brew; redraw done.redraw; quit",
        [
            ("two.json", lambda: settings(sim, warnFlush=2)),
            ("error.json", lambda: settings(sim, warnFlush=0, warnTemperature=0)),
        ],
    )
    page = sim.layout("two.json")
    checks.equal(page.ring["layout"], "none", "Warnings draws no ring")
    label = page.find("BEFORE YOUR NEXT SHOT")
    checks.true(label is not None and label["baseline"] == 112 and label["font"] == 25, "Warnings: the label, screen-label at baseline 112")
    checks.color(label and label["color"], MUTED, "Warnings: the label is ink-muted")
    check_cards(page, [("WARN", "Flush recommended"), ("WARN", "Temperature unstable")], "awake and heating")
    check_pill(page, "DONE", INK, ON_INK, "Warnings")
    checks.true(not page.has("CANCEL") and not page.has("START"), "Warnings: nothing is asked while nothing was started")
    check_cards(sim.layout("error.json"), [("ERROR", "Flush recommended"), ("WARN", "Temperature unstable")], "flush raised to error level")
    clear = sim.layout("clear.json")
    check_cards(clear, [], "no warning left")
    said = clear.find("All clear")
    checks.true(said is not None and said["font"] == 32, "no warning left: the screen says so, in screen-title")
    check_pill(clear, "DONE", INK, ON_INK, "no warning left")
    budget(sim, "open.redraw", "Brew to Warnings (glyph)")
    budget(sim, "level.redraw", "Warnings, a level changes")
    budget(sim, "clear.redraw", "Warnings, the last warning clears")
    budget(sim, "done.redraw", "Warnings to Brew (DONE)")
    sim.save("two.bmp", f"{SHOTS}/warnings.png")
    sim.save("error.bmp", f"{SHOTS}/warnings-error.png")
    sim.save("clear.bmp", f"{SHOTS}/warnings-clear.png")


def warnings_from_standby():
    # A saved scale that is not there raises the glyph on Standby too. Asleep, the boiler and the flush
    # reminder are left out, as they are for the glyph.
    sim = seeded("warnings-standby", savedScale="AA:BB:CC:DD:EE:FF")
    drive(
        sim,
        "wait 3500; expect screen standby; redraw skip.redraw;"
        "tap 240 34; wait 1300; expect screen warnings; expect mode 0; redraw open.redraw; shot asleep.bmp; layout asleep.json;"
        "tap 240 372; wait 1700; expect screen standby; expect mode 0; redraw done.redraw;"
        # A swipe down leaves as DONE does.
        "tap 240 34; wait 1300; expect screen warnings; redraw skip.redraw;"
        "swipe 240 130 240 320; wait 1700; expect screen standby; redraw down.redraw; quit",
    )
    check_cards(sim.layout("asleep.json"), [("WARN", "Scale disconnected")], "asleep")
    budget(sim, "open.redraw", "Standby to Warnings (glyph)")
    budget(sim, "done.redraw", "Warnings to Standby (DONE)")
    budget(sim, "down.redraw", "Warnings to Standby (swipe down)")
    sim.save("asleep.bmp", f"{SHOTS}/warnings-standby.png")


def warnings_confirm():
    # Five warnings, the flush reminder at error level: the two most severe get the cards and a line counts
    # the rest. START on Brew then has to be confirmed.
    sim = seeded("warnings-confirm", warnFlush=2, savedScale="AA:BB:CC:DD:EE:FF", emptyTankDistance=44, fullTankDistance=10)
    drive(
        sim,
        "wait 3500; mode brew; wait 2500; expect screen brew; tap 240 34; wait 1300; expect screen warnings;"
        "expect text AND 2 MORE; shot four.bmp; layout four.json; tap 240 372; wait 1500; expect screen brew;"
        # The steam switch left on is the fifth.
        "key 2 down; wait 800; mode brew; wait 1500; expect screen brew; tap 240 34; wait 1300; expect screen warnings;"
        "expect text AND 3 MORE; shot five.bmp; layout five.json; tap 240 372; wait 1500; expect screen brew; redraw skip.redraw;"
        # START asks first. CANCEL goes back and nothing runs.
        "tap 240 366; wait 1300; expect screen warnings; expect active 0; expect text START ANYWAY?; expect text CANCEL;"
        "expect hidden DONE; redraw asked.redraw; shot confirm.bmp; layout confirm.json;"
        # A question is answered with its buttons: a swipe down does nothing.
        "swipe 240 130 240 320; wait 900; expect screen warnings; expect text START ANYWAY?; redraw skip.redraw;"
        "tap 240 432; wait 1500; expect screen brew; expect active 0; expect mode 1; redraw cancel.redraw;"
        # START goes ahead.
        "tap 240 366; wait 1300; expect screen warnings; expect text START ANYWAY?; redraw skip.redraw;"
        "tap 240 372; wait 1500; expect screen shot; expect active 1; redraw start.redraw; quit",
    )
    rows = [("ERROR", "Flush recommended"), ("WARN", "Water low")]
    four = sim.layout("four.json")
    check_cards(four, rows, "four warnings")
    more = four.find("AND 2 MORE")
    checks.true(more is not None and more["baseline"] == 314 and same_color(more["color"], MUTED), "four warnings: a muted line counts the two without a card")
    check_cards(sim.layout("five.json"), rows, "five warnings")
    asked = sim.layout("confirm.json")
    check_cards(asked, rows, "the question")
    question = asked.find("START ANYWAY?")
    checks.true(question is not None and question["baseline"] == 112 and same_color(question["color"], MUTED), "the question takes the label's place")
    check_pill(asked, "START", PRIMARY, ON_PRIMARY, "the question")
    cancel = asked.find("CANCEL")
    checks.true(cancel is not None and cancel["clickable"] and cancel["y1"] >= 404 and cancel["y2"] - cancel["y1"] + 1 >= 56, "the question: CANCEL is a text button under the pill")
    checks.color(cancel and cancel["color"], INK, "the question: CANCEL is ink")
    checks.color(cancel and cancel.get("fill"), SURFACE_0, "the question: CANCEL has no fill")
    budget(sim, "asked.redraw", "Brew to the question (START)")
    budget(sim, "cancel.redraw", "the question to Brew (CANCEL)")
    budget(sim, "start.redraw", "the question to Shot (START)")
    sim.save("four.bmp", f"{SHOTS}/warnings-more.png")
    sim.save("confirm.bmp", f"{SHOTS}/warnings-confirm.png")


def warnings_answered_elsewhere():
    # The web UI shows the same question. Either answer given there ends it here.
    sim = seeded("warnings-elsewhere", warnFlush=2)
    drive(
        sim,
        "wait 3500; mode brew; wait 2500; tap 240 366; wait 1300; expect screen warnings; expect text START ANYWAY?;"
        "redraw skip.redraw; layout asked.json; wait 1500; expect screen brew; expect active 0; redraw cancelled.redraw;"
        "tap 240 366; wait 1300; expect screen warnings; expect text START ANYWAY?; redraw skip.redraw; layout again.json;"
        "wait 1500; expect screen shot; expect active 1; redraw started.redraw; quit",
        [
            ("asked.json", lambda: socket_send(sim, {"tp": "req:brew:confirm:cancel"})),
            ("again.json", lambda: socket_send(sim, {"tp": "req:process:activate", "ignoreWarnings": True})),
        ],
    )
    budget(sim, "cancelled.redraw", "the question to Brew, cancelled in the web UI")
    budget(sim, "started.redraw", "the question to Shot, started in the web UI")


# ---- Light ---------------------------------------------------------------------------------------------------


def light():
    # Light is a setting. The QR card stays white with black modules.
    sim = Sim("menu-light")
    drive(
        sim,
        "wait 3500; theme 1; wait 700; tap 240 362; wait 1300; expect screen menu; shot menu.bmp; layout menu.json;"
        "tap 240 34; wait 1300; expect screen warnings; shot warnings.bmp; layout warnings.json;"
        "tap 240 372; wait 1500; expect screen menu; tap 113 199; wait 1500; expect screen info; shot info.bmp; layout info.json;"
        # A theme change rebuilds every screen: the code has to be drawn again.
        "theme 0; wait 700; expect screen info; shot rebuilt.bmp; layout rebuilt.json; quit",
    )
    check_menu(sim.layout("menu.json"), MODES, "BREW", "Light", ink="#111111", on_ink="#ffffff", muted="#555555", card="#f4f4f4", disc="#ffffff")
    info = sim.layout("info.json")
    checks.color(info.objects[0].get("fill"), "#e9e9e9", "Light: the face is surface-0")
    card = at(info, (166, 142, 313, 289))
    checks.color(card and card.get("fill"), QR_GROUND, "Light: the QR card is white in every theme")
    rebuilt = sim.layout("rebuilt.json")
    checks.color(rebuilt.objects[0].get("fill"), SURFACE_0, "back to Display black: the face is surface-0 again")
    saved = [sim.save("info.bmp", f"{SHOTS}/info-light.png"), sim.save("rebuilt.bmp", str(sim.dir / "rebuilt.png"))]
    found = decode(saved) or {}
    checks.equal(found.get(str(saved[0])), "http://192.168.1.123/", "Light: the code reads back from the capture")
    checks.equal(found.get(str(saved[1])), "http://192.168.1.123/", "after a theme change the rebuilt code reads back")
    sim.save("menu.bmp", f"{SHOTS}/menu-light.png")
    sim.save("warnings.bmp", f"{SHOTS}/warnings-light.png")


for group in (
    menu_from_standby,
    menu_from_brew,
    menu_grinder,
    menu_forced,
    menu_disconnected,
    information,
    warnings_from_brew,
    warnings_from_standby,
    warnings_confirm,
    warnings_answered_elsewhere,
    light,
):
    case(group)

print("largest frame of each change, percent of the panel:")
for what, peak in peaks:
    print(f"  {peak:5.1f}  {what}")
checks.finish()
