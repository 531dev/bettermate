BetterMate turns a Gaggia espresso machine into a precise, connected one. Its interface is an instrument, not a dashboard of widgets: quiet grey surfaces, black or white ink, numbers in a monospaced face that never jump, pixel icons that sit on the same grid as those numbers, and exactly two hues — a cobalt **primary** for what you can do and what the pump does, and a **heat** orange for what the boiler does. The same system dresses the web UI (Preact, Tailwind 4, DaisyUI 5) and the 480 px round LVGL display on the machine.

## Principles

1. **Surfaces make depth; shadows don't.** Three neutral steps (`surface-0` page → `surface-1` card → `surface-2` tile) are the whole elevation model. `shadow-none` is the only shadow token, and it is applied to every DaisyUI card, dropdown and modal to remove library defaults. Where two equal surfaces meet, draw a `line` hairline.
2. **One accent, two meanings.** `primary` marks the action you can take and the pressure the pump makes; `heat` marks temperature and heating. Nothing else is colored except status words and chart series.
3. **Numbers are the interface.** Every live reading is set in the `Data` mono styles with tabular figures, its unit smaller and muted, its target after a slash. Words are Space Grotesk, sentence case.
4. **Controls are pills, containers are rounded.** Anything you press (`Button`, `ModeSwitch`, `Switch`) is `radius-pill`; anything that holds content steps down `radius-lg` → `radius-md` → `radius-sm` as it nests.
5. **Both themes are first-class.** Light and Dark are tuned pair by pair (every text token holds 4.5:1 on every surface in both); AMOLED is Dark on true black for the display panel. A theme never introduces a color the other lacks.

## Voice and content

- Sentence case everywhere a person reads a sentence: "Machine is ready — wake up to use", "Boiler set point for brew mode." Title case nowhere.
- UPPERCASE only in the two micro styles that carry it: `eyebrow` (mono, above a reading or card — PRESSURE, QUICK SELECT) and `button` (BREW NOW, SAVE). Never uppercase a title or a status sentence.
- Units are always shown, always spaced, always SI: `93 °C`, `9.0 bar`, `36 g`, `2.1 ml/s`, `28 s`. Time as `mm:ss`. A missing value is `—`, never `0` or "N/A".
- Verbs on buttons, nouns on nav items and tabs, one or two words each. "Brew now", not "Start brewing process".
- Status is a word in a Badge (READY, HEATING, BREWING, WATER LOW) plus, when needed, one sentence in the card footer. No exclamation marks, no emoji anywhere in the product, including the sidebar footer.
- Speak to the person as "you" and about the hardware as "the machine", "the boiler", "the scale".

## Color

The palette is the tokens under Colors; every value below is named there with the grounds it reads on.

- **Surfaces.** `surface-0` is the page and the well inside a card (the ModeSwitch track, chips); `surface-1` is every card, panel and the sidebar; `surface-2` is a tile, an input, a quick-select card. Never skip a step (no `surface-2` directly on `surface-0`), and never put a card on a card.
- **Ink.** `ink` for text and icons; `ink-muted` for eyebrows, units, help text, inactive nav and tabs; `ink-faint` only for disabled text and decorative glyphs (it holds 3:1, not 4.5:1). Text never takes a color from a fill — on `primary` use `on-primary`, on `heat` use `on-heat`, on `danger` use `on-danger`.
- **Primary** (`primary`, `primary-hover`, `primary-soft`, `on-primary`): the primary Button, the active ModeSwitch segment, the current Nav item (`primary` on `primary-soft`), the Tabs underline, links, the focus ring, the selected ProfileCard's border and the pressure series. One primary button per view.
- **Heat** (`heat`, `heat-text`, `heat-soft`, `on-heat`): the temperature series, the heating ring on the display, the Steam segment when active, the HEATING badge (`heat-text` on `heat-soft`). Use `heat` for marks and fills, `heat-text` for words — the mark shade is too light to read as small text on light surfaces.
- **Series** (`series-pressure`, `series-flow`, `series-temperature`, `series-weight` and the `flow` / `weight` pairs): chart lines, the dot on a MetricTile, the chip color on a shot row. They are aliases, so re-theming the brand re-themes the charts.
- **Status** (`success`, `warning`, `danger`, each with `-soft`): badges and inline messages only. Status never colors a number, a card or a border on its own — a word or icon always accompanies it.
- **Dark.** The dark theme lightens `primary` and `heat`, so `on-primary` and `on-heat` become dark ink there; read the token, never hard-code white on a fill.

## Typography

Two families, both variable and bundled under `fonts/`: **Space Grotesk** (`font-sans`) for everything read as words, **JetBrains Mono** (`font-mono`) for every number that changes and the uppercase eyebrow above it.

- Interface: `title` (28/34, 700) for the one page title; `heading` (20/26, 600) for card titles and the selected profile; `subheading` (16/22, 600) for sections inside a card; `body` (15/22) for copy, labels and nav; `body-sm` (13/18) for descriptions and help; `label` (12/16, 500) for form labels; `caption` (12/16) for timestamps; `button` (13/16, 600, +0.08em, uppercase).
- Data: `metric-xl` (56) for one hero reading per screen, `metric-lg` (32), `metric` (20) for tiles, `metric-sm` (15) for targets, `data` (13) for tables and axis ticks, `eyebrow` (11, +0.1em, uppercase) for the label above a reading. Always `font-variant-numeric: tabular-nums`.
- Round display: `screen-metric` (64 mono), `screen-metric-sm` (28 mono), `screen-title` (24), `screen-body` (18), `screen-label` (14 mono, uppercase) — converted to LVGL bitmap fonts at those pixel sizes.
- Weights: 400 for copy, 500 for nav, labels and all mono, 600 for headings and buttons, 700 for the page title only. Nothing lighter than 400, nothing heavier than 700.
- Measure: body copy no wider than 64 characters; help text wraps under its field, never beside it.
- The wordmark is the asset `bettermate-wordmark.svg` (see Assets → Logos): "Better" at 600 and "Mate" at 400 in Space Grotesk, tracked −0.02em, set once as outlines. Use the file, never live text, so the two weights and the spacing never drift.

## Spacing and layout

- A 4 px grid: `space-1` … `space-16`. Inside a card use 4/8/12/16 (`space-1` … `space-4`); between cards `space-4` on phones and `space-6` on desktop; page gutters the same.
- Desktop: a `sidebar` (272 px) of `surface-1` at the left, then the page at up to `content-max` (1440 px) with `space-6` gutters. The dashboard is a two-column grid (controls 5/12, chart 7/12) that stacks below 1024 px.
- Cards pad `space-5` on desktop and `space-4` on phones. Tile grids use `space-2` gaps; the last row stretches to fill.
- Phone: a single column, the sidebar becomes a `scrim`-backed sheet, the primary action sits in a sticky footer as a `lg` block Button.
- Alignment is left; only a card's footer status line and the round display are centered.

## Shape, borders and depth

- Radii: `radius-sm` chips and tooltips; `radius-md` inputs, tiles, nav items, quick-select cards; `radius-lg` cards, panels, modals; `radius-xl` the dashboard's main panel on desktop; `radius-pill` every button, the ModeSwitch, toggles and the display's arc caps.
- Borders: `hairline` (1 px) in `line` for dividers and resting inputs — decorative; `line-strong` when a border carries meaning (secondary button, checked toggle track, hovered ProfileCard); `ring` (2 px) in `primary` for a selection and in `focus` for keyboard focus.
- Depth: there is none beyond the three surface steps. No `box-shadow`, no blur, no glass, no gradient — remove `--app-card-shadow`, `app-glass-surface-*` and every `shadow-*` utility from the app. A modal is a `surface-1` panel over `scrim`.

## Iconography

- One pixel set for both surfaces: **Pixelarticons** (MIT) — a 24 × 24 unit grid, one pixel per unit, 2-unit strokes, square corners, no anti-aliasing — plus five glyphs drawn on the same grid where the set has no equivalent (`droplet`, `bean`, `scale`, `bluetooth`, `stop`). Every glyph is normalized to whole unit pixels and centered on the box: its bounding box sits on (12, 12) to within half a unit, and the ones whose subject is symmetric (power, plus, chevrons, droplet, wifi, house…) mirror exactly. All 46 are under Assets → Icons and inlined in `components/bundle.js` (`BetterMate.icon('name')`). They replace Font Awesome on the web and the Flaticon Uicons bitmaps on the display.
- Render only at whole-pixel scales of the grid: `icon-1x` 24 px everywhere on the web and in the display's status row, `icon-2x` 48 px for the display's action disc and mode picker, `icon-3x` 72 px for its wake-up and warning screens. Set `shape-rendering: crispEdges` on the inline SVG (the bundle does) and never let CSS scale an icon to 12, 16, 20, 32, 36 or 40 px — a fractional scale splits pixels and betrays the whole idea. Chips and badges therefore carry a 24 px glyph or none, never a shrunken one.
- Icons are filled shapes in `currentColor`; the files under assets are drawn in `#767676` only so they preview on both grounds. For LVGL, export each at 24, 48 or 72 px with nearest-neighbour scaling (no smoothing) and recolor to `ink`.
- Meaning is fixed: `power` standby, `coffee` brew, `wind` steam, `droplet` water, `bean` grind; `thermometer` temperature, `gauge` pressure, `waves` flow, `scale` weight, `timer` time, `flame` heating; `house` `list` `history` `search` `chart-column` `settings` for the six pages; `play` / `stop` for the display's action disc.
- The pixel grid is the icons' domain only: type stays anti-aliased Space Grotesk and JetBrains Mono, and surfaces stay smooth. No emoji anywhere. The upstream GaggiMate marks (Assets → Upstream marks) are kept for reference and are not used in BetterMate.

## Motion

- 150 ms `ease-out` for color and fill changes on hover, press and selection; 200 ms for a sheet or dropdown entering (opacity + 4 px translate), 120 ms leaving. Nothing bounces, scales or blurs.
- Live numbers update in place with no transition; charts animate only on first paint.
- On the display, the only animation is the heating ring's 1 Hz pulse between `heat` and `heat-soft` while the boiler is below target.
- Honor `prefers-reduced-motion`: all transitions to 0 ms.

## States and accessibility

- Hover: fill changes one step (`surface-2` → `surface-1`, `primary` → `primary-hover`); nothing moves.
- Focus: the `focus` ring, `ring` wide, 2 px outside the control, on every surface — one ring for the whole product.
- Selected: a `primary` border (`ring`) or a `primary` fill; never both, never a check mark added to a fill.
- Disabled: `opacity: disabled` on the whole control; keep the text ink so the value stays readable.
- Contrast: every text token reads 4.5:1+ on every surface in Light and Dark (and AMOLED); marks that carry meaning (`heat`, `line-strong`, series colors, the focus ring) 3:1+. Series differ in lightness as well as hue and are always named in a legend. Hit areas: `touch-min` 44 px on the web, 56 px on the display.

## Using this system

Load `tokens.css` (the page compiles it from `tokens.json`; the first theme is the fallback, `data-theme="dark"` / `"amoled"` select the others), then `components/bundle.css` and `components/bundle.js`. The bundle needs no framework: `window.BetterMate` exposes `Button`, `ModeSwitch`, `MetricTile`, `Meter`, `Chip`, `Badge`, `Card`, `ProfileCard`, `Nav`, `Tabs`, `Field`, `Switch`, plus `icon(name)` and `el(tag, class, attrs, children)`. Each factory takes the props its README lists and returns an element; the Preact app instead applies the same class recipes (`bm-btn`, `bm-metric`, …) — the "Web UI mapping" section says how. Fonts: the two variable woff2 files under `fonts/`, licensed OFL 1.1; icons under `assets/Icons/`, MIT.
