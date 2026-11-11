# Product

<!-- impeccable:product-schema 1 -->

Paths in this file are relative to the `bettermate/` repo root.

## Platform

web

## Users

**Primary: the project's owner**, a home barista running BetterMate on their own Gaggia espresso machine with a GaggiMate kit. That machine is the test bed.

**Eventual: other GaggiMate owners.** They are not served yet, so first-run and installer polish can wait, but no decision should block them later.

**When needs conflict, favour the daily-ritual barista on both surfaces:** pick a profile, pull the shot, done. Profile authoring, shot history, analysis and statistics stay available but out of the way, on the web UI as well as the display.

## Product Purpose

BetterMate is a hard fork of GaggiMate, branched from upstream `v1.9.0`. It keeps the machine logic and replaces the two interfaces: the 480 px round display and the web UI. It exists to make daily use of a GaggiMate machine calmer and easier.

Success means:

- The machine can be read at a glance from arm's length.
- Every core control can be found without hunting.
- Everything stock GaggiMate can do is still reachable.
- Motion feels as smooth on the device as it does in the simulator.

## Positioning

Same machine, easier to use. GaggiMate's machine logic and safety stay as they are, on a stock controller that is never reflashed. Only the display firmware changes.

The difference is in daily use: fewer steps, clearer setup, controls you can find. Workflow changes are in scope. Machine logic and the controller protocol are not. "Fewer steps" is an aim: no measurement against stock exists yet.

## Operating Context

BetterMate has two surfaces, and `Platform` above describes only the second. The display is hand-written LVGL firmware, so web guidance does not carry over to it.

- **Round display, at the machine.** Read from arm's length in a kitchen, often with a wet hand. Supported panels are LilyGo T-RGB (the one tested), Waveshare and CO5300 AMOLED. AMOLED needs burn-in protection on Standby.
- **Web UI, on a phone or desktop.** Served by the display's ESP32 over home Wi-Fi from memory-mapped flash, so pages load slowly and everything must work offline. The same app is the Wi-Fi captive portal and first-run setup.
- **Two boards.** The stock controller runs the heater, pump, valves and safety, and talks to the display over BLE or UART.
- **Optional hardware changes what can be shown.** Without a pressure sensor there is no pressure reading. A Bluetooth scale can drop out mid-use, and Grind then falls back to time. A grinder may or may not be present.

## Capabilities and Constraints

**Display screens:** Standby, Brew, Status, Steam, Water, Grind, Menu, Info, Profile.

**Web pages:** machine dashboard with the machine modes in the nav, profiles and profile editor, shot history, shot analyzer, statistics, settings, first-run Wi-Fi setup.

**Fixed constraints:**

- Do not touch `lib/NanoPbComm/`. Changing the proto, the schema or `PROTOCOL_VERSION` makes the stock controller report "Version mismatch" and inhibits machine control.
- Controller updates stay pinned to upstream `v1.9.0`. The controller is not part of the redesign.
- Network identifiers stay GaggiMate's: the mDNS name `gaggimate`, MQTT topics and the HomeKit name. Only the Wi-Fi AP name and the installer name say BetterMate.
- The web UI keeps the existing REST and WebSocket contract and storage keys.
- Every stock behaviour stays reachable. `../stock-screens.md` is the parity inventory.
- Gauges keep fixed scales of 0–160 °C and 0–16 bar, with a target marker on each.
- The device is far slower than the simulator. On 2026-11-07 the LilyGo panel refreshed at about 23.5 Hz and a full-screen frame took 57–83 ms, reaching 105–134 ms during transitions. Judge motion on hardware.
- The web bundle ships inside the firmware's flash, so its weight counts.
- The fork is local only: never push it or create anything on GitHub.
- The license is CC BY-NC-SA 4.0, the same as upstream: non-commercial, share-alike, with GaggiMate credited.

**Undecided:**

- When or whether a public release happens. The browser installer page and CI release workflows are unscheduled, and both need a public repository.
- Standby copy for non-ready states is still awaiting the owner's review (see `../progress.md`).

## Brand Commitments

**Name and marks.** The name is BetterMate. Use the wordmark files in `design/logos/`, never live text. Upstream GaggiMate marks are not used, but credit to GaggiMate stays.

**Direction set by the owner.** The display is minimal and high-end with smooth motion, never busy, while still showing what is needed.

**Display rules**, approved by the owner on 2026-10-20, written into `src/display/ui/bettermate/LuxuryUI.h` and checked by `scripts/verify_display_rules.py`:

1. One large reading and one primary action.
2. Normal states stay hidden; only exceptions appear.
3. Data sits on the rim, as arcs and target notches.
4. Controls that cannot be used fade out.
5. One unit style: large readings carry a small unit label underneath; small text uses `93°`, `9 bar`, `36 g`.

Two later decisions from the owner refine these:

- Pressure stays on the rim except while brewing.
- If stock has a visible button for a core action, such as setting a target or starting, BetterMate keeps one visible. A tap-to-reveal −/+ was tried and read as missing.

**Voice**, carried over from the approved design system and not re-confirmed during init:

- Sentence case wherever a person reads a sentence; uppercase only for short labels and buttons.
- Verbs on buttons, nouns on nav items and tabs, one or two words each.
- No emoji and no exclamation marks.
- Speak to the person as "you", and about the hardware as "the machine", "the boiler", "the scale".
- Shot time as `mm:ss`. A missing value is `—`, never `0` or "N/A".

## Evidence on Hand

- `docs/display/` and `docs/webui/`: screen captures and verification logs.
- `docs/hardware/2026-10-03.md`: the first hardware test, on a GaggiMate Pro Rev 1.0 with stock controller firmware `v1.9.0`.
- `../visual-identity/`: stock UI screenshots and design inspiration.
- `design/`: tokens, fonts, icons and wordmarks. `design/reference/` holds the original design system. The visual direction has since moved on (`docs/display/minimal-luxury/`), so treat the current code as visual truth.
- `../progress.md`: current status and remaining hardware validation.

**Absent, and not to be fabricated:** users beyond the owner, testimonials, benchmarks against stock, press, pricing, a public release, or a tested path back to stock firmware. Do not claim BetterMate is reversible until that path is tested.

## Product Principles

1. **The daily shot comes first.** Walking up to the machine and pulling a shot should take the least thought of anything in the product. Depth waits to be asked for.
2. **Calm, not hidden.** Normal states can stay quiet, but a core control is never something you have to discover.
3. **Simplify without removing.** A change may move a stock behaviour or make it quieter, but it stays reachable.
4. **Change the workflow, not the machine.** Easier use is ours to design. Machine behaviour, safety and the controller protocol are not.
5. **The device is the judge.** Legibility and smoothness count on the real panel at arm's length. A good simulator capture does not settle either.

## Accessibility & Inclusion

Standards from the approved design system:

- Touch targets are at least 56 px on the display and 44 px on the web, for use with wet hands.
- Text holds 4.5:1 contrast on every surface, and marks that carry meaning hold 3:1.
- Status is never shown by colour alone: a word or icon accompanies it.
- The web UI honours `prefers-reduced-motion`.
