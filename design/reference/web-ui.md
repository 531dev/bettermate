# Web UI mapping

How the tokens land in `web/` (Preact 10, Tailwind 4, DaisyUI 5). Keep DaisyUI's component classes; replace its themes and its depth.

## Themes

Replace the four `@plugin "daisyui/theme"` blocks in `web/src/style.css` with two, `light` (default) and `dark` (`prefersdark: true`), and set `AVAILABLE_THEMES` in `utils/themeManager.js` and the allow-list in `index.html` to `['system', 'light', 'dark']`. Map the DaisyUI variables to the tokens:

| DaisyUI variable | Token |
| --- | --- |
| `--color-base-100` | `surface-1` (cards — DaisyUI's "100" is the card, so the page is set separately) |
| `--color-base-200` | `surface-0` |
| `--color-base-300` | `line` |
| `--color-base-content` | `ink` |
| `--color-primary` / `--color-primary-content` | `primary` / `on-primary` |
| `--color-secondary` / `-content` | `heat` / `on-heat` |
| `--color-accent` / `-content` | `flow` / `surface-2` |
| `--color-neutral` / `-content` | `ink` / `surface-0` (the solid Badge and tooltips) |
| `--color-info` / `-content` | `primary-soft` / `primary` |
| `--color-success` / `-content` | `success-soft` / `success` |
| `--color-warning` / `-content` | `warning-soft` / `warning` |
| `--color-error` / `-content` | `danger-soft` / `danger` |
| `--radius-selector` | `radius-pill` |
| `--radius-field` | `radius-md` |
| `--radius-box` | `radius-lg` |
| `--border` | `hairline` |
| `--depth`, `--noise` | `0` |

Set `body { background: var(--surface-0) }` (it is `bg-base-100` today) and give tiles `bg-[var(--surface-2)]` instead of `bg-base-200/60`. Keep the `--analyzer-*` and `--statistics-*` custom properties but point each at a token (`--analyzer-pressure-text: var(--series-pressure)`, `--analyzer-temp-text: var(--series-temperature)`, `--analyzer-flow-text: var(--series-flow)`, `--analyzer-weight-text: var(--series-weight)`, tooltip backgrounds to `surface-2` + `line`) so the analyzer follows the theme; delete `--app-card-shadow`, `--app-glass-surface-*`, `--statistics-summary-shadow` and every `shadow-*` class (`Card.jsx` carries `shadow-xl`, `ModeTab.jsx` `shadow-sm`, `style.css` `.app-card-surface` and `.profile-list-drag-selected-item`).

## Fonts

In `style.css` `@theme { --font-sans: "Space Grotesk", …; --font-mono: "JetBrains Mono", …; }`, add the two `@font-face` rules for `fonts/SpaceGrotesk-Variable.woff2` (300–700) and `fonts/JetBrainsMono-Variable.woff2` (100–800) served from `web/public/fonts/`, and drop `--font-logo` / the Tailwind `logo` family — the sidebar shows `bettermate-wordmark.svg` (inverse file in dark) as an `<img>`. Give every numeric element `font-mono tabular-nums`.

## Components

| App file | System recipe |
| --- | --- |
| `components/Card.jsx` (`card bg-base-100 shadow-xl`) | `bm-card`: `bg-base-100 rounded-2xl p-5 max-sm:p-4`, no shadow |
| `components/CardTitle.jsx` | `bm-eyebrow`: `font-mono text-[11px] tracking-[0.1em] uppercase text-base-content/70` (was `/55`, which fails 4.5:1) |
| `components/PageHeader.jsx` | `title` style: `text-[28px] leading-[34px] font-bold tracking-tight` |
| `components/TabBar.jsx` (`tabs tabs-border`) | `bm-tabs` / `bm-tab`: 44 px, `border-b-2 border-primary` when active |
| `components/Navigation.jsx` | `bm-nav__item`: 44 px rows, active `bg-info text-info-content`; wordmark `<img>`; NEW badge = solid Badge |
| `pages/Home/ModeTab.jsx`, `ModeCard.jsx` | `bm-seg` / `bm-seg__item`: well `bg-base-200`, active `bg-primary text-primary-content`, Steam active `bg-secondary text-secondary-content` |
| `pages/Home/cards/MetricsGrid.jsx` (`MetricCell`) | `bm-metric`: eyebrow + series dot, `metric` value, `/ target` in `ink-muted`, round `−`/`+` |
| `pages/Home/cards/FavoriteProfilesCard.jsx`, `ProfileList/…` | `bm-profile`: `border-2 border-transparent aria-pressed:border-primary`, chips |
| `components/SettingsFormField.jsx` (`input`, `toggle`) | `bm-field` / `bm-input` / `bm-toggle`: unit inside, help below, `focus-within:outline-2 outline-primary` |
| `components/ConfirmButton.jsx`, every `btn` | `bm-btn`: `rounded-full uppercase tracking-[0.08em] text-[13px] font-semibold`; `btn-primary` at most once per view |
| `components/Tooltip.jsx` (`.tooltip-portal`) | `bg-neutral text-neutral-content rounded-md` stays — it is the solid Badge's colors |
| `components/SkeletonBlock.jsx` (`.shimmer`) | keep, with `surface-1` → `surface-2` as the two stops |
| `components/Chart.jsx`, `ShotAnalyzer/…/chartTheme.js` | read `--series-*`, `--chart-grid`, `--ink-muted` from `getComputedStyle`; mono ticks |
| `pages/Home/index.jsx` status line | `bm-card__footer` |

Warning icons under `assets/warnings/` are replaced by the pixel glyphs `triangle-alert`, `droplet`, `bluetooth`, `thermometer`, `wifi` in a Badge of the matching tone. Every `<FontAwesomeIcon>` becomes an inline pixel SVG at exactly 24 px (`BetterMate.icon(name)`, or a Preact `Icon` component built from the same `assets/Icons` files) with `shape-rendering="crispEdges"` — never `h-4 w-4` or `size-5`; drop the three `@fortawesome/*` packages.
