// Where each tile sits on the desktop grid (design/reference/web-ui.md, Dashboard): the Dial
// tile is 5 columns by 2 rows, and the 7 columns beside it hold two rows. A row is 4 + 3 columns
// (the ActionBanner or Setup, then a reading) or one tile across all 7. Readings that find no
// place there follow in rows that share the 12 columns evenly, then the chart (7) beside the
// recent shots (5). A tile grows to fill its row; nothing leaves a ragged edge.
//
// Below 1024px none of this applies: the tiles follow their order in the page.

// The classes are written out whole, so Tailwind's scanner finds them.
const BESIDE = {
  left: 'lg:col-span-4',
  right: 'lg:col-span-3',
  alone: 'lg:col-span-7',
};
const BESIDE_ORDER = [
  ['lg:order-2', 'lg:order-3'],
  ['lg:order-4', 'lg:order-5'],
];
const SHARE = {
  1: 'lg:order-6 lg:col-span-12',
  2: 'lg:order-6 lg:col-span-6',
  3: 'lg:order-6 lg:col-span-4',
  4: 'lg:order-6 lg:col-span-3',
};
const DIAL = 'lg:order-1 lg:col-span-5 lg:row-span-2';
const DIAL_ALONE = 'lg:order-1 lg:col-span-12';
const RECENT = {
  besideDial: 'lg:order-4 lg:col-span-7',
  besideChart: 'lg:order-9 lg:col-span-5',
  alone: 'lg:order-9 lg:col-span-12',
};

export const CURVE = 'lg:order-7 lg:col-span-12';
export const CHART = 'lg:order-8 lg:col-span-7';

/**
 * Places the ActionBanner, the Setup tile, `stats` readings and the recent shots.
 * Returns the classes of { dial, action, setup, stats: [one per reading], recent }.
 */
export function place({ hasAction, hasSetup, stats, hasChart }) {
  const waiting = Array.from({ length: stats }, (_, i) => i);
  const take = () => (waiting.length ? waiting.shift() : null);
  // The banner and Setup take the left of a row each, in that order; readings fill what is left.
  const lead = [hasAction && 'action', hasSetup && 'setup'].filter(Boolean);
  const rows = [0, 1].map(row => {
    const left = lead[row] ?? take();
    return [left, left == null ? null : take()].filter(tile => tile != null);
  });
  // A second row with nothing in it goes to the recent shots, unless they sit beside the chart.
  const recentBesideDial = rows[0].length > 0 && rows[1].length === 0 && !hasChart;

  const placed = {
    dial: rows[0].length ? DIAL : DIAL_ALONE,
    action: '',
    setup: '',
    stats: [],
    recent: recentBesideDial ? RECENT.besideDial : hasChart ? RECENT.besideChart : RECENT.alone,
  };
  rows.forEach((row, r) => {
    row.forEach((tile, i) => {
      const classes = [
        BESIDE_ORDER[r][i],
        row.length === 1 ? BESIDE.alone : i === 0 ? BESIDE.left : BESIDE.right,
        // One row beside the dial, and the chart under it: the row is as tall as the dial.
        rows[1].length === 0 && !recentBesideDial && 'lg:row-span-2',
      ]
        .filter(Boolean)
        .join(' ');
      if (typeof tile === 'number') placed.stats[tile] = classes;
      else placed[tile] = classes;
    });
  });

  // The rest: rows of at most four, as even as they come, each sharing the 12 columns.
  const count = Math.ceil(waiting.length / 4);
  for (let r = 0; r < count; r++) {
    const size = Math.ceil(waiting.length / (count - r));
    for (const tile of waiting.splice(0, size)) placed.stats[tile] = SHARE[size];
  }
  return placed;
}
