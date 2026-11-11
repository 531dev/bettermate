The ring of ticks on the rim of the display, and around the web Dial: lit ticks are the value, a longer ink tick is the target.

- Use the split ring when temperature and pressure both matter (Brew, Shot), the single ring for one quantity (Steam, Water, Grind, Standby).
- Scales are fixed at 0 to 160 °C and 0 to 16 bar. Do not rescale to make the ring look fuller.
- Tones: `heat` temperature, `primary` pressure, `ink` progress, `ink-faint` standby. Unlit ticks are `track`.
- The notch marks a target; leave it out for progress and standby.
- Never replace ticks with a continuous arc, round the ring off with end caps, or add numerals along it.

`BetterMate.ring({left: [value, target, tone], right: [...]})` or `{full: [...]}` returns the SVG; values and targets are fractions from 0 to 1, and a target of -1 means none. `BetterMate.geometry` exposes the angles and counts for LVGL and Preact ports.
