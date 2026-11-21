# BetterMate v2 — implementation contract

Branch `ui/v2`, started 2026-11-11 from the checkpoint `4714a53d`. This file is the thin plan every agent working on
v2 reads first. It names the goal, the fixed constraints, who owns which files and how to verify. The design itself is
in `design/` (see `design/reference/SOURCE.md`); read the design, do not paraphrase it here.

## Goal

Rebuild both faces of BetterMate on the v2 design system, efficiently: less flash, less RAM, less CPU per frame, and
motion the panel can actually show. Anything the v2 design does not need is deleted, not kept beside it.

- **Display** (`src/display/ui/bettermate/`): hand-written LVGL 8.4, standalone (no `DefaultUI`, no EEZ), one LVGL
  screen, a shared tick ring, frame-counted motion (`design/reference/motion.md`), no opacity/transform layers.
- **Web** (`web/`): Preact + Tailwind utilities for layout + the `bm-*` recipes of
  `design/reference/components/bundle.css`. No daisyUI, no shadows, gradients or blur.

## Fixed constraints

- Never touch `lib/NanoPbComm/`, the proto, the `controller` env or `lib/GaggiMateController`.
- No change to the REST/WebSocket contract (`docs/websocket-api.yaml`), storage keys, routes, mDNS/MQTT/HomeKit names.
- Published as `main` at `github.com/531dev/bettermate`. Push only when asked, never to `upstream`.
- `design/` is an unchanged copy of the design system. Do not edit it; generators read it.
- Machine behaviour stays exactly as it is: every control the stock UI offers stays reachable (`../stock-screens.md`).
- Voice and content rules of `design/reference/README.md` apply to every string a person reads.

## Ownership (do not edit files outside your lane; report needed changes instead)

| Lane | Owns |
| --- | --- |
| Display core | `src/display/ui/**`, `src/display/lv_conf.h`, `sim/**`, `scripts/design/gen_display_assets.py`, `scripts/verify_display*.py`, `platformio.ini` |
| Web foundation | `scripts/design/gen_web_assets.py`, `web/src/design/**`, `web/src/components/**`, `web/src/index.jsx`, `web/src/style.css`, `web/src/utils/themeManager.js`, `web/public/**`, `web/index.html`, `web/package.json` |
| Web pages | one agent per directory under `web/src/pages/` as assigned in its brief |
| Web charts | `web/src/utils/chartTheme.js`, chart components named in the brief |

## Web contract

- Tokens: `web/src/design/tokens.css`, generated from `design/tokens.json`. Variable names are the token names
  (`--surface-1`, `--ink-muted`, `--space-5`, `--radius-xl`, `--control-md`, `--duration-fast`, `--ease-out`, ...).
  Themes are `light` and `dark` on `<html data-theme>`; System follows the OS.
- Recipes: `web/src/design/bm.css` carries the product classes of `bundle.css` unchanged (`bm-tile`, `bm-cell`,
  `bm-btn`, `bm-cta`, `bm-chip`, `bm-segbar`, `bm-dots`, `bm-seg`, `bm-modebar`, `bm-stepper`, `bm-list`/`bm-item`,
  `bm-field`/`bm-input`/`bm-switch`/`bm-setting`, `bm-nav`, `bm-stages`, `bm-dial`, `bm-stat`, text helpers).
  Pages use these classes (or the Preact wrappers in `web/src/components/`) for everything that has a recipe, and
  Tailwind utilities only for layout (flex, grid, gap, padding, width).
- Icons: one stroke set from `design/icons.json` through `components/Icon.jsx`. No other icon source.
- Selection is `ink`/`on-ink`. `primary` is the one action per view. `heat` is temperature only. Warnings are
  `warning` Chips.
- Motion: only the durations and curves of `design/reference/motion.md` (Web section); numbers snap; charts
  `animation: false`; honour `prefers-reduced-motion`.

## Display contract

Written by the display-core lane in `docs/v2/DISPLAY.md` once the core exists.

## Verify

```shell
# web (from web/), never two builds into the same outDir
npm run lint:check
npx vite build --outDir <your scratch dir>
# display (from the repo root); one PlatformIO build at a time per build dir
pio run -e display-sim
pio run -e display
pio test -e native
```

Do not run `scripts/build_webui.sh` or `pio` from a web lane, and do not run `npm` builds into `web/dist` from a
display lane: both rewrite files the other lane's build embeds.
