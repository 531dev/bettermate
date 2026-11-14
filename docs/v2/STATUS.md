# BetterMate v2 — status and handoff

Written 2026-11-14 at the end of the session that started the redesign, so that new sessions can pick it up with a
clean context. Branch `ui/v2`, local only (never push). Everything described here is committed; the tree is clean.

**The task** (the user, 2026-11-11): implement the BetterMate v2 design system "in a way that's efficient and takes
up less resources while allowing for clean animations. Tear down anything that's not needed and rewrite it for this
new design." The design is the claude.ai artifact `UnsxdMryJW25NAwXn12bSb`, copied unchanged into `design/`.

Read in this order: this file, then `PLAN.md` (the contract), then `DISPLAY.md` or `WEB.md` + `WEB-LANES.md` for the
face you will work on. `../../../CLAUDE.md` and `../../../progress.md` at the workspace root are up to date.

## 1. What is done

### Display (`src/display/ui/bettermate/`) — complete in the simulator, not flashed

- **Core.** `BetterMateUI` is standalone: it subscribes to the machine's events, snapshots the machine into `UiState`
  four times a second, and counts time in 42.5 ms panel frames. One LVGL screen; a shared `TickRing`; screens are
  sets of ranked parts; no style opacity, transforms, `lv_anim`, flex or default theme; every part repaints its exact
  box. The stock UI (`ui/default/`), EEZ (`eez-ui/`), `icons/` and the `BETTERMATE_UI` flag are deleted.
- **Screens.** All ten classes are implemented from the design's coordinates: Standby, Brew, Shot (running,
  calibrating, complete, flush), Mode (Steam, Water, Grind), Menu, Profiles, Adjust, Sheet, Warnings (and the confirm
  question), Info (QR, About). Captures of every state are in `docs/display/v2/{core,shot,modes,menu,profiles}/`.
- **Checks** (`scripts/verify_display_*.py` on `scripts/display_sim.py`), all passing on this tree:
  core 29, shot 489, modes 520, menu 891, profiles 1401. Native tests: 57 pass, 7 skipped.
- **Motion budget, measured in the simulator** (share of the panel repainted in one frame): a screen change 20 to
  23% in its largest frame (limit 25%; the host delays the incoming rank a frame when a pair of screens would exceed
  22%); the ring walk about 3%; a running shot at most 5.3%; modes running under 5%; the busy comet under 1%.
- **Size.** `pio run -e display`: 3,227,117 bytes of flash (49.2%; was 3,838,157 before v2) and 84,000 bytes of
  static RAM (was 94,312). One draw buffer instead of two frees a further 460 KB of PSRAM at run time. The firmware
  image still embeds the **old** web bundle (see Web below).
- **Panels.** The 480 px design sits on a stage centred on the LVGL screen, so it is centred on the 466 px AMOLED
  boards (`SIM_PANEL_SIZE=466`). In direct mode (AMOLED) the flush now pushes only the rows that changed.

### Web (`web/`) — foundation done, pages part-way

- **Foundation** (`acbdef2e`): `tokens.css` and icon paths generated from `design/`, `bm.css` with the design's
  recipes, the shell (sidebar, top bar, one floating mode bar), shared components (`WEB.md` lists them), Funnel
  Display and Geist Mono, daisyUI removed, Tailwind for layout only. Main CSS went from 29.8 to 15.0 KB gzip.
- **Pages** (`f0ac9dd6`, a work-in-progress checkpoint). State when the agents were stopped:

| Lane (`WEB-LANES.md`) | Converted | Verified | Known |
| --- | --- | --- | --- |
| Dashboard (Home, DashboardSettings, 404) | yes, no old class left | yes, 2026-11-14 (`2014b256`, `abfb0e82`, `ee556143`) | 846 assertions in Chromium against the simulator: every machine state from standby to a finished shot, steam, water and grind, Simple, Advanced and Customize, at 390 and 1440 px, light and dark, plus 20 widths from 320 px; start/stop, mode, targets, favourite pick and flush work. Three or four readings sit in a column beside the banner and Setup. A finished timed grind shows its set time (the firmware reports a wrapped elapsed value; the display may show the same thing). Injected because the simulator cannot do them: live scale weight, the brew confirmation question. Not checked: ml pumped, next wake, hold-to-flush, grind by weight to its end, grinder not set up, version mismatch, drag reorder in settings, Safari (`reading.css` uses a container query). Its decisions are in section 3, item 14. For integration: promote `Home/reading.css`, `layout.js`, `When`/`PendingRow`, `FlushButton`; shared fixes wanted in `bm-stages__name` (a long phase name is cut with no ellipsis), `Stat` (the target wraps inside itself), `Stepper` (a value such as "136 px" wraps), `bm-seg--block` padding; the "Last minute" chart ticks ignore the 24-hour setting. |
| Profiles and Setup | yes, no old class left | yes, 2026-11-14 (`8c5c42c4`, `9bdf6abd`) | Checked in Chromium against the simulator at 390 and 1440 px, light and dark, plus overflow at 13 widths from 320 px. 154 flow checks pass: select, create, edit and save, duplicate, favourite, reorder by buttons and by drag, export, import (JSON and TCL), delete with confirmation, both editors, the unsaved-edits guard, and every Setup step with the restart request mocked. Fixed on the way: number fields in the editor lost decimals while typing (18.5 became 518); Tab left Setup for the covered mode bar. Not verified: touch drag on a phone, a real restart after Setup. Known: browser back is not guarded for unsaved edits; a Pro profile validates only the phase on the page (as stock). For integration: promote `ProfileEdit/form.jsx` (`FormField`, `Choice`, `useFormValidation`), `ConfirmMenuItem`, `PhaseTabs`, `useUnsavedGuard`, `ProfileForm`; make the shell inert or hidden on `/setup` (Setup holds Tab itself until then); the multi-select outline in `style.css` is square; favourites have no glyph of their own in the icon set. |
| Settings | yes, no old class left | yes, 2026-11-14 (`da54fe15`) | Six tabs checked in Chromium against the simulator at 390 and 1440 px, light and dark, plus overflow at 13 widths from 320 px. Settings round-trip through the page and `GET /api/settings` on General, Machine and Plugins; autotune and the pump flow calibration ran for real; the update channel and the theme survive a reload. Mocked because the simulator cannot do them: Bluetooth scan/connect, OTA, history rebuild progress, restart. For integration: promote the pieces in `fields.jsx`, `SaveBar.jsx` and `PluginCard.jsx`; shared fixes wanted in `bm-seg--block` (three items overflow at 320 px), `PumpFlowCalibration` (its buttons are `primary`, the log does not scroll to its last line, "Was" shows the new values after saving), `TabBar` (`aria-controls` for panels not in the DOM), number-input spin buttons beside the unit, `TileHead` (a wide `end` Chip wraps the title on a phone). |
| Shot history and charts | yes, no old class left | yes, 2026-11-14 (`22533719`, `a9654880`) | 1,574 assertions against the simulator in Chromium: chart configs and pixels in both themes and across a switch, live growth through whole shots, the history flows end to end. A profile curve's `style` now sizes its plot, with the legend Chips above it (the Dashboard's curve tile is about 36 px taller than its skeleton); `ChartComponent` takes an optional `plotStyle`; phase names are left out on plots under 140 px and on phases too narrow for them. Not checked: the autotune chart in Settings, a real scale (the weight line was fed injected readings), a real Visualizer upload. As upstream and left alone: export just after reopening a shot writes `notes: null`, history times ignore the 24-hour setting, a failed upload uses `alert()`. For integration: promote `usePhoneWidth` and the pager from `ShotHistory/index.jsx`; list `ChartComponent`, `ChartLegend` and the `chartTheme.js` builders in `WEB.md`. |
| Shot Analyzer and Statistics | yes, no old class left | yes, 2026-11-14 (`b760f232`, `b5050d6b`, `6a52b9f6`, `83100bb1`, `10d482d8`) | Checked in Chromium against the simulator at 390 and 1440 px, light and dark: a DOM audit (no shadow, blur, gradient, off-token colour or font) in every state visited, the chart configs, and the Analyzer and Statistics flows scripted. Counted at `f0ac9dd6`: Analyzer 14 daisyUI, 86 colour classes, 12 `--color-*`; Statistics 28, 73, 1 and 1 `"Jost"`; now all 0. Fixed on the way: `21.01.1970` in the folded toolbar (device timestamps read as milliseconds), `chart.resize()` on a destroyed chart, a library that could not close. Not run: video export, a real file drop, long-press paint selection, Export all / Delete all, saving a column preset; weight and pumped-water metrics read 0 without a scale. Its behaviour changes are in section 3, item 12. For integration: promote `ShotAnalyzer/ui/{PinIcon,IconButton,Popover,ShotBadge}.jsx`, `ui/chartTokens.js` and the `an-*` type helpers in `ui/tool.css`; `Segmented` has no per-option `title`, `Button` forwards no ref; the chart export popover's Export button is `primary`. |

- `npm run lint:check`: 0 errors (6 known warnings). `vite build` passes again since `b760f232` (the Statistics
  toolbar imported two helpers that `toolbar/helpers.js` no longer exported).
- 2026-11-14, second session: the lanes are being finished three at a time. all five are done and verified
  against Vite and the simulator (not against the embedded bundle). The web integration pass and the display loose
  ends are running.

## 2. What is left, in order

1. **Web pages**: finish and verify the five lanes (`WEB-LANES.md`). The table in section 1 says which are done.
2. **Web integration**, once the lanes are done: promote page-local pieces the lanes built into
   `web/src/components` or `bm.css`; rewrite `scripts/verify_web_ui.mjs` for v2 (its selectors target the old shell)
   and run it against Vite and against the embedded bundle; refresh `docs/webui/` (README and captures);
   `scripts/build_webui.sh`; rebuild `display-sim` and `display` and record the sizes.
3. **Hardware**: flash `display-frame-stats`, read the `FrameStats` lines (pass mark: no line over 42 ms a frame or
   25% redrawn while something animates), check touch targets, the ring, a real shot, steam, the scale, the AMOLED
   flush if such a board is at hand. Back up the flash first, as on 2026-10-03 (`docs/hardware/2026-10-03.md`).
4. **Loose ends on the display**: run every screen at `SIM_PANEL_SIZE=466` (only Standby and Brew were looked at);
   a screen's first build repaints an 11 x 11 px box at the origin (cosmetic, cause not found); profiles with more
   than eight phases show eight stage bars.
5. **Housekeeping**: remove the four merged agent worktrees
   (`git worktree list`; `git worktree unlock` then `git worktree remove --force .claude/worktrees/<name>`, and delete
   their `worktree-agent-*` branches); decide whether `ui/v2` should become `main`.

## 3. Decisions taken on the way — the user has not confirmed these

1. "Tear down anything that's not needed" was read as lifting the earlier "defer the cutover" instruction: the stock
   UI, EEZ and `icons/` are deleted, and so are the old design's captures under `docs/display/` and
   `docs/ui-usability*`. Everything is at `4714a53d` (`ui/minimal-luxury`).
2. The web mode bar keeps today's lock: while a process runs every other mode is disabled. The design's mock draws
   Steam enabled during a shot, but a web mode change stops the running process.
3. Steam's status line reads Heating, Ready to steam, Paused after 10 minutes. The controller starts its steam
   process by itself within 5° of the target and ends it after ten minutes; it does not know whether the valve is open.
4. The flush reminder raises the warning glyph on Brew only; the glyph's ground on the ring is 40 px (it answers on 56).
5. Brew's label reads `COOLING TO 93°` when the boiler is above target (the design names only `HEATING TO`).
6. The fonts carry accented Latin-1 letters beyond the design's glyph table, so typed profile names render.
7. Display theme: the setting's Light is Light; everything else is Display black. The design's Dark is web-only.
8. Minus and plus repeat while held. Water shows pumped millilitres when the controller reports them, and no timer
   (the firmware has none for water). Warnings shows the two most severe and counts the rest. Information has the
   handle as its way back.
9. A screen change between two heavy screens takes four to six frames instead of three, to hold the 25% budget.
10. Driver changes that cannot be tested here: one LVGL draw buffer; changed-row flush on the AMOLED panels.
11. The design-lint hook flags Geist Mono as an overused font; it is the design system's face, so the exception is
    recorded in `.impeccable/config.json`.
12. Analyzer and Statistics (2026-11-14): the analysis table has four scroll buttons instead of six (first, step
    left, step right, last; one 240 px step); the library's source filter is a visible `Segmented` in each section
    instead of a dropdown in the column head; total duration reads `1:38 min` instead of `1 m 38 s`; a trend with one
    bucket shows a sentence instead of a chart; phase bands in the shot chart start on the second phase and sit under
    the grid; the date basis options lost their hover titles (the notice explains them); sentence case throughout
    and `—` for a missing value.
13. Settings (2026-11-14): the "Update available" Chip in the System tile's head is gone (each version cell already
    says so; the Chip wrapped the title on a phone). Tiles go to two columns at 768 px, not at 600 as `WEB.md` says.
14. Dashboard (2026-11-14): a profile with no pressure or flow to draw (a standard profile) gets no curve tile, in
    Advanced and in Customize; on a phone a recent shot shows the time if pulled today and the day otherwise; the
    desktop 5 + 4 + 3 placement starts at 1200 px, not 1024 (the tablet arrangement holds below); in a tile under
    200 px a reading's target sits under the unit instead of inline. **Customize lost six options** in the first
    conversion (`f0ac9dd6`) and they were not restored: control column as a single card, stick first/last panel,
    column spacing, per-panel compact view, metrics columns, last row fill. Their stored keys are untouched.
15. Profiles and Setup (2026-11-14): the drag handle for reordering favourites is inside a row's details; favourite
    state shows only in the row's menu (the icon set has no star).

## 4. Restarting — one prompt per session

Usage credits ran out with nine agents at once. Run one session per item, or two or three in parallel at most; each
prompt stands on its own.

**A web page lane** (one of: Dashboard · Profiles and Setup · Settings · Shot history and charts · Shot Analyzer and
Statistics):

> Finish the **<lane>** lane of the BetterMate v2 web rewrite. Read `bettermate/docs/v2/STATUS.md`, then follow
> `bettermate/docs/v2/WEB-LANES.md` ("For every lane" and the lane's own section) exactly. The lane's work so far is
> committed (`f0ac9dd6`): start by reading what its directories hold, finish what is unfinished, then verify the whole
> lane as the brief says. Commit when it passes, and update the lane's row in `STATUS.md`.

**Web integration** (after the five lanes):

> Do the web integration pass of BetterMate v2 described in `bettermate/docs/v2/STATUS.md`, section 2, item 2:
> promote page-local pieces, rewrite `scripts/verify_web_ui.mjs` for the v2 shell and run it against Vite and the
> embedded bundle, refresh `docs/webui/`, run `scripts/build_webui.sh`, rebuild `display-sim` and `display`, record the
> sizes in `STATUS.md`, and commit.

**Display on hardware** (needs the user at the machine):

> Help me flash and measure BetterMate v2 on the LilyGo T-RGB as `bettermate/docs/v2/STATUS.md`, section 2, item 3
> describes. Back up the flash first. Ask me for the `FrameStats` serial lines before changing anything.

**Display loose ends**:

> Work through the display loose ends in `bettermate/docs/v2/STATUS.md`, section 2, item 4, following
> `bettermate/docs/v2/DISPLAY.md`. Keep all five `scripts/verify_display_*.py` passing and commit.

## 5. Practical notes

- Build and check the display: `pio run -e display-sim`, then
  `for check in scripts/verify_display_*.py; do python3 "$check" || break; done` (about 25 minutes; they run in
  parallel safely with `SIM_PORT_BASE` set apart). Never rebuild `display-sim` while one is running.
- The simulator keeps its state in `./sim_data` of the directory it starts in. `scripts/fixtures/web-seed/` is a
  seeded state (three favourite profiles, two recorded shots) for web work. Port 8080 belongs to Docker on this Mac:
  set `SIM_HTTP_PORT`.
- Playwright for web checks: `/Users/mohamadsherif/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`.
- Regenerating display assets needs `fonttools` and `brotli` in a Python environment, Pillow, `rsvg-convert` and Node.
- The first session's scratch directory may still exist with the lanes' ad-hoc scripts and screenshots:
  `/private/tmp/claude-501/-Users-mohamadsherif-Developer-betterMate/9e29bab1-a935-42cc-a0da-68edb046862e/scratchpad/`
  (`web-home`, `web-profiles`, `web-settings`, `web-history`, `web-analyzer`, `web-a`). Nothing depends on it.

## 6. Commits on `ui/v2`

| Commit | What |
| --- | --- |
| `4714a53d` (`ui/minimal-luxury`) | Checkpoint of everything before v2. |
| `57e26339` | Display core, Standby, Brew; stock UI, EEZ and `icons/` removed; v2 design sources imported. |
| `2f9fe74a` | `scripts/display_sim.py`, `verify_display_core.py`. |
| `dafabf54` | One draw buffer, changed-row AMOLED flush, 466 px panels. |
| `acbdef2e`, `83f5713c` | Web foundation; `WEB.md`. |
| `7f73a4e7` | Simulator README; the old design's evidence removed. |
| `3fa37168` | Steam, Water, Grind. |
| `b3092b9e` | Shot. |
| `ccec1d69` | Menu, Information, Warnings. |
| `36b23a6b` | Profiles, Adjust, Save sheet. |
| `e1e29a01` | Lanes integrated: step budget for screen changes, exception slot, `fit`/`clamp`, Steam's words. |
| `f0ac9dd6` | Web page lanes, work in progress. |
