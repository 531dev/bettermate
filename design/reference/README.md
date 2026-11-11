BetterMate is one instrument with two faces: the 480 px round display on the espresso machine and the web app the machine serves. Both show a quantity the same way: one large numeral, a mono label, and a ring or row of discrete ticks. Ink selects, cobalt acts, orange belongs to the boiler. Nothing has a shadow, a gradient or a blur, and on the display nothing moves that the panel cannot redraw inside one scan.

## Principles

1. **One reading, one action.** Every view has one largest numeral and one cobalt control. On the display that is a `screen-hero` reading and one pill. On the web it is the Dial's `metric-xl` reading and the ActionBanner.
2. **Quantities are drawn in ticks.** Rings, segment bars, dot matrices and stage bars are rows of discrete marks, lit in a tone and unlit in `track`. Never draw a continuous arc, a gradient scale or a needle. One tick is 0.3% of the display, so the choice that sets the look is also what keeps motion smooth.
3. **Ink selects, cobalt acts, orange heats.** A selected segment, the active mode and a checked switch are `ink` with `on-ink`. `primary` is only the action you can take next, and pressure. `heat` is only temperature. Warnings are amber `warning`, never orange.
4. **Tone steps make depth.** `surface-0` is the ground, `surface-1` a tile, `surface-2` a control or cell inside a tile. No `box-shadow`, no blur, no gradient; `shadow-none` is the only shadow token.
5. **Normal is quiet.** Show a state only when it is an exception: a Chip that says HEATING, a warning glyph at 12 o'clock, a soft tint on one tile. A resting reading that cannot change what the person does next stays off the Simple dashboard.
6. **Steps, not sweeps.** Display motion is counted in frames of the 23.5 Hz panel and changes small areas in discrete steps. The web transitions fill and transform only. The Motion section has the budgets.

## Voice and content

- Sentence case wherever a person reads a sentence: "Hot before your first coffee." UPPERCASE only in the mono micro styles: `eyebrow`, `chip`, `button`, `screen-label`, `screen-button`.
- Verbs on buttons, nouns on navigation, one or two words each: START, STOP, SAVE, TARE; Dashboard, Profiles, History, Settings.
- No emoji and no exclamation marks. Say "you" to the person; say "the machine", "the boiler", "the scale" about the hardware.
- A large reading carries its unit as a small mono label beside or under it (`unit`, `screen-label`): 9.0 BAR, 93 °C. Small text writes `93°`, `9.0 bar`, `36 g`, `2.1 ml/s`, `28 s`. Shot time is `m:ss`.
- A missing value is `—` on the web. On the display the element is hidden instead.
- Status is a word, never colour alone. Every Chip tone carries its word, every mode has a label, and the label under a reading names what the ring beside it measures.

## Color

- **Surfaces.** `surface-0` is the page and the display's face. `surface-1` is every tile, the sidebar and the mode bar. `surface-2` is whatever sits inside a tile: inputs, cells, stepper discs, the segmented track. A tile never holds a tile; nest with a cell.
- **Ink.** `ink` for text, icons and numerals; `ink-muted` for eyebrows, units, help and inactive items; `ink-faint` only for disabled text, placeholders and the greyed standby ring. `ink` is also the selection fill, with `on-ink` on top.
- **Primary.** `primary` fills the ActionBanner, the primary Button, the display's START pill and the pressure ticks. One primary fill per view. Use `primary-text` when cobalt is text or a thin line: links, chart lines, the focus ring. Text on a primary fill is `on-primary`.
- **Heat.** `heat` for temperature ticks, the temperature series and the heater meter. `heat-text` for words (HEATING TO 93°). `heat-soft` behind `heat-text` and as the dim phase of the heating pulse.
- **Status.** `success`, `warning`, `danger`, each with a `-soft` ground, in Chips and warning rows only. They never colour a numeral or a tile on their own.
- **Series.** `series-pressure`, `series-temperature`, `series-flow`, `series-weight` for chart lines and legend dots. They are aliases, so the charts follow the palette.
- **Tinted tiles.** A tile takes `heat-soft` only while its boiler is heating, and `primary-soft` only when it is the selected profile. Every other tile is `surface-1`.
- **Themes.** Light and Dark are the web's themes, and System follows the OS. The display uses `amoled` (Display black) on every panel, because a black ground hides the round bezel; Light remains a setting. In Dark, never put a `primary` fill on `surface-2`: the pair is 2.6:1.

## Typography

Two families, both variable, both under `fonts/` (SIL OFL 1.1, text in `licenses/OFL.txt`): **Funnel Display** for words and large numerals, **Geist Mono** for uppercase labels, units, chips, buttons and small data.

- Always set numerals with tabular figures (`font-feature-settings: "tnum"`), so a changing digit never moves its neighbours and never widens the area the display redraws.
- Interface: `title` 28 for the one page title, `heading` 20, `subheading` 16 for tile titles, `body` 15, `body-sm` 13 for help, `label` 13 for form labels, `caption` 12.
- Labels and data: `eyebrow` 12 above every reading, `button` 13, `chip` 11, `unit` 12, `metric-sm` 15 for a target after a reading, `data` 13 for facts in a row.
- Numerals: `metric-xl` 64 in the Dial, `metric-lg` 40 in a StatTile, `metric` 24 in steppers and cells.
- Round display: `screen-hero` 120, `screen-hero-sm` 96 between minus and plus, `screen-value` 44, `screen-title` 28, `screen-body` 22, `screen-label` 20, `screen-button` 22. Nothing on the display is smaller than 20 px.
- Weights: 400 for copy, 500 for numerals and labels, 600 for headings and buttons. 700 appears once: the name of the stage that is running.
- The wordmark is a file (Assets, Logos). Never set it as live text.

## Shape and layout

- **Radii.** `radius-xl` for tiles and the ActionBanner, `radius-lg` for cells, `radius-md` for inputs and nav items, `radius-sm` for chips, `radius-pill` for everything you press. A nested corner is the outer radius minus the padding between them.
- **Bento grid.** Tiles pad `space-5`. Gaps are `space-2` on phones and `space-3` on desktop. Tiles span whole columns and align on every edge; a tile grows to fill its row rather than leaving a ragged edge.
- **Borders.** A `hairline` in `line` between list rows and around a resting input. `line-strong` when the border is the control (the outline Button, an unchecked switch).
- **Touch.** `touch-min` 44 px on the web. `display-touch` 56 px on the display, where minus and plus are 60 px discs and the action pill is `display-action` 64 px tall.

## Iconography

- One stroke set of 53 glyphs: a 24 unit grid, 1.6 stroke, round caps and joins, drawn in `currentColor`. The paths are the ones in `web/src/design/outlinePaths.js`; the bundle carries them as `BetterMate.icon(name)` and the Icon card shows them all.
- Sizes: `icon` 24 px on the web, 18 to 22 px inside a small Button and the mode bar. On the display 36 px in mode discs, 28 px in small discs and at 12 o'clock.
- Meanings are fixed: `power` standby, `coffee` brew, `wind` steam, `droplet` water and flush, `bean` grind, `scale` tare, `triangle-alert` warning, `play` and `stop` on the ActionBanner's disc.
- An icon in navigation always has its word beside or under it. The exceptions are minus, plus, the chevrons and the power disc at the centre of the display's mode menu.
- No emoji, no filled glyphs, no second icon set.

## Motion

- Display: count frames, not milliseconds (`frame-tick` 1, `frame-micro` 3, `frame-state` 5, `frame-page` 8, `frame-sweep` 12). Light ticks one at a time, snap digits, step text in by recolour, and change screens with a cut that settles over three frames. Never animate opacity, scale or position of anything larger than an icon.
- Web: `duration-fast` for fills, presses and anything leaving, `duration-base` for things entering, both on `ease-out` or `ease-in`. Transition colour, opacity and transform only. Numbers snap.
- Honour `prefers-reduced-motion` on the web by removing every transition.

## States and accessibility

- **Focus.** A 2 px `focus` ring, 2 px outside the control, on every surface.
- **Selected.** An `ink` fill with `on-ink`. Never a cobalt fill, never a border plus a fill.
- **Hover.** The fill moves one step (`primary` to `primary-hover`). Nothing moves or grows.
- **Disabled.** On the web the whole control takes `disabled` opacity. On the display a control that cannot be used is hidden.
- **Contrast.** Text holds 4.5:1 on each ground its token names, and marks that carry meaning hold 3:1, in all three themes. `ink-faint` is 3.5:1 and is never body copy. Unlit ticks in `track` are decorative; the lit ticks, the numeral and the label carry the value.

## Using this system

Load `tokens.css`, then `components/bundle.css` and `components/bundle.js`. The bundle needs no framework. `window.BetterMate` gives `icon(name, size)`, `ring({left, right, full})` for the tick ring as SVG, `face({s: 'brew', ...})` for a whole display screen, `segbar(on, total, target)` and `hydrate(root)`, which fills `data-icon`, `data-segbar`, `data-dots`, `data-ring` and `data-face` hooks. The web app applies the same `bm-*` class recipes from `bundle.css` to its Preact components. Token names continue the previous system, so `scripts/design/gen_web_assets.py` and `gen_display_assets.py` keep their inputs; `on-ink`, `primary-text` and `track` are new. Read Round display before touching LVGL, Web UI before touching `web/`, and Motion before animating anything.
