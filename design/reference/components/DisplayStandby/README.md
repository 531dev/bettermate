# Display · Standby

The screen the machine shows when it is off (StandbyScreen): connectivity at the top, the clock as the hero reading, the wordmark, and a tap hint at the bottom. It is deliberately the emptiest screen in the product — the rim is bare because no ring has anything to report.

- Status row at the top (`space-6` from the rim): the `wifi`, `bluetooth` and `refresh-cw` glyphs at 24 px (1×), `ink` when connected or in progress and `ink-muted` when not. Warnings (water low, scale lost) replace the row with one `warning` Badge.
- Clock in `screen-metric` (mono, 64 px) with the date above it as `screen-label`; the wordmark asset `bettermate-wordmark-display.png` (480 × 65, shown 32 px tall) below in `ink` — the inverse file in Dark and AMOLED. Never set the name in a font.
- A neutral Badge under the mark reports STANDBY and the boiler temperature so a warm machine is obvious at a glance.
- The tap hint is the `hand` glyph (24 px, 1×) plus TAP TO WAKE in `screen-label`, `space-10` from the bottom; on machines with auto-wake it reads the next wake time instead.
- AMOLED: true-black ground and, after 30 s, the clock alone to spare the panel.

The markup here is a static rendition of the LVGL layout, drawn with the same tokens.
