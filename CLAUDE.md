# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

BetterMate is a **hard fork of GaggiMate** (upstream `jniebuhr/gaggimate`, forked at `v1.9.0`) that keeps all of its machine logic and replaces the two interfaces: the round 480×480 display (hand-written LVGL) and the web UI the display serves (Preact). Users flash BetterMate onto the display; it pairs with a **stock, unmodified GaggiMate controller on `v1.9.0`**.

This directory is a clone of `git@github.com:531dev/bettermate.git` (remote `origin`, public). Work happens on `main`. Releases are tags `vX.Y.Z` (the first is `v1.0.0`); pushing one runs `build.yml`, which builds the display and publishes a GitHub release. There is no upstream clone here. To compare with stock GaggiMate, add it as a remote that cannot push (`git remote add upstream https://github.com/jniebuhr/gaggimate.git && git remote set-url --push upstream no-push`) and read tag `v1.9.0`, without editing it.

## Where the work stands (2026-11-21)

The v2 redesign is **built, checked in the simulator on both faces, tested on hardware by the user, and released as `v1.0.0`**:

- **Display:** every screen is implemented and passes its simulator checks at 480 and 466 px.
- **Web:** every page is converted to the v2 system and passes `scripts/verify_web_ui.mjs` in Chromium. Not tried in Safari, on a phone, or served from an ESP32.
- **Left:** the decisions the user has not confirmed (`docs/v2/STATUS.md`, sections 2 and 3).
- **Open, not yet decided by the user:** a profile of more than 16 phases on the display's stage row; six Customize options the Dashboard lost; a Wi-Fi scan in Setup (needs a new REST request, so a contract change).

Read `docs/v2/STATUS.md` first for anything beyond this summary, then the doc for the face you will touch:

| Doc | Use it for |
| --- | --- |
| `docs/v2/STATUS.md` | What landed, what is left, every decision taken on the way (section 3), practical notes. Keep it current: a new decision goes into section 3, with its commit. |
| `docs/v2/DISPLAY.md` | How the display UI is built and how to write a screen. Read before touching LVGL. |
| `docs/v2/WEB.md` | The web components, recipes and the rules a page follows. Read before touching `web/`. |
| `docs/webui/README.md` | What each web page shows and which behaviour decisions stand. |
| `docs/v2/PLAN.md` | The original contract (goal, constraints, lane ownership). |
| `sim/README.md`, `sim/SimScript.h` | The simulator and its script verbs. |
| `docs/v2/WEB-LANES.md`, `docs/v2/DS-1116-LANES.md` | Finished work briefs, kept as history. The user's overrides in the second one still hold (below). |

**Stale references.** The v2 docs were written when the work lived on a local branch `ui/v2` inside a `bettermate/` subfolder of a larger workspace. Read `ui/v2` as `main` and `bettermate/` as the repo root. `progress.md`, `stock-screens.md`, `visual-identity/` and the agent worktrees they mention no longer exist. `PRODUCT.md` is right about users, purpose, principles and voice, but its display rules and file names (`LuxuryUI.h`, `verify_display_rules.py`) describe the design before v2; the README has the current five rules. `CONTRIBUTING.md`, `web/README.md` and `scripts/README.md` are upstream's and partly wrong for this fork.

## Fork constraints (decided, do not relitigate)

- **Do not touch `lib/NanoPbComm/`.** The display checks the controller with a strict `!=` on `gm_proto::PROTOCOL_VERSION` (5, in `lib/NanoPbComm/src/Protocol.h`). If you change the proto, the schema, or that constant, the stock controller is reported as mismatched and machine control is inhibited. Neither UI depends on this lib.
- **The controller stays on stock `v1.9.0`.** `CONTROLLER_REQUIRED_VERSION` in `src/display/core/constants.h` is the one place the firmware says so (the controller's OTA pin is built from it); `web/src/utils/machineState.js` carries the same constant for the web's words. The `controller` env and `lib/GaggiMateController` are not part of this fork's work. Upstream `v1.10.0` speaks a newer link protocol and is not supported.
- **No change to the REST/WebSocket contract** (`docs/websocket-api.yaml`), storage keys, routes, or the mDNS/MQTT/HomeKit names (`gaggimate`). Integrations must see the same machine. Internal `PluginManager` events may change.
- **Machine behaviour stays as it is**, and everything the stock UI could do stays reachable.
- The display UI is standalone hand-written LVGL 8.4 in `src/display/ui/bettermate/`. The stock UI, EEZ Studio's project and the `BETTERMATE_UI` flag were deleted with the v2 core (`57e26339`). Everything before v2 is at commit `4714a53d`, which is in `main`'s history.

## Design system

The design is **BetterMate v2**, the claude.ai artifact `UnsxdMryJW25NAwXn12bSb`. An unchanged copy is in `design/` (`tokens.json`, fonts, logos, `icons.json`, and `reference/` with the written sections and component previews; `reference/SOURCE.md` maps it to the artifact and says which section to read before which kind of change). Implement from the local copy and **never edit it by hand**: re-import it, then run the generators. The earlier design system (`NAmDJMSSupMJrSdiDDBS2H`) is superseded.

Where the user decided against the design, the decision wins: Standby has no WAKE pill (a tap anywhere wakes); the Menu's exception glyph stays at 6 o'clock; on the web every mode, Steam included, locks while a process runs; core controls such as target −/+ and START stay visible. `docs/v2/STATUS.md` section 3 lists the rest.

## Commands

Run from the repo root. PlatformIO, Node (`.nvmrc` says 22; 25 also builds), and for the simulator `brew install sdl2`.

```shell
# Fresh clone, in this order: the simulator build fails without the packed web bundle
# ("Explicit dependency src/display/webassets/web_ui.bin not found"), which is git-ignored.
scripts/build_webui.sh                     # npm ci + vite build + gzip + pack into src/display/webassets/
pio run -e display-sim                     # build the desktop simulator

# Firmware
pio run -e display                         # display firmware (LilyGo T-RGB); embeds a stub web UI if build_webui.sh has not run
pio run -e display -t upload -t monitor    # flash + serial console
pio run -e display-frame-stats -t upload -t monitor   # same, logging render time and redrawn share once a second
pio run -e controller                      # controller firmware (not modified in this fork)

# Simulator: the real display firmware, a mocked controller, an SDL window
pio run -e display-sim -t run              # web UI at http://localhost:8080/; keys 1/2 = brew/steam buttons
SDL_VIDEODRIVER=dummy ./.pio/build/display-sim/program --script "wait 3500; mode brew; wait 3000; expect screen brew; shot brew.bmp; quit"
# Its state persists in ./sim_data of the directory it starts in: run it from a scratch directory.
# Docker holds port 8080 on this Mac: set SIM_HTTP_PORT (the simulator and web/vite.config.js both read it).
# Close a running simulator before rebuilding display-sim.

# Web dev (inside web/). Vite proxies /api and /ws to the simulator
npm run dev                                # http://localhost:5173/
npm run lint:check                         # eslint; 0 errors, 6 known hook warnings in Statistics
npm run format                             # prettier
npx vite build --outDir <scratch dir>      # a trial build that leaves web/dist alone

# Unit tests: native Unity suites under test/, no hardware
pio test -e native                         # all suites (57 pass, 7 skipped)
pio test -e native -f test_button_handler  # one suite

# Design assets (only after design/ changes; the output is committed)
scripts/design/gen_display_assets.py       # tokens, fonts, icons for LVGL; needs fonttools, brotli, Pillow, rsvg-convert, Node
scripts/design/gen_web_assets.py           # tokens.css, icon paths, fonts and marks for the web

# Formatting and static analysis (as CI runs them)
scripts/format.sh                          # clang-format (not installed on this Mac); skips src/display/ui and drivers
pio check -e display --fail-on-defect=medium -f "-<*>" -f "+<src/display/>" -f "-<src/display/ui>"
```

### Checks

```shell
# Display: Python scripts on scripts/display_sim.py; each case runs the simulator headless in its own scratch directory.
python3 scripts/verify_display_core.py                     # one of core, shot, modes, menu, profiles
for check in scripts/verify_display_*.py; do python3 "$check" || break; done   # all five, about 25 minutes
SIM_PANEL_SIZE=466 python3 scripts/verify_display_core.py  # the same check on the AMOLED boards' panel size
# SIM_PORT_BASE=<port> lets several run at once. UPDATE_SHOTS=1 retakes the captures under docs/display/v2/.

# Web: needs a disposable simulator on the seeded state, with Vite in front of it (or the embedded bundle).
mkdir -p <scratch>/sim_data && cp -R scripts/fixtures/web-seed/. <scratch>/sim_data/
(cd <scratch> && SIM_HTTP_PORT=8190 SDL_VIDEODRIVER=dummy <repo>/.pio/build/display-sim/program) &
(cd web && SIM_HTTP_PORT=8190 npx vite --port 5199 --strictPort) &
node scripts/verify_web_ui.mjs http://127.0.0.1:5199/ --playwright-module <path to playwright/index.mjs>
# --only shell,pages,flows,states narrows it. Playwright is not a dependency of the repo; PLAYWRIGHT_MODULE works too.
```

A display change is verified by the check for its screens at 480 px, and at 466 px when it moves or sizes anything. A web change is verified by `verify_web_ui.mjs`. Say which checks ran and which did not.

CI on GitHub runs `pio check` for both firmwares (`check.yml`) and the OTA test bench on every push. A pushed `v*` tag runs `build.yml`: the web UI, `display` and `display-headless` firmware, the filesystem image and a merged `display-full.bin` for a first USB install, attached to a GitHub release. No controller build and no update-server upload: the controller stays on GaggiMate `v1.9.0`. `build-nightly.yml` is still upstream's and triggers on `master`, so it never runs.

## Architecture

There are two ESP32s. The **controller** drives the heater, pump and valves and handles safety. The **display** handles the UI, Wi-Fi, profiles, the web server and plugins. They talk over BLE or UART using a framed nanopb protocol (`lib/NanoPbComm`, generated from `proto/gaggimate.proto` at build time).

On the display (`src/display/`):

- `core/Controller.*` is the hub. It owns `Settings`, `ProfileManager`, the active `process/` (Brew, Steam, Pump, Grind) and the link to the controller. It constructs the UI (`DisplayUI`, which `ui/UI.h` aliases to `BetterMateUI`) and registers every plugin.
- `core/PluginManager` is an event bus. Components emit string-named events (`boiler:currentTemperature:change`, `controller:process:end`, `ota:update:status`) and subscribe with `pluginManager->on(name, cb)`.
- **The UI is one more subscriber** (`ui/bettermate/BetterMateUI.cpp`). Events mark it dirty; on its own task it snapshots the machine into `UiState` (every sixth frame, or at once when dirty), and the active screen brings itself in line with that snapshot. A screen never reads the controller: it reads `UiState` and states an `Intent`, which the host carries out with Controller methods. The host also routes: it puts up Updating, Fault and Wi-Fi setup itself while their state lasts.
- `ui/bettermate/` draws on **one LVGL screen**. A screen is a set of ranked parts on a shared root, positioned in the design's 480 px box by absolute coordinates; the tick ring on the rim belongs to the host and survives screen changes; time is counted in 42.5 ms panel frames; every change repaints its exact box through the `ui::` setters. No `lv_scr_load`, `lv_anim`, style opacity, transforms or flex. The reason is the motion budget: at most 25% of the panel repainted in one step of a transition and 8% in continuous motion, because the real panel is far slower than the simulator.
- `plugins/` add features: `WebUIPlugin` (HTTP, WebSocket, OTA), `BLEScalePlugin`, MQTT, HomeKit, `ShotHistoryPlugin`, `SmartGrindPlugin`, and others. `WebSocketHandler` with `docs/websocket-api.yaml` is the contract the web UI uses.
- `drivers/` holds the panel drivers (LilyGo T-RGB, Waveshare, CO5300 AMOLED). The `display-headless` env builds without `drivers/` and `ui/`.

The simulator (`sim/`) compiles the same `src/display/` tree natively: host shims for Arduino, FreeRTOS, the filesystem and Wi-Fi in `sim/platform`, a fake controller with a thermal model in `sim/comms`, SDL in `sim/driver`, a small HTTP and WebSocket server in `sim/web`. It runs everything as one cooperative loop, and leaves out MQTT, HomeKit, mDNS, the watchdogs, BLE scales and real OTA. Its scripted mode (`--script`) drives input, injects machine states, asserts what is on the glass (`expect`), and records captures (`shot`), object dumps (`layout`) and the pixels each frame repainted (`redraw`); the display checks are built on it.

On the web (`web/`): Preact 10, `@preact/signals`, `preact-iso` routing with every page lazy-loaded (the ESP32 serves it over slow Wi-Fi), Chart.js. Styling is the design's `bm-*` recipes (`src/design/bm.css`, tokens in the generated `tokens.css`) wrapped by the components in `src/components/`; Tailwind 4 lays pages out and nothing else (its colour, shadow and blur scales are cleared), and daisyUI is gone. `services/ApiService.js` talks to the device over REST (`/api`) and one WebSocket (`/ws`). `utils/machineState.js` derives the machine-wide product states (connecting, offline, fault, updating) from what the socket already reports, `utils/commands.js` holds a start or stop until a status frame confirms it, and the shell in `index.jsx` renders the navigation, the one floating mode bar, the one Toast and the live regions around the pages.

`scripts/build_webui.sh` gzips the build and packs it into `src/display/webassets/web_ui.bin`, which the firmware serves from memory-mapped flash, so the bundle's weight counts against the firmware. LittleFS holds only profiles (`/p`) and shot history (`/h`), so an OTA never touches user data. The same SPA is the Wi-Fi captive portal and first-run setup.

## Known gaps

- The display's update check reads `RELEASE_URL` (`src/display/plugins/WebUIPlugin.h`), `github.com/531dev/bettermate/releases/latest`, and compares its tag with `BUILD_GIT_VERSION` (`git describe`) as semver. A local build without the tags fetched reports `""`.
- The nightly OTA channel reads `releases/tag/nightly`, which does not exist.
- No browser installer exists yet.

## Working preferences

- Build in small phases and show results early (a simulator capture, a running page). Avoid long up-front planning runs.
- Use the simulator's scripted mode to verify display changes without hardware, and treat its `redraw` share as the measure of motion. The device is the judge of smoothness and legibility: a good capture does not settle either.
- At most two or three agents in parallel, each briefed from files in the repo.
- Commit to local git as work lands. Push only when asked, with `git push origin main` (never force, never to `upstream`). A change the user expects to see on GitHub is not there until it is pushed: say so and offer the push.
