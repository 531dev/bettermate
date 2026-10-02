# Round display

The machine's screen is a 480 × 480 circular panel (LilyGo T-RGB, Waveshare, or the CO5300 AMOLED) driven by LVGL 8.4 from `eez-ui/gaggimate.eez-project`. It is read from arm's length in a kitchen, often with a wet hand, so it gets the fewest elements and the biggest numbers in the product.

## Anatomy of a screen

- **Rim** (480 → 400 px): the two tick rings only. Temperature on the left in `heat`, pressure on the right in `primary`, 140° arcs of `gauge-stroke` (12 px) round-capped ticks (LVGL arc with `arc_rounded`, or an `lv_line` per tick at a 4 px dash / 18 px pitch) over a `line` track, both growing upward from the bottom. Steam and Water screens show one ring; Standby shows none.
- **Content circle** (`display-content`, 400 px): the mode name (`screen-label`) over the profile name (`screen-title`) at the top; the hero reading in the middle; the one action at the bottom.
- **Text square** (`display-square`, 300 px): any text longer than one word stays inside it, so nothing is cut by the curve.
- **Hero**: one `screen-metric` (64 px mono) per screen — the shot timer while brewing, the temperature while idle or steaming, the volume while pulling water. Its `screen-label` eyebrow sits 4 px above.
- **Pairs**: current in `screen-metric-sm` (28 px mono, `ink`), target and unit on the next line in `screen-label` (`ink-muted`), the eyebrow in that quantity's color (`heat-text` / `primary`), 40 px (`space-10`) apart.
- **Action**: a 72 px `primary` disc with the `play` or `stop` glyph in `on-primary`, `space-8` above the rim; Steam's disc is `heat` with `on-heat`. Secondary actions (profile picker, settings) are 56 px `surface-2` discs with an `ink` glyph at the 4 and 8 o'clock positions.
- **Status**: connectivity glyphs (`wifi`, `bluetooth`, `refresh-cw`) at 24 px (1×), `space-6` from the top; a warning replaces them with one `warning` Badge.

## Themes on the display

Three LVGL themes, with the token hex values as the EEZ theme colors:

| EEZ color | Light | Dark | AMOLED | Token |
| --- | --- | --- | --- | --- |
| NiceWhite (text) | `#111111` | `#f2f2f2` | `#f2f2f2` | `ink` |
| Dark (screen) | `#e9e9e9` | `#0e0e0e` | `#000000` | `surface-0` |
| SemiDark (muted) | `#5b5b5b` | `#a6a6a6` | `#a6a6a6` | `ink-muted` |
| Ticks (track) | `#d4d4d4` | `#343434` | `#2e2e2e` | `line` |
| Progress / Pressure | `#2a3bea` | `#7b88ff` | `#7b88ff` | `primary` |
| Heating / Temperature | `#e8440a` | `#ff7a45` | `#ff7a45` | `heat` |
| Warning | `#8a5a00` | `#f5b400` | `#f5b400` | `warning` |

Cards on the display (the profile picker rows, the status card) are `surface-1` with `radius-xl` (24 px) — LVGL `radius` 24 — and no border. `Progress` (the old mint green `#1ffba3`) is retired: progress is `primary`.

## Fonts on the display

Convert with the LVGL font converter (bpp 4, range 0x20–0x7F plus `°` 0xB0, `–` 0x2013, `—` 0x2014, `·` 0xB7): Space Grotesk 500 at 18 and 24 px (`screen-body`, `screen-title`), JetBrains Mono 500 at 14, 28 and 64 px (`screen-label`, `screen-metric-sm`, `screen-metric`). Enable only those in `lv_conf.h` and set `LV_FONT_DEFAULT` to the 18 px sans; the Montserrat built-ins go. The wordmark is `assets/Logos/bettermate-wordmark-display.png` (480 × 65, ink `#111111`; the `-inverse` file for Dark and AMOLED, or recolor with `lv_obj_set_style_img_recolor`).

## Icons on the display

Export the pixel glyphs from `assets/Icons/` at 24 px (status row, chips), 48 px (the action disc, the mode picker) or 72 px (wake-up and warning screens) with nearest-neighbour scaling — never a smoothing resampler — as 1-bit or A4 bitmaps, and recolor to `ink`, `primary` or `heat` per theme. The set is a 24-unit grid at one pixel per unit, so those are exact 1×, 2× and 3× scales; 20, 30 or 40 px (the old Uicons sizes) would split pixels. Every glyph is centered on its box, so a 24 px icon can be placed by its box, not by eye.

## Touch and motion

- Every tappable element is at least 56 px; the whole hero area toggles the mode picker; a swipe left/right changes screens.
- The heating ring pulses `heat` ↔ `heat-soft` at 1 Hz until the boiler reaches target; nothing else animates. Display bandwidth, not CPU, limits animation on this panel — keep redraws to the changed label or arc segment.
- AMOLED: after 30 s of Standby, only the clock stays lit and it drifts 2 px every minute.
