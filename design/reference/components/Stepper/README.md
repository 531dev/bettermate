Minus, a value, plus: for a number changed in small steps, such as a target temperature or a grind weight.

- The value is `metric` with its unit attached (`93°`, `18.0 g`) and a fixed minimum width, so the buttons never move.
- Discs are 44 px, `surface-2` on a tile and `surface-1` inside a cell (`bm-stepper--on-cell`).
- One press is one step. Holding repeats after 400 ms. The value snaps; it does not count up.
- At a limit, disable that disc rather than hiding it.
