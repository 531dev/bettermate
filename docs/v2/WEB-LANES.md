# Web v2 — page lanes

Five lanes convert the pages under `web/src/pages/` to the v2 system on top of the foundation (`docs/v2/WEB.md`).
Each lane was started on 2026-11-11, cut off by a usage limit, resumed on 2026-11-14 and stopped again the same day.
Its work so far is committed as a checkpoint (`docs/v2/STATUS.md` says how far each lane got). A lane that resumes
starts by reading what its directories hold now, finishes what is unfinished and verifies all of it, not only the
new part.

## For every lane

- Work in `/Users/mohamadsherif/Developer/betterMate/bettermate` on branch `ui/v2`. When several lanes run at once
  they share this tree: touch only your files and do not switch branches. Never push.
- Read first: `docs/v2/PLAN.md`, `docs/v2/WEB.md` (rules, component inventory, recipes), then
  `design/reference/README.md`, `design/reference/web-ui.md`, the Web section of `design/reference/motion.md` and the
  previews named in your lane under `design/reference/components/`.
- Not yours, read only: `web/src/components/**`, `web/src/design/**`, `web/src/style.css`, `web/src/index.jsx`,
  `web/package.json`, `web/src/services/**` and every other lane's files (exceptions are named in the lane). If a shared
  component or recipe lacks something, build it inside your page directory (a page-local component, or a CSS file your
  page imports that uses tokens only) and list it in your report as a candidate to promote.
- Replace the presentation; keep every behaviour, guard and piece of data logic. No change to the REST/WebSocket
  contract, storage keys or routes.
- Done means: no daisyUI class, no palette color utility, no `--color-*` reference, no `"Jost"` literal and no class
  without a rule is left in your files (`docs/v2/WEB.md`, rules 1 to 3).
- Verify from `web/`: `npm run lint:check` (0 errors; six hook warnings in Statistics are known) and
  `npx vite build --outDir <your scratch dir>/dist`. Never build into `web/dist`, never run `scripts/build_webui.sh`,
  never run `pio`.
- Run it for real, against a simulator of your own. Pick a scratch directory outside the repository (the simulator
  keeps its state in `./sim_data` of the directory it starts in) and seed it once:
  `mkdir -p <scratch>/sim_data && cp -R scripts/fixtures/web-seed/. <scratch>/sim_data/` (three favourite profiles
  `first`, `second`, `bloom`; two recorded shots). The simulator is `.pio/build/display-sim/program`
  (`pio run -e display-sim` builds it; copy the program into your scratch directory so a later rebuild cannot pull it
  from under you). Start it from the scratch directory in the background:
  `SIM_HTTP_PORT=<sim port> SDL_VIDEODRIVER=dummy <scratch>/program`, then in `web/`:
  `SIM_HTTP_PORT=<sim port> npx vite --port <vite port> --strictPort --host 127.0.0.1`. Use only your two ports
  (port 8080 is taken by Docker on this Mac). The simulator takes `--script "<verbs>"` (`mode brew`, `scale 1`,
  `weight 18`, `pressure-sensor 0`: `sim/SimScript.h`). A web mode change stops the running process. Saving settings
  with a restart exits the simulator: mock that request.
- Playwright is at `/Users/mohamadsherif/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs` (Chromium is
  installed). Screenshot at 390x844 and 1440x1000, light and dark; LOOK at every image yourself and fix what is off
  against the previews and the rules; check the flows with scripted assertions. Stop the simulator and Vite at the end.
- Report, brief and exact: what each page shows, what you removed, page-local pieces that are candidates to promote,
  the proof that no class is left without a rule in your files, lint and build results with the gzip size of your
  chunks, screenshot paths, and what you did not verify or are unsure about. Say plainly if something does not work.

## Dashboard — ports 8092 / 5182

Yours: `web/src/pages/Home/**`, `web/src/pages/DashboardSettings/**`, `web/src/pages/_404.jsx`,
`web/src/utils/{warnings.js,dashboardManager.js,panelDefinitions.js,metricDefinitions.js}`.
Previews: `WebPhone`, `WebDesktop`, `Dial`, `ActionBanner`, `StatTile`, `SegmentBar`, `Segmented`, `Stepper`,
`ListRow`, `Chip`, `StageTrack`. `docs/webui/README.md` says what the Simple view shows and what the firmware really
reports; those decisions stand.

Build the Dashboard of `web-ui.md`, in this order on a phone: the Dial tile (eyebrow with mode and profile, one status
Chip, the `Dial`, then one row with any warning Chip and the Flush button), the `ActionBanner` (the next thing you can
do; while a process runs, the ink STOP form with progress in segments), the StatTiles in two columns (at rest water
tank and last shot; during a shot pressure, flow, weight, temperature, each with a segment bar), the Setup tile
(favourite profiles as a `Segmented`, a link to all profiles, the target temperature `Stepper`), recent shots as
`ListRow`s with the wake schedule as the last row. On desktop the same tiles take the spans of the table in
`web-ui.md` on `bm-grid`. Follow "What the dial shows" for every machine state. Simple shows this and nothing else;
Advanced adds tiles and never swaps a component for a denser one. `utils/warnings.js` still carries
`activeClass: 'btn-*'`: give it what the v2 components need. `DashboardSettings` is a form (tiles of fields,
`Segmented`, `Switch`, `Stepper` instead of range sliders, one pinned primary Button). The chart components belong to
the History lane: use them as they are. Screenshot every machine state you can reach (standby, heating, ready, a real
shot from START to finished, steam, water, grind), Simple and Advanced, DashboardSettings and the 404 page, and check
that start/stop, mode change, target change, favourite pick and flush still work.

## Profiles and Setup — ports 8093 / 5183

Yours: `web/src/pages/ProfileList/**`, `web/src/pages/ProfileEdit/**`, `web/src/pages/Setup/**`,
`web/src/utils/setupState.js`. Previews: `WebPages`, `ListRow`, `Field`, `Segmented`, `Stepper`, `Button`, `Chip`.

- **Profiles**: the one page title, an `ink` Button for New, a search input, one tile of `ListRow`s. The profile in
  use has an `ink` icon disc and an IN USE Chip. A tap selects; a `Menu` at the row's end holds edit, details, export
  and delete (the danger item, with its confirmation). Keep favourites and their drag order (SortableJS; `style.css`
  keeps its two hook classes), import and export (single and all), duplicate, the TCL converter, details, the empty
  and first-run states, search.
- **Profile editor**: tiles of fields. `Segmented` for two or three choices, `Switch` for on and off, an input for
  anything typed, `Stepper` where a value steps; `join` groups become `Segmented`, `bm-input--group` or a `Stepper`.
  The one primary Button is pinned at the bottom (`bm-pinned`). Standard and Pro forms, phases with targets and
  transitions, add/reorder/remove a phase, the profile chart, validation and unsaved-change handling keep working.
- **Setup**: one tile per step, one primary Button per step, the wordmark above. Its final save restarts the machine:
  mock that request in checks.

Check end to end: select, create, edit and save, duplicate, favourite and reorder, export, delete with confirmation,
the Setup steps.

## Settings — ports 8094 / 5184

Yours: `web/src/pages/Settings/**`. Previews: `WebPages`, `Field`, `Segmented`, `Stepper`, `Button`, `Chip`, `ListRow`.
`components/SettingsFormField.jsx`, `components/skeletons/` and `components/PumpFlowCalibration/` are already v2.

The one page title, the tabs (`TabBar`), and tiles of fields: two or three choices are a `Segmented`, on and off is a
`Switch` with label and help on the left, typed values are inputs (with `unit` where they have one), stepping values a
`Stepper`, a `Select` only for more than three choices. One title and one group per tile; nested groups are `Cell`s.
Warnings and notes are `bm-notice`s or `warning` Chips (`alert` becomes `bm-notice`, `toggle` becomes `Switch`, the
old `action-dropdown` becomes `Menu`). Save is the one primary Button, pinned (`bm-pinned`); restart, update, export,
import, reset and calibration runs are secondary Buttons in their tile, `danger` only for delete and reset. Every
setting and action of the five tabs stays with the same names, keys, validation, save and restart behaviour: plugin
cards, the Bluetooth scale scan, OTA, calibration and autotune, time and wake schedules, display and theme.

Check that settings round-trip: change one setting of each control type on each tab, save, reload, read it back
through the page and through `GET /api/settings`; the theme setting still switches Light, Dark and System.

## Shot history and charts — ports 8095 / 5185

Yours: `web/src/pages/ShotHistory/**`, `web/src/utils/chartTheme.js`, and the four shared chart components
`web/src/components/{Chart.jsx,OverviewChart.jsx,ExtendedProfileChart.jsx,ProcessProfileChart.jsx}` (the only lane
that edits them; the Dashboard and the profile pages import them, so keep their props and exports).
Previews: `WebPages`, `WebDesktop`, `ListRow`, `Chip`, `StatTile`.

- **Charts**: lines only. 2.5 px for pressure in `--series-pressure`, 2 px for the others in their series tokens,
  round joins, no fill and no points. Grid in `--chart-grid`: three or four horizontal lines, none vertical. Ticks at
  11 px in Geist Mono (`--font-mono`), `--ink-muted`. The legend is a row of neutral `Chip`s with a series dot, not a
  canvas legend. `animation: false`; a live chart appends points and never redraws its history. Annotations keep
  working in token colors. Colors follow a theme switch. In `applyChartTheme` write to `chart.config.options`: nested
  writes through `chart.options` never reach the drawing.
- **Shot history**: the one page title with Analyzer and Statistics as links under it, one tile per day with an
  `eyebrow` date, rows as `ListRow`s (profile, then time, yield and peak pressure in the `data` style). Opening a row
  shows the shot (chart, facts, notes, rating, Visualizer upload, export, delete with confirmation) as today. Keep
  search, filters, sorting, loading, the binary shot parsing and notes editing.

Check with assertions on the live Chart.js configs: no fill, points or vertical grid; series colors equal the tokens
in both themes and follow a switch; tick font is Geist Mono; a live chart grows without re-rendering its history.
Screenshot each chart where it is used (dashboard live and last shot, the profile editor's chart).

## Shot Analyzer and Statistics — ports 8096 / 5186

Yours: `web/src/pages/ShotAnalyzer/**`, `web/src/pages/Statistics/**`, and one block of `web/src/style.css`: the
`--analyzer-*` / statistics alias variables in the `:root` rule (nothing else in that file).
Previews: `WebPages`, `WebDesktop`, `Chip`, `Segmented`, `Field`, `Button`, `ListRow`, `StatTile`, `SegmentBar`.

The two tools keep their information architecture and every feature and move onto the v2 system. Surfaces are tiles
(`surface-1`) holding cells and controls (`surface-2`); no shadow, gradient or blur anywhere, tooltips, dropdowns,
replay controls and exported replay frames included. Buttons, inputs, selects, checkboxes, segmented choices, tabs,
tables, menus, notices, chips and the spinner come from the recipes. Selection is `ink`; `primary` is the one action;
`heat` is temperature only (four alias variables still point heat tokens at non-temperature series: give resistance
and the like `--ink`, `--ink-muted`, `--weight` or `--flow`, never a new hue). Charts follow the Charts rules of
`web-ui.md` and take their colors from the tokens at runtime, following a theme switch; canvas text and the video
export use the two bundled fonts. Type styles and tabular numerals as in `design/reference/README.md`. Nothing
animates a number or a chart. Everything keeps working: loading shots from the device and from files, the library
(IndexedDB), compare, hover sync, tooltips, phase annotations, the analysis table and its column controls, notes,
replay and its export, deep links, the statistics search DSL, filters, trends, the heatmap and the metrics tables.

Check with assertions: no box-shadow, backdrop-filter or gradient background on any element of your pages; chart
configs have no fill, points or vertical grid; fonts are the two bundled faces; a theme switch recolors the charts;
load a shot, compare, hover, open the library, run a statistics query. Report before and after counts of daisyUI
classes, palette colors, `--color-*` references and `"Jost"` literals in your files.
