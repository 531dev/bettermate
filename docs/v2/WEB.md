# Web v2 — what the foundation gives a page

Read `design/reference/web-ui.md` and the Web section of `design/reference/motion.md` first. This file lists what
exists under `web/src` to build a page from, and the rules a page follows. The foundation landed in `acbdef2e`.

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
8. **Unchanged:** `services/ApiService.js`, the REST/WebSocket contract, storage keys, routes, lazy-loaded pages.

## Components (`web/src/components/`)

| File | Export | Props | Purpose |
| --- | --- | --- | --- |
| `Icon.jsx` | `Icon` | `name, size=24, className, spin, title, style` | Stroke glyph from `design/iconPaths.js` (53 names) |
| `WarningIcon.jsx` | `WarningIcon` | `icon, title, className, size` | Warning glyph by key |
| `Wordmark.jsx` | `Wordmark` | none | The wordmark file for the theme |
| `Tile.jsx` | `Tile`, `TileHead`, `Cell` | Tile: `as, title, eyebrow, end, tone('heat'\|'primary'), className`; Cell: `as, className` | `bm-tile` with its head; `bm-cell` |
| `Card.jsx` | default `Card` | `xs,sm,md,lg,xl,title,className,role,fullHeight` | The old API on a Tile |
| `CardTitle.jsx` | `CardTitle` | `className` | `h3.bm-eyebrow` |
| `StatTile.jsx` | `Stat`, `StatTile` | Stat: `label, value, unit, target, bar{value,target,tone,total}, size('sm'), children`; StatTile adds `chip, heating` | A reading; a missing value shows `—` |
| `Chip.jsx` | `Chip` | `tone, dot(true\|css color), className` | Status word |
| `SegmentBar.jsx` | `SegmentBar`, `Dots` | SegmentBar: `value 0..1, target 0..1, total=20, tone, fill=true, label, as`; Dots: `on, total, cols, label` | Segments, dot matrix |
| `Segmented.jsx` | `Segmented` | `options[{value,label,icon?,disabled?}]\|strings, value, onChange, label, block, onTile, disabled` | A choice of two or three |
| `Stepper.jsx` | `Stepper` | `value, onDecrease, onIncrease, canDecrease, canIncrease, decreaseLabel, increaseLabel, onCell, disabled` | Holding repeats |
| `ListRow.jsx` | `List`, `ListRow` | `href\|onClick, icon, current, title, meta, end, action` | `action` holds a Menu outside the row's target |
| `Field.jsx` | `Field`, `Setting`, `Input`, `Select`, `Textarea`, `Switch`, `Checkbox`, `Radio` | Field: `label, help, htmlFor, as`; Setting: `label, help, htmlFor`; Input: `unit` + native; Switch: `checked, onChange(next), label, name, id, disabled` | Input, Select and Textarea forward refs |
| `Button.jsx` | `Button` | `variant('primary'\|'ink'\|'outline'\|'ghost'\|'danger'), size('sm'\|'lg'), iconOnly, block, href, type` | No ref forwarding |
| `ActionBanner.jsx` | `ActionBanner` | `label, sub, icon, stop, progress 0..1, stretch` + button props | `stretch` is the desktop grid form |
| `StageTrack.jsx` | `StageTrack` | `stages[{name, weight, progress, state('done'\|'now')}]` | The phases of a shot |
| `TickRing.jsx` | `TickRing`, `litCount`, `notchIndex` | `left, right, full`, each `[value, target, tone]` | The display's ring, same geometry |
| `Dial.jsx` | `Dial` | `left, right, full, eyebrow, value, plan, children` | Needs about 240 px of width |
| `Menu.jsx` | `Menu`, `MenuItem` | Menu: `label, icon, placement, size, variant`; MenuItem: `icon, danger, href, onClick, disabled` | Portal menu, arrow keys, Escape |
| `Sheet.jsx` | `Sheet` | `open, onClose, title, dismissable` | Dialog over the scrim; mark the focus target with `data-autofocus` |
| `Spinner.jsx` | `Spinner` | `size(4\|8\|12\|16), className` | Stepping tick comet |
| `SkeletonBlock.jsx` | `SkeletonBlock` | `className, style` | A still `surface-2` block |
| `Tooltip.jsx` | `Tooltip` | `content, placement, disabled` | |
| `ConfirmButton.jsx` | `ConfirmButton` | `onAction, icon, tooltip, confirmTooltip, btnSize` | Disarms after 4 s |
| `PageHeader.jsx` | default | `title, subtitle, actions, tabs, className, noStack` | The one page title |
| `PageLayout.jsx` | default | `variant('wide'\|'narrow'), className` | Column of tiles |
| `TabBar.jsx` | default | `tabs[{id,label,icon,preload}], activeTab, onTabChange, basePath` | Scrolling segmented control |
| `SettingsFormField.jsx` | `SettingsFormField`, `InputGroupField`, `ToggleField`, `SortableConfigurator` | unchanged | ToggleField is a Switch and still reports `event.target.checked` |
| `AppBar.jsx` | `AppBar`, `shownWarnings(status)` | | Use `shownWarnings` wherever warnings are listed |
| `ModeNav.jsx` | `ModeBar`, `MODES`, `hidesModeBar(path)` | | The one floating mode bar |
| `cx.js`, `motion.js` | `cx`; `usePresence`, `tokenMs`, `prefersReducedMotion` | | Helpers |

## Recipes beyond the design's (`bm.css`, parts 2 and 3)

`bm-select`, `bm-textarea`, `bm-input--group`, `bm-checkbox(__box)`, `bm-radio(__box)`, `bm-table`,
`bm-notice(--warning|--danger|--success)`, `bm-tooltip`, `bm-spinner`, `bm-skeleton`, `bm-scrim`, `bm-sheet`,
`bm-menu(__item, __item--danger)`, `bm-pinned` (the pinned primary Button of a form), `bm-grid` (1, 2 and 12 columns at
0, 600 and 1024 px), `bm-btn--icon.bm-btn--sm|--lg`, `bm-seg--scroll`, `bm-cta--stretch`, `button.bm-item`,
`bm-item__main`, and the shell's `bm-page`, `bm-topbar`, `bm-sidebar`, `bm-modebar--float`. There is no recipe for a
range slider, a progress bar, a rating or a `<details>` menu: use Stepper, SegmentBar and Menu.

## Decisions taken in the foundation

- The mode lock is kept as it was: while a process runs every other mode is disabled, and nothing locks while the
  machine is in Steam (leaving Steam is how steaming ends). The design's mock draws Steam enabled during a shot; a web
  mode change stops the running process, so the lock stays.
- The top bar shows a back arrow instead of the menu on detail pages. Its warning glyph appears when
  `shownWarnings(status)` is not empty: none in standby, flush only in Brew, never `temperature`.
- The collapsible desktop rail and the phone-landscape mode rail are gone: one floating mode bar at every size.
