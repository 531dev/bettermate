# BetterMate v2 — status and handoff

Written 2026-11-14 at the end of the session that started the redesign, and kept current by the session that
followed the same day: the web lanes, the web integration and the display loose ends are done in the simulator.
What is left is the hardware session and the user's decisions (section 3; items 12 to 18 are from the second
session). Branch `ui/v2`, published as `main` at `github.com/531dev/bettermate` (push only when asked). Everything
described here is committed; the tree is clean.

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
  core 35, shot 565, modes 520, menu 891, profiles 1401, and the same counts with `SIM_PANEL_SIZE=466` (as of
  `4cd810c7`, 2026-11-14). Native tests: 57 pass, 7 skipped.
- **Motion budget, measured in the simulator** (share of the panel repainted in one frame): a screen change 20 to
  23% in its largest frame (limit 25%; the host delays the incoming rank a frame when a pair of screens would exceed
  22%); the ring walk about 3%; a running shot at most 5.3%; modes running under 5%; the busy comet under 1%.
- **Size.** `pio run -e display` with the v2 web bundle embedded (2026-11-14): 3,057,197 bytes of flash (46.6%; was
  3,838,157 before v2) and 84,000 bytes of static RAM (was 94,312). The packed web bundle is 440,454 bytes (67
  assets; the old one was 611,015). One draw buffer instead of two frees a further 460 KB of PSRAM at run time.
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
  against Vite and the simulator (not against the embedded bundle). The integration pass and the display loose ends are
  done too (section 2, items 2 and 4). What is left needs the user: the hardware session, and the decisions of
  section 3.

## 2. What is left, in order

1. **Web pages**: finish and verify the five lanes (`WEB-LANES.md`). The table in section 1 says which are done.
2. **Web integration**: done 2026-11-14 (`b4777ead` shared fixes, `e2aab814` promotions, `9632fb4e`
   `verify_web_ui.mjs`, `e4008dbf` `docs/webui/`, `6c30de97`).
   - Every "shared fixes wanted" in the lane table is made, and what two or more pages used is promoted
     (`IconButton`, `Popover`, `FormField` and its family, `PinnedAction`, `useMediaQuery`, the pin glyph, the
     `bm-label`/`bm-caption`/`bm-metric`/`bm-tick` type helpers). `docs/v2/WEB.md`, last section, says what moved
     and what stayed with its page and why. The "For integration" clauses in the table are history.
   - `scripts/verify_web_ui.mjs <base URL> --playwright-module <path>` passes 624 assertions (shell 31, pages 576,
     flows 17) against Vite plus a seeded simulator, and again against the bundle embedded in the simulator by
     `scripts/build_webui.sh` and `pio run -e display-sim` (`docs/webui/results-embedded.json`). It needs a
     disposable simulator on the `web-seed` state.
   - The lanes' own checks (in the session scratch directory, not in the repository) were rerun after the shared
     changes and pass, except where they assert what integration changed on purpose: 22 assertions of the Profiles
     lane's `tab-setup.mjs` (Setup's Tab loop, gone because the shell is not rendered on `/setup`); one of the
     History lane's weight check (it expects a curve tile for a standard profile, decision 14); four Analyzer
     scripts select `.an-popover`/`.an-iconbtn`, now `.bm-popover`/`.bm-iconbtn`, and pass with that rename.
   - `build_webui.sh` ran under Node 25.9, not the `.nvmrc`'s Node 22; the build and the check pass.
   - Left for the web: nothing was run in Safari or on a phone, or served from an ESP32; `StageTrack`'s `is-done`
     class has no rule (the design's markup).
3. **Hardware**: flash `display-frame-stats`, read the `FrameStats` lines (pass mark: no line over 42 ms a frame or
   25% redrawn while something animates), check touch targets, the ring, a real shot, steam, the scale, the AMOLED
   flush if such a board is at hand. Back up the flash first, as on 2026-10-03 (`docs/hardware/2026-10-03.md`).
4. **Loose ends on the display**: done 2026-11-14 (`90488c24`, `90034020`, `4cd810c7`), one decision left.
   - **466 px.** Every state the checks visit was captured and looked at (`docs/display/v2/466/`, 76 captures). The
     ring was drawn at screen coordinates, so at 466 it sat 7 px off-centre and the edge cut it; it now lies on the
     stage and its ticks end at 227 instead of 234 there. Nothing else was clipped, off-centre or mis-hit. The five
     checks run at 466 unchanged: `SIM_PANEL_SIZE=466 python3 scripts/verify_display_<name>.py` (script points and
     layout dumps are always in the design's 480 px box). Simulator only: no AMOLED board was flashed.
   - **The 11 x 11 px repaint.** A new label, visible at the stage's origin until `part()` hides it, invalidated
     LVGL's glyph margin there with every style set. Screens are now built with invalidation off.
     `SIM_TRACE_INVALIDATE=1` (or `=stack`) shows who invalidates what.
   - **Stage bars.** One bar per phase for up to 16 phases, which is what the 220 px row holds. **Open:** a profile
     of more than 16 phases shows its first 16, all full while the rest run. Options in
     `docs/display/v2/shot/over-16-phases-options.png`: A a window that follows the shot, B neighbouring short phases
     share a bar (the agent's recommendation), C smaller marks.
   - Two flaky checks were fixed on the way (a chevron "lost" after a theme change, from stale pointers in the
     simulator's list of readings; the comet check when the clock's minute turned inside its window). Not run: the
     slow `steam-ready` case of `verify_display_modes.py`, `pio check`, `scripts/format.sh` (`clang-format` is not
     on PATH). Seen and unchanged: "Menu to Standby, forced by the controller's loss" repaints the whole panel in
     one frame; `verify_display_menu` lists it as not judged.
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
16. Display at 466 px (2026-11-14): the ring's ticks are 15 px long instead of 22 (the outer end comes in 7 px; the
    inner end and the notch stay), rather than the whole ring moving inward. The step budget for a screen change is
    22% of the real panel.
17. The stage row draws up to 16 bars (was 8, an array size), read from the design's "one bar per phase" and its
    220 px row.
18. Web integration (2026-11-14): both forms show an error the same way (a danger notice under the control and a
    danger hairline on the input, the help text staying); number fields in Settings keep what is typed while
    focused, as the profile editor's do; the pump flow calibration's buttons are all secondary, so Cancel and
    Start calibration look alike; Setup has no focus trap (the shell is not rendered under it, so Tab leaves for
    the browser as on any page); a wide `end` in a tile head moves under the title.
19. Lane W1 of `DS-1116-LANES.md`, the web fixes of the 2026-11-16 revision (2026-11-17):
    - **Recipes.** `bm.css` part 1 is the new `bundle.css` again; part 2 keeps the Dial-tick segment bars (6 px
      apart, 3 px in a fill track: spacing outside the `space-*` scale, kept on purpose) and the app's paragraph
      Notice (words in the tone's colour) until Lane W2 brings the design's Notice. `bm-tick` is `data` (13 px, was
      11). The desktop ActionBanner keeps `button-lg` (it was enlarged to 20 px). `control-sm` (36 px) stays for a
      fine pointer and grows to 44 px on touch; a 28 px icon button has a 36 px hit area.
    - **Locked modes.** As the user decided, Steam locks with the others while a process runs. A locked mode is
      `aria-disabled`, focusable, described by a hidden sentence that names the cause (shot, flush, grinding, water,
      not connected, not ready), and a press answers above the mode bar for 5 s ("Stop the shot to change mode.").
      That answer is a provisional Toast inside `ModeNav.jsx`; Lane W2 should move it into the one Toast region.
    - **Fields.** An error replaces the help under its field, as the design says (item 18 kept both). Optional
      fields say "Optional" beside the label.
    - **Charts.** Only the shared charts (`chartTheme.js`: Dashboard, History, profile curves) follow the Chart
      card. The Analyzer and Statistics charts are unchanged: their compare mode already draws shot 2 dashed, so
      a dashed flow line would clash there. The shared charts keep their two value axes; the end labels sit in a
      gutter right of the right-hand axis, not on the design's single-axis anatomy. A target is a fine 2 3 dash at
      1.5 px and an estimate (puck flow, weight flow) a fine dash-dot, so neither reads as flow or weight. Shot
      history still draws up to six readings where the design says at most four.
    - **Times.** The web is always on the 24-hour clock (Content: "no AM or PM"); the machine's "Use 24h format"
      now says it sets the display's clock. (Changed by item 23: the setting is the web's too.) A recent shot older than yesterday shows `11 Nov` on a phone instead
      of the weekday (amends item 14). History's day tiles read `11 November`.
    - **Favourites.** Up to ten favourites in a scrolling track (was three squeezed into thirds).
20. Lane W2 of `DS-1116-LANES.md`, web components and product states (2026-11-17):
    - **Components.** Notice, Toast, EmptyState, Loader, Dialog (with ConfirmDialog), NumberField and
      MenuSeparator are new; Menu, Tooltip, Tile, the mode bar and the top bar follow their cards. Spinner,
      Sheet, ConfirmButton, ConfirmMenuItem, `useConfirmAction` and the paragraph Notice of part 2 are gone.
      Popover stays (the Analyzer's and Statistics' filters; the design has no card for it), and so do the
      skeletons of Settings tabs, the profile curve and Recent shots while a list loads (they are not readings).
    - **One status region.** The Toast region is not itself live: a Toast's words go to the one hidden
      `role="status"` region (a failure to the one `role="alert"` region), which also says the mode, Heating,
      Ready, Shot started, each phase and "Shot finished: 30.2 seconds, 36.1 grams." Offline and a fault are
      said by their live danger Notice, not by a second sentence.
    - **Deleting asks in a Dialog** (profile, all profiles, a shot) instead of arming a control for 4 s; the
      shot's delete is a ghost DELETE button. The top bar's menu button is named "Menu" (was "Open navigation").
    - **NumberField** is used by every `FormField` number with a unit of up to four characters, in Settings as
      well as the profile editor. Up and Down add the field's own step but at least 0.1 (temperature steps 0.1
      where the card's table says 0 decimals, because the editor's field has `step='0.1'`). A range is said
      under the field when focus leaves, not only on save.
    - **Connection.** Connecting shows only after 1 s (a page that connects at once does not flash a Notice);
      after a loss it is Connecting for 5 s and then Offline. Offline, the readings show `—` although the last
      ones are still known. `ApiService` now retries every 5 s at most (was a backoff to 30 s) and has
      `reconnect()` for TRY AGAIN: a change to how it reconnects, not to the contract.
    - **Faults** are the display's `sys` states `error`, `waiting` (controller not found) and `mismatch`, each
      with its own words; `starting` and `autotuning` are not faults. There is no RESTART on the web: no request
      restarts the controller. A mismatch links to Settings, System. Only Standby stays unlocked.
    - **Command pending** covers START and STOP (shot, flush, water, grind). Wake, Done and mode changes are not
      held. A brew that the controller asks to confirm first counts as an answer.
    - **Updates.** "Version X is ready" is on every Settings tab, with INSTALL (the display's firmware first
      when both parts have one) and DETAILS. Updating takes the window from the press of INSTALL (given up with
      a Toast after 10 s without progress) until the machine is back: after phase 4 it waits for the
      connection to drop and return, or 20 s. "Updated to X" and "The update failed" have a close button: the
      design gives them no end, and nothing else would clear them.
    - **Saving.** Settings says "Settings saved" in a Toast (the Saved Chip is gone; "Saved, restarting"
      stays). A profile save that fails used to leave SAVING forever; it now keeps the form, shows a danger
      Notice above it and repeats it in a Toast. Offline, both Saves are disabled with "The machine is
      offline. Save once it is back."
    - **Not done:** the Wi-Fi scan states of Setup (a "Scanning" Select, "No networks found" with SCAN AGAIN,
      the 15 s limit): see item 22. The first start screen was not touched. (Hardware not present: item 22.)
21. Display, design revision of 2026-11-16 (Lane D of `DS-1116-LANES.md`, 2026-11-17):
    - **Content limits.** `ui::fit` takes a character limit as well as a width and cuts one short with `…`. Brew's
      name group is 312 px (was 284): 18 characters of screen-title need about 263 px, and 17 plus the ellipsis
      (wider than a letter) up to 280. Letters the faces lack fold to their base letter (Latin Extended-A,
      typographic quotes and dashes); a letter with no base is left out.
    - **Warnings** show three cards and "+N more" (screen-body, muted) under them. Three do not fit above the pill
      where the design draws two (label 112, cards from 138), so the label takes the label zone at 86 and the cards
      start at 104, 68 px apart, the count at 328. One card a rank of the screen change (two in one rank went over
      the 25% step budget with a reading stepping in).
    - **Standby** is always 24-hour: the display ignores the 12-hour setting (the web still offers it; changed
      by item 23). While
      connecting the date stays and no state word replaces it. With an update waiting the line reads "Update 1.9.1
      is ready" (the release tag's `v` dropped; "An update is ready" when the version is unknown or over 9
      characters). For this the OTA plugin's internal `ota:update:status` event now carries `version`; no REST or
      WebSocket change.
    - **Command pending** is Brew's START only. The warning reads "Controller did not answer" (25 characters: the
      lane's "The controller did not answer" does not fit a card; this fits its 266 px). It heads the WARN cards and
      raises the slot glyph, and goes on the next START, on a started shot, or with DONE on Warnings. The quiet pill
      repaints its own box, 5.2% of the 480 panel and 5.5% of the 466 (the design's "5% for a pill"); the handle
      goes a frame later so no frame carries both.
    - **Faults that block brewing** (`BetterMateUI::watchFault`): a boiler runaway (no pill: the controller keeps
      its heater off until it is switched off, and a display restart would only hide the fault), link errors 1 to 3
      (RESTART restarts the display; today's controller never sends these, so the pill will rarely be seen), any
      other error code (no pill), a protocol mismatch (no pill; the update is in the web app), and the controller
      missing for 5 s after the display stopped waiting for it (at boot 10 s + 5; after a loss 5 s). Before those
      5 s Standby shows the comet and "Waiting for the controller". "Boiler sensor lost" and RETRY from the design
      have nothing behind them: the controller reports no such fault.
    - **Updating** shows the progress of the part being installed: the OTA plugin reports 0 to 100 for the
      controller's firmware and again for the display's; since item 22 each takes half the ring when both
      install. 0 until the first report. Not seen on hardware; the simulator injects progress (`update-progress`).
    - **Wi-Fi setup** stands in for Standby while the machine's access point is up, and a tap anywhere wakes the
      machine as on Standby. The design gives it no action and ranks it above Running; taken literally it would
      lock out a machine that is never put on Wi-Fi. Information in access-point mode uses the same words (JOIN
      THIS WI-FI, SCAN TO SET UP).
    - The design re-import changed screen-body's line height (26 to 27); the checks that compared it were updated.
    - Captures refreshed at 480 px only here; item 22 refreshed `docs/display/v2/466/`.
22. Follow-ups to items 20 and 21 (2026-11-18):
    - **One TRY AGAIN.** Offline, the Dashboard's ActionBanner says TRY AGAIN and the danger Notice above it has
      no button (one action, in one place). Every other page has no banner, so its Notice keeps TRY AGAIN.
    - **No scale** (`bta` false, Product states: Hardware not present). Simple still leaves the weight out.
      Advanced and Customize keep the Weight tile as an EmptyState ("No scale connected", PAIR A SCALE to
      Settings, Bluetooth); it is taller than a reading, so it goes last on a row of its own (phone and desktop),
      and a reading left alone before it takes its row too. Stop shot by and Stop grinding by show Time,
      disabled, with "Connect a scale to use this." (the firmware stops by time without a scale). The Settings
      tile Predictive scale delay stays editable: a scale sleeps between shots, and the setting would then
      almost never be open.
    - **Updating, both parts.** The web plugin's internal `ota:update:start` carries `parts` (how many will
      install); the controller's firmware fills the first half of the ring and the display's the second. The web
      app installs one part per INSTALL, so its bar was never affected. Simulator verbs `update-start <parts>`
      and `update-phase <phase>`.
    - **Wi-Fi scan states not built.** The firmware has no Wi-Fi scan request: Setup takes the network's name
      as typed. The design's Select of networks, "Scanning" and SCAN AGAIN need a new request (for example
      `GET /api/wifi/networks`), which is a change to the REST contract; left for the user to decide.
    - **Boiler sensor lost** stays out: the controller (pinned to v1.9.0) reports no such fault.
    - **466 px.** Every check passes there again (core 180, menu 916, modes 520, profiles 1414, shot 565) and
      `docs/display/v2/466/` is refreshed, with the new Fault, Updating, Wi-Fi setup, STARTING and folded-letter
      captures. The one failure was the check's: at 466 the handle's box ends past the panel's edge, so its
      repaint is 56 by 55, not 56 by 56. At 480 the same counts pass. `pio run -e display`: 3,076,297 bytes of
      flash (+488), RAM unchanged. `verify_web_ui.mjs`: 1,198 pass plus the desktop no-scale case.
23. The controller requirement and the 12-hour clock (2026-11-20, both asked for by the user):
    - **Controller on v1.9.0.** BetterMate speaks link protocol 5, which only GaggiMate `v1.9.0` controllers
      speak (upstream `v1.10.0`, released 2026-11-18, is on 16). `CONTROLLER_REQUIRED_VERSION` in
      `core/constants.h` is the one place that says so; the OTA pin is built from it. The README has a
      Requirements section. On the display a mismatch is "Controller too new" / "BetterMate needs v1.9.0." or
      "Controller too old" / "Update it to v1.9.0." (was "Version mismatch" and "Update the display", which no
      BetterMate update could answer). On the web the newer side names v1.9.0 and has no link, since Settings
      cannot put a controller back; the older side keeps "Open updates". `getSystemStateMessage()` is unchanged.
      Nothing downgrades a controller: the user reflashes it with GaggiMate's own tools.
    - **12-hour clock.** "Use 24h format" (`clk_24h`, default on) is one setting for the display and the web
      again, as Content allows: `2:41 PM`, no leading zero. On Standby the hero face has figures only, so AM or
      PM is a screen-label word in ink-muted, 10 px after the clock on its baseline, and the two are centred as
      one (the user's choice among three placements). It rests and drifts with the clock on an AMOLED panel.
      The wake line reads "Wakes at 6:30 AM". On the web `utils/time.js` reads `clock24hSignal`, which the mode
      bar sets from the settings it already loads; until they arrive a page shows 24-hour times. The live
      chart's strip shows `9:41` without AM or PM. Time inputs (`<input type="time">`) follow the browser.
    - Simulator: `clock <12|24> [tz]`; a POSIX zone moves its local time, which is how the check reaches
      midnight, 13 h and 22 h. Captures `docs/display/v2/core/standby-12h*.png` and `fault-controller-*.png`.
    - Checked 2026-11-20 in the simulator: display core 232 at 480 and at 466 px, menu 916, modes 520,
      profiles 1414, shot 565 (those four at 480 only); `verify_web_ui.mjs` 1,201 against Vite and the seeded
      simulator (not against the embedded bundle); native tests 57 pass, 7 skipped; `pio run -e display`
      3,099,053 bytes of flash (47.3%), RAM 84,000. Not on hardware, like the rest of v2.

## 4. Restarting — one prompt per session

Usage credits ran out with nine agents at once. Run one session per item, or two or three in parallel at most; each
prompt stands on its own.

The web page lanes, the web integration and the display loose ends are done; their prompts are gone from here.

**Display on hardware** (needs the user at the machine):

> Help me flash and measure BetterMate v2 on the LilyGo T-RGB as `bettermate/docs/v2/STATUS.md`, section 2, item 3
> describes. Back up the flash first. Ask me for the `FrameStats` serial lines before changing anything.

**A decision of section 3** (for instance the six Customize options, or more than 16 phases):

> Read `bettermate/docs/v2/STATUS.md`, section 3, item <n>. I have decided: <decision>. Make that change, keep
> `scripts/verify_web_ui.mjs` (web) or the five `scripts/verify_display_*.py` (display) passing, update `STATUS.md`
> and commit.

## 5. Practical notes

- Build and check the display: `pio run -e display-sim`, then
  `for check in scripts/verify_display_*.py; do python3 "$check" || break; done` (about 25 minutes; they run in
  parallel safely with `SIM_PORT_BASE` set apart). Never rebuild `display-sim` while one is running.
- The simulator keeps its state in `./sim_data` of the directory it starts in. `scripts/fixtures/web-seed/` is a
  seeded state (three favourite profiles, two recorded shots) for web work. Port 8080 belongs to Docker on this Mac:
  set `SIM_HTTP_PORT`.
- Playwright for web checks: `/Users/mohamadsherif/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs`.
- Regenerating display assets needs `fonttools` and `brotli` in a Python environment, Pillow, `rsvg-convert` and Node.
- The second session's scratch directory may still exist with the lanes' check scripts, logs and screenshots:
  `/private/tmp/claude-501/-Users-mohamadsherif-Developer-betterMate/9659251f-1b38-45e8-a15e-87e26884bb0a/scratchpad/`
  (`web-home`, `web-profiles`, `web-settings`, `web-history`, `web-analyzer`, `web-integration`, `display-loose`,
  `final`). Nothing depends on it; `scripts/verify_web_ui.mjs` and `scripts/verify_display_*.py` are the checks
  that live in the repository.

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
| `b760f232`, `b5050d6b`, `6a52b9f6`, `83100bb1`, `10d482d8` | Shot Analyzer and Statistics lane. |
| `da54fe15` | Settings lane. |
| `22533719`, `a9654880` | Shot history and charts lane. |
| `8c5c42c4`, `9bdf6abd` | Profiles and Setup lane. |
| `2014b256`, `abfb0e82`, `ee556143` | Dashboard lane. |
| `90488c24`, `90034020`, `4cd810c7` | Display loose ends: 466 px, the origin repaint, up to 16 stage bars. |
| `b4777ead`, `e2aab814`, `9632fb4e`, `e4008dbf`, `6c30de97` | Web integration: shared fixes, promotions, `verify_web_ui.mjs`, `docs/webui/`. |
| `a8a7aaf9`, `60863d34`, `cad656c2`, `989b33cd`, `61d3a45a`, `21b27d42`, `4930eb7f` | Lane W1 (2026-11-16 revision, web fixes): `bm.css` part 1 re-synced and no opacity for state; field help linked and no instructions in placeholders; readable locked modes; chart dashes, end labels and spoken labels; glyphs on warning and danger Chips; 44 px targets; favourites scroll, 24-hour times, 320 px. `verify_web_ui.mjs` passes 1,008 assertions against Vite and the seeded simulator. |
| `d7d1c7b4`, `915ce19b`, `4f569fc1`, `393905cc`, `d6ab70bc`, `0a4b9f43`, `08ec8925`, `b8d68cc8` | Lane W2 (2026-11-16 revision, web components and product states): Notice and Loader; one Toast region and one status region; Dialog and ConfirmDialog for deletions, Menu details; EmptyState, NumberField, Tooltip, Tile and top bar details; Connecting, Offline, fault, command pending, update ready, updating, saving; the Updating page lazy; `verify_web_ui.mjs` gains a states part; it passes 1,190 assertions against Vite and the seeded simulator. Web bundle 370,154 bytes gzipped (+4,766), entry script 24,663 (+5,999). |
| `8240451f`, `36ece42b`, `4cdf84d3` | Lane D (design revision of 2026-11-16): `…` and folded letters, content limits, three warnings, Standby's lines, command pending, Fault, Updating, Wi-Fi setup; a fault's title on one line. Checks: core 170, shot 565, modes 520, menu 916, profiles 1414 (480 px only). `pio run -e display`: 3,075,909 bytes of flash, 84,000 of RAM. Decisions in section 3, item 21. |
| `413b56b2` | The controller requirement: `CONTROLLER_REQUIRED_VERSION`, the mismatch words on both faces, the README's Requirements. Section 3, item 23. |
| `b4172511` | The 12-hour clock on the display and the web, from the one setting; the simulator's `clock` verb. Section 3, item 23. |
