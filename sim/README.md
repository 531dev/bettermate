# Desktop simulator (`display-sim`)

Runs the **real** GaggiMate display firmware (`src/display/`) natively on your
computer, with the BLE link to the controller ESP32 (`lib/NanoPbComm`) **mocked**.
The LVGL UI renders in an SDL window, a fake controller simulates a full brew, and
the embedded WebUI is served on `localhost`. Use it for fast UI iteration,
screenshots, and validation without any hardware. (Linear: GM-107.)

## 1. Prepare your computer

macOS:

```shell
xcode-select --install     # C/C++ toolchain (clang + assembler); skip if already installed
brew install sdl2          # the windowing/graphics backend
# PlatformIO is already what you build the firmware with; the native platform
# auto-installs on the first `pio run -e display-sim`.
```

Linux (Debian/Ubuntu): `sudo apt install build-essential libsdl2-dev`.

If you want the **WebUI**, build its embedded bundle once (needs Node 22 — `nvm use`):

```shell
scripts/build_webui.sh     # generates src/display/webassets/web_ui.bin (git-ignored)
```

The sim `.incbin`s that `web_ui.bin`, so it must exist before building with WebUI.
(`build_webui.sh` is also what the device build uses.)

## 2. Build & run

```shell
pio run -e display-sim                 # build
pio run -e display-sim -t run          # build + launch (also: ./.pio/build/display-sim/program)
```

`-t run` is a custom PlatformIO target (see `scripts/sim_run.py`). In a PlatformIO
IDE (CLion/VSCode) it shows up under the `display-sim` environment as the
**Run Simulator** task, so you can build and launch the sim with one click.

- **Interact** with the mouse (it acts as the touchscreen). Keys `1` and `2` press
  and release the brew and steam inputs of the controller board (hold both for
  the combined third button, hold one for a long press).
  Hold the left mouse button and drag to swipe. After rebuilding, close and relaunch
  the simulator: an already running window continues using the previous build.
- **WebUI**: open <http://localhost:8080/> while it runs (port 80 is remapped to
  8080 so it needs no root). Live status streams over the WebSocket just like on
  the device. If 8080 is taken, set `SIM_HTTP_PORT=8090` for both the simulator
  and `npm run dev`.
- **Screenshot mode** (renders briefly, writes a BMP, exits — handy for
  validation/CI):

  ```shell
  ./.pio/build/display-sim/program --screenshot shot.bmp 4000   # 4000 = delay ms
  # convert to PNG on macOS: sips -s format png shot.bmp --out shot.png
  ```

- **State** (settings, profiles, shot history) persists under `sim_data/`
  (git-ignored). Delete it to start fresh.

### Scripted runs and checks

`--script "<verbs>"` drives the simulator without a person at the mouse; the verbs are listed in `sim/SimScript.h`.
Besides input (`tap`, `press`/`release`, `hold`, `swipe`, `key`) they change the machine (`mode`, `scale`, `weight`,
`pressure-sensor`, `controller`, `error`, `protocol`, `autotune`, `update`, `wifi`, `panel`, `theme`), check it
(`expect screen|mode|active|text|hidden|...`, which exit with status 3 when they fail) and record what is on the
glass:

- `shot <path>` writes a BMP of the frame;
- `layout <path>` writes the screen, the ring (layout, lit ticks, notch, tone) and every visible object with its
  text and colors, as JSON lines;
- `redraw <path>` writes every repaint since the last `redraw` step with the pixels it redrew. The simulator renders
  a frame in a millisecond or two, so time proves nothing here, but the redrawn share is exactly what the panel pays
  for: `design/reference/motion.md` allows 25% of the panel in one step of a transition and 8% in continuous motion.

Two environment variables help: `SIM_TRACE_FLUSH=1` prints every repainted rectangle, and `SIM_PANEL_SIZE=466` runs
the 480 px design on a panel the size of the AMOLED boards. Points in a script and boxes in a `layout` dump are in
the design's 480 px box on either panel (at 466 the simulator moves them by the 7 px the design overhangs the
glass), so one script serves both; a `shot` is in panel pixels. The checks run at 466 the same way:
`SIM_PANEL_SIZE=466 python3 scripts/verify_display_core.py` (captures then go to `docs/display/v2/466/`).

The display checks are Python scripts on `scripts/display_sim.py`, which runs each case headless in its own scratch
directory:

```shell
pio run -e display-sim
for check in scripts/verify_display_*.py; do python3 "$check" || break; done
```

Fault injection affects the simulated controller only; its protocol version is 3, independent of the real
controller protocol.

## 3. How it works

Everything simulator-only lives here in `sim/`; the firmware in `src/` is built
unchanged except for a few small `#ifndef GAGGIMATE_SIM` guards.

| Folder | Role |
|---|---|
| `sim/platform/` | Host shims for the Arduino/ESP32 APIs the firmware uses — Arduino core (vendored `String`/`Print`/`Stream`), FreeRTOS, `FS`/`LittleFS`/`SPIFFS`/`SD_MMC`, `Preferences` (NVS), `WiFi`, and the `esp_*` headers. `xTaskCreate*` is a no-op so the sim drives the firmware's loop methods cooperatively on the main thread. |
| `sim/comms/` | Mock of the `GaggiMateClient` BLE facade + a `MockController` thermal/hydraulic model that reacts to the boiler/pump/relay commands the display sends and emits sensor telemetry (temperature, pressure, flow, scale weight). |
| `sim/driver/` | `SdlDriver` — an SDL2 window wired into LVGL as the display + mouse-as-touch input, plus a screenshot helper. |
| `sim/web/` | Host shim of `ESPAsyncWebServer`/`AsyncWebSocket`/`DNSServer` over a tiny non-blocking HTTP/1.1 + WebSocket server (pumped from the main loop, so handlers never race the firmware). OTA / BLE-scale endpoints are stubbed. |
| `sim/main.cpp` | Entry point: builds the `Controller`, then runs one cooperative loop (controller + UI + web server + SDL) on the main thread. |

The PlatformIO env is `[env:display-sim]` (`platform = native`) in `platformio.ini`.

## Caveats

- **Compiled out** for the desktop: MQTT/HomeAssistant, HomeKit, mDNS, the WiFi
  watchdogs, BLE scales, and firmware OTA. The core machine + brew/steam/grind +
  profiles + settings + WebUI all run.
- The mock controller is a plausible model, not a physical one — temperatures and
  pressures are illustrative, not calibrated.
- macOS only needs the main thread for SDL, which is why the whole sim is a single
  cooperative loop.
