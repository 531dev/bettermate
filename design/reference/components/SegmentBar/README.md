A quantity as a row of discrete segments: lit in a tone, unlit in `track`, with an optional target mark.

- 20 segments for a level or a reading against a fixed scale; 24 inside an ActionBanner.
- `data-segbar="on/total/target"` with `BetterMate.hydrate()`, or `BetterMate.segbar(on, total, target)`.
- Tone classes: `bm-segbar--heat`, `--primary`, `--flow`, `--weight`; none for `ink`.
- The target mark is a short `ink` bar above one segment. Use it only when the reading has a set point.
- `bm-dots` is the same idea as a grid, for counts: shots this week, days of a schedule.
- Never use a continuous progress bar or a gradient scale anywhere in the product.
