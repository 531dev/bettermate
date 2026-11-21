# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

BetterMate is a **hard fork of GaggiMate** (upstream `jniebuhr/gaggimate`) that keeps all of its machine logic and replaces the UI: the round 480×480 display (LVGL) and the web UI (Preact). Users flash BetterMate onto the display over USB from a browser installer. The display pairs with a **stock, unmodified GaggiMate controller**.

This directory is the fork itself, a clone of `git@github.com:531dev/bettermate.git` (remote `origin`, public), branched from upstream tag `v1.9.0`. Work happens on `main`. Module paths target `github.com/mohamadSherif/bettermate`. The **v2 redesign is in progress**: read `docs/v2/STATUS.md` first (what has landed, what is left, how to restart each workstream). STATUS.md and the other v2 docs were written when the work lived on a local branch `ui/v2` inside a `bettermate/` subfolder; read those as `main` and the repo root.

There is no upstream clone here. To compare with stock GaggiMate, add it as a remote that cannot push (`git remote add upstream https://github.com/jniebuhr/gaggimate.git && git remote set-url --push upstream no-push`) and read tag `v1.9.0`, without editing it.

The design system is **BetterMate v2**, the claude.ai artifact `UnsxdMryJW25NAwXn12bSb`. An unchanged local copy is in `design/` (`tokens.json`, fonts, logos, `icons.json`, and `reference/` with the written sections and component previews; `reference/SOURCE.md` maps it to the artifact). Use the local copy for implementation and never edit it by hand. The earlier design system (`NAmDJMSSupMJrSdiDDBS2H`) is superseded.

## Fork constraints (decided, do not relitigate)

- **Do not touch `lib/NanoPbComm/`.** The display checks the controller with a strict `!=` on `gm_proto::PROTOCOL_VERSION` (`lib/NanoPbComm/src/Protocol.h`). If you change the proto, the schema, or that constant, the stock controller shows "Version mismatch" and machine control is inhibited. Neither UI surface depends on this lib, so a UI-only fork never needs to change it.
- Controller OTA stays pinned to the upstream `v1.9.0` release. The `controller` env and `lib/GaggiMateController` are not part of the redesign.
- The display UI is **hand-written LVGL 8.4**, standalone, in `src/display/ui/bettermate/`. The stock UI (`src/display/ui/default/`, EEZ Studio's `eez-ui/`, `icons/`) and the `BETTERMATE_UI` flag were removed on 2026-11-11 with the v2 core (commit `57e26339`). Everything before v2 is preserved at commit `4714a53d`, which is in `main`'s history (`git switch -c ui/minimal-luxury 4714a53d` to restore it as a branch).
- No change to the REST/WebSocket contract (`docs/websocket-api.yaml`), storage keys, routes, or the mDNS/MQTT/HomeKit names.

## Commands

Run these from the repo root. PlatformIO and Node 22 are required (`.nvmrc` = `lts/jod`).

```shell
# Firmware
pio run -e display                         # build display firmware (LilyGo T-RGB)
pio run -e display -t upload -t monitor    # flash + serial console
pio run -e display-frame-stats -t upload -t monitor   # same, logging render time and redrawn share once a second
pio run -e controller                      # controller firmware (not modified in this fork)

# Web UI → embedded into display firmware
scripts/build_webui.sh                     # npm ci + vite build + gzip + pack into src/display/webassets/web_ui.bin
                                           # must run before a display build if you want the real web UI (otherwise a stub is embedded)

# Desktop simulator (real display firmware, mocked controller, SDL window). Needs `brew install sdl2`
pio run -e display-sim -t run              # web UI at http://localhost:8080/; keys 1/2 = brew/steam buttons
./.pio/build/display-sim/program --script "wait 3500; mode brew; wait 3000; shot brew.bmp; quit"   # scripted, see sim/SimScript.h
# sim state persists in ./sim_data of the directory it starts in; run it from a scratch directory.
# Docker holds port 8080 on this Mac: set SIM_HTTP_PORT (the sim and web/vite.config.js both read it).

# Display checks: each runs the simulator headless per case (scripts/display_sim.py)
for check in scripts/verify_display_*.py; do python3 "$check" || break; done

# Web dev (inside web/). Vite proxies /api and /ws to the simulator
npm run dev                                # http://localhost:5173/
npm run lint:check                         # eslint (preact config)
npm run format                             # prettier

# Tests: native Unity suites under test/, no hardware needed
pio test -e native                         # all suites
pio test -e native -f test_button_handler  # one suite

# Design assets (only after design/ changes; output is committed)
scripts/design/gen_display_assets.py       # tokens, fonts, icons for LVGL; needs fonttools, brotli, Pillow, rsvg-convert, Node
scripts/design/gen_web_assets.py           # tokens.css, icon paths, fonts and marks for the web

# Formatting / static analysis (same as CI)
scripts/format.sh                          # clang-format; skips src/display/ui and drivers
pio check -e display --fail-on-defect=medium -f "-<*>" -f "+<src/display/>" -f "-<src/display/ui>"
```

## Architecture

There are two ESP32s. The **controller** drives the heater, pump, and valves, and handles safety. The **display** handles UI, Wi-Fi, profiles, the web server, and plugins. They talk over BLE or UART using a framed nanopb protocol (`lib/NanoPbComm`, schema in `lib/NanoPbComm/proto/gaggimate.proto`, generated at build time).

On the display (`src/display/`):

- `core/Controller.*` is the hub. It owns `Settings`, `ProfileManager`, the active `process/` (Brew, Steam, Pump, Grind), and the link to the controller. It also constructs the UI (`DisplayUI`, which `ui/UI.h` aliases to `BetterMateUI`) and registers every plugin.
- `core/PluginManager` is an event bus. Components emit string-named events such as `boiler:currentTemperature:change`, `controller:process:end`, and `controller:targetVolume:change`, and subscribe with `pluginManager->on(name, cb)`. **The UI is just another subscriber**: `ui/bettermate/BetterMateUI.cpp` listens to these events, snapshots the machine into `UiState` on its own task and calls Controller methods for a screen's `Intent`. Screens never read the controller.
- `ui/bettermate/` is the display UI: one LVGL screen, a shared tick ring, screens as sets of ranked parts, motion counted in panel frames, exact repaints. `docs/v2/DISPLAY.md` explains it and how to write a screen; read it before touching LVGL.
- `plugins/` add features such as WebUIPlugin (HTTP and WebSocket server), BLEScalePlugin, MQTT, HomeKit, ShotHistory, and SmartGrind. `WebSocketHandler` plus `docs/websocket-api.yaml` define the contract the web UI uses.
- `drivers/` holds the panel drivers (LilyGo T-RGB, Waveshare, AMOLED). The `display-headless` env builds without `drivers/` and `ui/`.
- The simulator (`sim/`) compiles this same tree natively, with shims in `sim/platform`, a fake controller in `sim/comms`, and SDL in `sim/driver`. Some network plugins are excluded in `platformio.ini`.

On the web side (`web/`): Preact 10, `@preact/signals`, `preact-iso` routing with lazy-loaded pages (the ESP32 serves it over slow Wi-Fi), Chart.js, and the v2 `bm-*` recipes (`web/src/design/bm.css`, tokens in `tokens.css`) with Tailwind 4 for layout only; daisyUI is gone. `docs/v2/WEB.md` lists the components and the rules a page follows. `services/ApiService.js` talks to the device over REST (`/api`) and WebSocket (`/ws`). The build is gzipped and packed into `src/display/webassets/web_ui.bin`, then served from memory-mapped flash. LittleFS holds only profiles (`/p`) and shot history (`/h`), so OTA never touches user data. The same SPA also serves as the Wi-Fi captive portal.

## Working preferences

- Build in small phases and show results early (sim screenshots, a running page). Avoid long up-front planning runs.
- Use the simulator's scripted mode to verify display UI changes without hardware; it also measures how much of the panel each frame repaints (`redraw`), which is what the motion budget is about.
- Commit to local git as work lands. Push only when asked, with `git push origin main` (never force, never to `upstream`, never a `v2` branch). A change the user expects to see on GitHub is not there until it is pushed: say so and offer the push.
