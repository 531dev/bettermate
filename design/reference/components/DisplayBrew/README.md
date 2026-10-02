# Display · Brew

The round display's working screen (BrewScreen in `eez-ui/gaggimate.eez-project`, LVGL 8.4, 480 × 480 circular): two tick rings on the rim, one hero number in the middle, one button at the bottom. Steam, Water and Grind screens are this screen with a different hero reading and ring.

- Rings: temperature on the LEFT in `heat`, pressure on the RIGHT in `primary`, each a 140° arc of `gauge-stroke` (12 px) round-capped ticks (dash 6, gap 8 — the Meter's bars bent around the rim) over a `line` track, growing upward from the bottom. While the boiler is heating the left ring pulses between `heat` and `heat-soft` at 1 Hz; nothing else animates.
- Top: the mode name as `screen-label` (BREW) over the profile name in `screen-title`. Bottom: the one action as a 72 px `primary` disc with the `play` / `stop` glyph at 48 px — 2×, never between (`on-primary`); Steam's disc is `heat` with `on-heat`.
- Center: a `screen-label` eyebrow, the hero reading in `screen-metric` (the shot timer while brewing, the temperature while idle), then the current / target pairs in `screen-metric-sm` — current in `ink`, target and unit in `ink-muted`, the eyebrow in that quantity's color.
- Everything but the rings stays inside `display-content` (400 px); multi-line text inside `display-square` (300 px). Touch targets are 56 px or larger.
- Themes: Light and Dark share the web tokens; AMOLED is the dark theme on `#000000` for the CO5300 panel. LVGL colors are the token hex values; fonts are Space Grotesk 18/24 and JetBrains Mono 14/28/64 converted at bpp 4; icons are the pixel glyphs at 24 (1×) and 48 px (2×), nearest-neighbour.

The markup here is a static rendition of the LVGL layout, drawn with the same tokens.
