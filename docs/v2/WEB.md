# Web v2 — what the foundation gives a page

Read `design/reference/web-ui.md` and the Web section of `design/reference/motion.md` first. This file lists what
exists under `web/src` to build a page from, and the rules a page follows. The foundation landed in `acbdef2e`; the
integration pass of 2026-11-14 fixed what the page lanes reported in the shared files and moved the pieces two or
more pages use out of the pages (the last section says what moved and what stayed).

## Rules

1. **A recipe or a component for everything that has one.** `web/src/design/bm.css` carries the design's `bm-*`
   recipes unchanged, plus the ones the app needs beyond them. The Preact components in `web/src/components/` wrap them.
2. **Tailwind lays the page out and nothing else.** Its color, shadow and blur scales are cleared in `style.css`:
   `bg-white`, `text-gray-500`, `shadow-lg`, `rounded-2xl` compile to nothing. A color comes from a recipe or a token:
   `text-(--ink-muted)`, `bg-(--surface-2)`, `border-(--line)`. `rounded-sm|md|lg|xl|pill`, `ease-in|out` and
   `font-sans|mono` read the tokens. `sm` is 600 px (two tile columns), `lg` is 1024 px (sidebar, twelve columns).
3. **No daisyUI.** The package is gone. `btn`, `card`, `input`, `select`, `toggle`, `badge`, `alert`, `join`, `modal`,
   `dropdown`, `tabs`, `table`, `range`, `tooltip`, `loading` and the `*-primary`/`base-*` colors have no rule any more.
4. **Meaning of color.** Selection is `ink` with `on-ink`. `primary` is the one action of a view (never beside an
   ActionBanner). `heat` is temperature only. Warnings are `warning` Chips or notices, never orange. Status is a word.
5. **Tiles.** A tile is `surface-1`; what sits inside it (inputs, cells, steppers, the segmented track) is `surface-2`.
   A tile never holds a tile: nest with a `Cell`. At most one title or eyebrow, one reading or list, one control group.
6. **Copy.** Sentence case. UPPERCASE only in the mono micro styles, written by the recipes' `text-transform`, never
   typed. Verbs on buttons, nouns on navigation. A missing value is `—`. No emoji, no exclamation marks.
7. **Motion.** `duration-fast` for fills and leaving, `duration-base` for entering; colour, opacity and transform only.
   Numbers snap. Charts `animation: false`. No shimmer. `prefers-reduced-motion` already removes every transition.
8. **Unchanged:** the REST/WebSocket contract, storage keys, routes, lazy-loaded pages. `services/ApiService.js`
   changed only in how it reconnects (every 5 s at most, and `reconnect()` for TRY AGAIN).
9. **Messages** (Content, Messages): a state in one or two words is a Chip; something that just happened is a
   `toast()`; something true that matters is a Notice; a field's problem is its message; nothing to list is an
   EmptyState; a decision is a Dialog. A page never moves focus to a Toast or a Notice, and says nothing to a
   screen reader except through `announce()` and a live Notice.

## Components (`web/src/components/`)

| File | Export | Props | Purpose |
| --- | --- | --- | --- |
| `Icon.jsx` | `Icon` | `name, size=24, className, spin, title, style` | Stroke glyph from `design/iconPaths.js` (53 names), plus `pin`, which the app adds in `Icon.jsx` to the same rules |
| `WarningIcon.jsx` | `WarningIcon` | `icon, title, className, size` | Warning glyph by key |
| `Wordmark.jsx` | `Wordmark` | none | The wordmark file for the theme |
| `Tile.jsx` | `Tile`, `TileHead`, `Cell` | Tile: `as, title, eyebrow, end, tone('heat'\|'primary'), className`; Cell: `as, className` | `bm-tile` with its head; `bm-cell`. A titled tile is a region named by its title (`aria-labelledby`) unless it is given a name |
| `Card.jsx` | default `Card` | `xs,sm,md,lg,xl,title,className,role,fullHeight` | The old API on a Tile |
| `CardTitle.jsx` | `CardTitle` | `className` | `h3.bm-eyebrow` |
| `StatTile.jsx` | `Stat`, `StatTile` | Stat: `label, value, unit, target, bar{value,target,tone,total}, size('sm'), children`; StatTile adds `chip, heating` | A reading; a missing value shows `—` |
| `Chip.jsx` | `Chip`, `TONE_GLYPH` | `tone, dot(true\|css color), className` | Status word; a `warning` Chip leads with `triangle-alert`, a `danger` one with `circle-alert` (14 px) |
| `SegmentBar.jsx` | `SegmentBar`, `Dots` | SegmentBar: `value 0..1, target 0..1, total=20, tone, fill=true, label, as`; Dots: `on, total, cols, label` | Segments, dot matrix |
| `Segmented.jsx` | `Segmented` | `options[{value,label,icon?,disabled?,title?}]\|strings, value, onChange, label, block, scroll, onTile, disabled, describedBy` | A choice of two or three. `block` items share the width equally and their labels end in an ellipsis; `scroll` is a sideways track for more (favourite profiles) |
| `Stepper.jsx` | `Stepper` | `value, onDecrease, onIncrease, canDecrease, canIncrease, decreaseLabel, increaseLabel, onCell, disabled` | Holding repeats |
| `ListRow.jsx` | `List`, `ListRow` | `href\|onClick, icon, current, title, meta, end, action` | `action` holds a Menu outside the row's target |
| `NumberField.jsx` | `NumberField`, `numberProblem` | `unit, min, max, step, required` + native | The design's typed number: `type=text` with the decimal keyboard, the number right-aligned and the unit inside it with its word for readers (`°C` is "degrees Celsius"), Up and Down step (at least 0.1; Shift by ten), a comma is a point, rounded to `step` and checked against `min` and `max` when focus leaves ("Enter 0 to 150 °C."). `FormField` uses it for every `type='number'` with a unit of up to four characters |
| `Field.jsx` | `Field`, `Setting`, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox`, `Radio`, `useDescribedBy` | Field: `label, help, htmlFor, as, optional`; Setting: `label, help, htmlFor`; Input: `unit` + native; Switch: `checked, onChange(next), label, name, id, disabled` | Input, Select and Textarea forward refs; with Switch they are described by the help of the Field or Setting around them. Instructions go in `help`, never in a placeholder. Select is the bundle's markup (`bm-inputwrap` > `select.bm-select` + chevron); its `className` reaches the wrapper. A number input with a `unit` has no spin buttons |
| `FormField.jsx` | `FormField`, `PasswordField`, `SelectField`, `SegmentedField`, `Choice`, `StepperSetting`, `FieldError`, `FormErrors`, `useFieldError`, `useFormValidation` | FormField: `id, label, help, unit, multiline, error` + native; Choice: `id, label, help, options, value, onChange`; the others: `label, help` + the control's props | The fields of a form saved as a whole (Settings, the profile editor). `FormErrors.Provider value={{ id: message }}` gives each field its problem, shown as a danger notice under the control (`id-error`). `useFormValidation()` turns the browser's own validation into those messages. A number field keeps what is typed while it has focus |
| `Button.jsx` | `Button` | `variant('primary'\|'ink'\|'outline'\|'ghost'\|'danger'), size('sm'\|'lg'), iconOnly, block, href, type` | Forwards its ref |
| `IconButton.jsx` | `IconButton` | `icon, label, size('sm'), pressed, href, iconSize=18` | `bm-iconbtn`: a round ghost button for dense toolbars and rows; 36 px (28 px `sm`), 44 px for a finger. Forwards its ref |
| `PinnedAction.jsx` | `PinnedAction` | `status, className` + Button props | The page's one primary Button, pinned (`bm-pinned`), with an optional status row above it |
| `ActionBanner.jsx` | `ActionBanner` | `label, sub, icon, stop, progress 0..1, stretch, busy` + button props | `stretch` is the desktop grid form; `busy` puts a Loader in the disc, sets `aria-busy` and ignores presses |
| `StageTrack.jsx` | `StageTrack` | `stages[{name, weight, progress, state('done'\|'now')}]` | The phases of a shot |
| `TickRing.jsx` | `TickRing`, `litCount`, `notchIndex` | `left, right, full`, each `[value, target, tone]` | The display's ring, same geometry |
| `Dial.jsx` | `Dial` | `left, right, full, eyebrow, value, plan, children` | Needs about 240 px of width |
| `Menu.jsx` | `Menu`, `MenuItem`, `MenuSeparator` | Menu: `label, icon, placement, size, variant`; MenuItem: `icon, danger, checked, hint, href, onClick, disabled` | Portal menu: focus to the first item, Up, Down, Home, End, a letter jumps, Escape returns focus, Tab closes; `aria-controls`. `checked` makes a `menuitemradio`. The destructive item comes last under `MenuSeparator` and opens a ConfirmDialog |
| `Popover.jsx` | `Popover` | `open, onClose, anchor(ref), placement, label, role, matchWidth, width` | `bm-menu bm-popover`: a panel anchored to a control, for content that is not a list of actions (a filter, a date range). Escape and a press outside close it. The design has no card for it; it stays for the Analyzer and Statistics |
| `Dialog.jsx` | `Dialog`, `ConfirmDialog` | Dialog: `open, onClose, title, body, actions[], alert, close, dismissable`; ConfirmDialog: `open, onClose, onConfirm, title, body, confirmLabel, keepLabel='Keep'` | `bm-dialog`, centred from 600 px and `bm-dialog--sheet` below it (actions stacked, the commit first). `alert` is `alertdialog`; the page is inert, Tab stays inside, Escape and the scrim give the safe answer, focus returns to the opener. Mark the focus target with `data-autofocus`. ConfirmDialog asks before anything that cannot be undone, KEEP first and focused |
| `Notice.jsx` | `Notice` | `tone('info'\|'success'\|'warning'\|'danger'), title, children, actions, page, loading, live, onDismiss` | The design's Notice: a 20 px glyph (or a Loader), the title in ink, the text in ink-muted, one or two outline Buttons. `page` is the tile-sized form above the first tile. `live` for one that appears while the page is open (danger is `role="alert"`, the rest `role="status"`). `onDismiss` for a warning only |
| `Toast.jsx` | `toast`, `announce`, `Toasts`, `LiveRegions` | `toast(text, {action:{label,onClick}, alert})`; `announce(text, {alert})` | The one Toast (5 s, 8 s with an action, paused while hovered or focused; a new one replaces it) and the one hidden status region and alert region, rendered once by the shell. A Toast's words go to the status region (a failure to the alert region), so it never takes focus. `announce` writes at most one sentence every 2 s, a newer one replacing one still waiting |
| `EmptyState.jsx` | `EmptyState` | `icon, title, children, action, level=3` | Inside the tile that would hold the list: a 56 px glyph disc, the fact, one sentence, at most one default Button |
| `Loader.jsx` | `Loader` | `size=20 (14, 18, 20, 24, 40), className` | The bundle's twelve-tick comet in currentColor, `aria-hidden`: always beside words, with `aria-busy` on what is working |
| `MachineStates.jsx` | `MachineNotice` | `className` | The one Notice about the machine as a whole, first on every page but Setup: a blocking fault, offline (TRY AGAIN), connecting (after 1 s), or how the last update went |
| `UpdatingPage.jsx` | `UpdatingPage` | | Lazy. Takes the window while firmware installs: the version, the percentage, a segment bar, "Keep the machine on." |
| `SkeletonBlock.jsx` | `SkeletonBlock` | `className, style` | A still `surface-2` block |
| `Tooltip.jsx` | `Tooltip` | `content, placement, disabled` | The name of an icon-only control: 500 ms after the pointer rests, at once on keyboard focus, never on touch; Escape and a press hide it; it can be hovered; hidden from readers when it repeats the control's `aria-label` |
| `PageHeader.jsx` | default | `title, subtitle, actions, tabs, className, noStack` | The one page title |
| `PageLayout.jsx` | default | `variant('wide'\|'narrow'), className` | Column of tiles |
| `TabBar.jsx` | default | `tabs[{id,label,icon,preload}], activeTab, onTabChange, basePath` | Scrolling segmented control. Tabs are `tab-<id>`; only the selected one names its panel (`panel-<id>`), the one on the page |
| `SettingsFormField.jsx` | `ToggleField`, `SortableConfigurator` | ToggleField: `label, htmlFor, checked, onChange, helpText`; SortableConfigurator: `order, definitions, hidden, onOrderChange, emptyMessage, extraControls` | ToggleField is a Switch and still reports `event.target.checked` |
| `AppBar.jsx` | `AppBar`, `shownWarnings(status)` | | Use `shownWarnings` wherever warnings are listed |
| `ModeNav.jsx` | `ModeBar`, `MODES`, `hidesModeBar(path)` | | The one floating mode bar. Locked modes are `aria-disabled`, focusable, described by `#modebar-lock`, and a press answers in the Toast |
| `Chart.jsx` | `ChartComponent`, `ChartLegend` | ChartComponent: `data, className, plotClassName, plotStyle, chartClassName, legend, label, chartRef`; ChartLegend: `datasets, className` | A Chart.js line chart: lines told apart by dash and weight, each named at its right end (value and unit), the legend (Chips with line samples) only over 480 px, the canvas `role="img"` with a label of series, span and final values (`label` is said first). `data` is a config built with `utils/chartTheme.js`; nothing animates |
| `OverviewChart.jsx` | `OverviewChart`, `clearPhaseTransitions` | `hour12` | The live chart: a shot from 0 s, the last minute on the clock between shots. `hour12` is the machine's clock setting |
| `ExtendedProfileChart.jsx`, `ProcessProfileChart.jsx` | `ExtendedProfileChart`, `ProcessProfileChart` | `data, className, style, selectedPhase, onPhaseClick, showPhaseLabels`; Process: `data, processInfo, className, style` | A profile's pressure and flow curve; `style` sizes the plot. Process marks the running phase |
| `PumpFlowCalibration/` | default | `currentCoeffs, onApplied` | The pump flow calibration run of Settings, Calibration |
| `VisualizerUploadModal.jsx` | default | `isOpen, onClose, onUpload, isUploading, shotInfo` | The Visualizer upload Dialog of Shot history |
| `skeletons/SettingsSkeletons.jsx` | one per Settings tab | | Still placeholders |
| `cx.js`, `motion.js` | `cx`; `usePresence`, `tokenMs`, `prefersReducedMotion` | | Helpers |

Outside `components/`:

| File | Export | Purpose |
| --- | --- | --- |
| `utils/chartTheme.js` | `chartOptions({scales, annotations})`, `line(series, label, data, {kind})`, `valueAxis({min,max}, {position, grid, format, hidden})`, `secondsAxis(min, max, format)`, `secondsStep(span)`, `niceAxis(low, high)`, `phaseLine(x, name, showName)`, `band(xMin, xMax)`, `applyChartTheme(config, canvas)`, `seriesColor(series)`, `chartFont()`, `bandColor(kind)`, `DASHED` | The builders of a shared chart's config, following the Charts rules of `web-ui.md`. They leave colours and fonts out; `applyChartTheme` resolves the tokens into the config before the chart is built and again on a theme change (`ChartComponent` calls it) |
| `utils/time.js` | `clock`, `clockOf`, `when`, `dayHeading`, `shortDate`, `dateTime`, `daysAgo`, `toDate` | Times and dates as Content writes them: `14:41`, `Today 14:41`, `12 Nov 07:12`, `11 November`; `2:41 PM` when the machine's 24-hour setting is off (`clock24hSignal`, set from the settings the mode bar loads) |
| `hooks/useMediaQuery.js` | `useMediaQuery(query)` | Whether a media query matches, kept current, for what CSS cannot do alone |
| `utils/machineState.js` | `connection`, `lastSeen`, `retryConnection`, `fault`, `ota`, `updating`, `updateVersion`, `installUpdate(part)`, `requestUpdateInfo`, `dismissUpdateResult`, `startMachineState(apiService)` | The product states about the machine as a whole, from what the WebSocket already reports: `connection` is `connecting` until it opens and for 5 s after a loss, then `offline`; `fault` is the `sys` state `error`, `waiting` or `mismatch` with its words (a mismatch names `CONTROLLER_REQUIRED_VERSION`, the one controller release BetterMate works with); `ota` follows `res:ota-settings` and `evt:ota-progress` and waits for the machine to come back after an install |
| `utils/commands.js` | `sendCommand(label, run, confirmed)`, `pendingCommand`, `settleCommand` | A start or stop waiting for the machine: `pendingCommand` is `{label}` until a status frame confirms it, and after 2 s without one a Toast says the machine did not answer |
| `utils/announcer.js` | `startAnnouncer()` | What the status region says as the machine changes: the mode, heating and ready, a shot starting, each phase, a shot finishing with time and yield |

## Recipes beyond the design's (`bm.css`, parts 2 and 3)

`bm-select`, `bm-textarea`, `bm-input--group`, `bm-checkbox(__box)`, `bm-radio(__box)`, `bm-table`,
`bm-notice__close`, `bm-tooltip` (its layer and fade), `bm-skeleton`, the enter and leave motion of `bm-toast`,
`bm-scrim`, `bm-dialog` and `bm-menu` (`.is-open`, `.is-leaving`; the Dialog rises with `translate` so part 1's
centring stays), `bm-menu(__item)`, `bm-popover`, `bm-iconbtn(--sm)`, `bm-pinned` (the pinned primary Button of a
form), `bm-grid` (1, 2 and 12 columns at 0, 600 and 1024 px), `bm-btn--icon.bm-btn--sm|--lg`, `bm-seg--scroll`,
`bm-cta--stretch`, `button.bm-item`, `bm-item__main`, and the shell's `bm-page`, `bm-topbar`, `bm-sidebar`,
`bm-modebar--float`. Text helpers for the type styles part 1 has no class for: `bm-label` (13), `bm-caption` (12),
`bm-metric` (24), `bm-metric-sm` (15, mono) and `bm-tick` (the chart tick style); they come last in the file, so a
helper wins over the recipe it shares an element with. There is no recipe for a range slider, a progress bar, a rating
or a `<details>` menu: use Stepper, SegmentBar and Menu.

Part 2 also adjusts five reference recipes without touching part 1: a `bm-seg--block` item has 8 px of padding (three
items fit a 320 px phone); `bm-tile__head` wraps, so an end too wide for the row moves under the title;
`bm-stat__target` and `bm-stepper__value` do not wrap; a `bm-stages__name` ends in an ellipsis (the name is in a
`span`); a number input in `bm-input--group` has no spin buttons.

## Decisions taken in the foundation

- The mode lock is kept (the user, 2026-11-17): while a process runs every other mode is locked, Steam included, and
  nothing locks while the machine is in Steam. Locked is not disabled: `aria-disabled`, focusable, `ink-faint`, with
  its reason in a hidden sentence and in the Toast when pressed. Modes also lock offline, during a fault (only
  Standby is left) and while a start or stop waits for the machine.
- The top bar shows a back arrow instead of the menu on detail pages. Its warning glyph appears when
  `shownWarnings(status)` is not empty: none in standby, flush only in Brew, never `temperature`.
- The collapsible desktop rail and the phone-landscape mode rail are gone: one floating mode bar at every size.
- On `/setup` the shell leaves its navigation, top bar, mode bar and skip link out (`coversShell` in `index.jsx`):
  Setup is the whole window, and nothing behind it can take focus or a key press.

## What the integration pass moved, and what stayed (2026-11-14)

Moved, because two or more pages used it or carried their own copy:

- `IconButton`, `Popover` and the pin glyph, from `pages/ShotAnalyzer/ui/` (Statistics imported them from there), with
  their recipes as `bm-iconbtn` and `bm-popover`. The pin is `<Icon name='pin' />`.
- The type helpers `an-label`, `an-caption`, `an-metric`, `an-metric-sm` and `an-tick` of the Analyzer's `tool.css`,
  as `bm-label`, `bm-caption`, `bm-metric`, `bm-metric-sm` and `bm-tick`. `an-body` and `an-unit` had no user and are
  gone.
- The form fields of `pages/Settings/fields.jsx` and `pages/ProfileEdit/form.jsx`, which were two versions of one
  thing, as `components/FormField.jsx`. One error look for both pages: a danger notice under the control and a danger
  hairline on the input. The help stays under a field that has a problem.
- The pinned primary Button that Settings, the profile editor and Dashboard settings each wrote out, as `PinnedAction`.
- `useMediaQuery`, from the Statistics toolbar; Shot history's `usePhoneWidth` and two inline copies in the Analyzer
  use it.

Stayed in its page, because one page uses it:

- Dashboard: `reading.css` (a reading's target under its unit in a tile under 200 px), `layout.js`, `When` and
  `PendingRow` in `RecentShots.jsx`, `FlushButton`.
- Profiles: `ConfirmMenuItem`, `PhaseTabs`, `useUnsavedGuard`, `ProfileForm`. Setup's password row (its show button
  sits beside the input, not inside it).
- Settings: `SaveBar.jsx` (the save status and the restart tile), `PluginCard.jsx`, `ImportNotice.jsx`, `grid.js`.
- Shot history: its pager.
- Analyzer and Statistics, which are built from the same parts: `ShotBadge`, `ui/chartTokens.js` (it resolves the
  `--analyzer-*` aliases; `utils/chartTheme.js` serves the shared charts and the two are not one API), and the rest of
  `ui/tool.css` (legend chips, rating marks, `an-scroll`, `an-press`, `an-drop`, `an-input--sm`, `an-data`). Both
  tools' entry files import `tool.css`.
