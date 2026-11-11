A reading in a tile: mono label, large tabular numeral with a raised unit, and a segment bar.

- Order is fixed: `eyebrow`, numeral, bar. Add `/ target` after the numeral only when a target exists.
- Give the bar the series tone (`bm-segbar--heat`, `--primary`, `--flow`, `--weight`); a plain level uses `ink`.
- A tile turns `bm-tile--heat` only while that boiler is heating, and then carries a HEATING Chip.
- Group small results as `bm-stat--sm` in cells inside one tile rather than as many small tiles.
- Do not show a reading that is zero at rest in Simple view.

Markup: `.bm-tile > .bm-stat` with `.bm-eyebrow`, `.bm-stat__row` (`.bm-stat__value`, `.bm-stat__unit`, `.bm-stat__target`) and `.bm-segbar`.
