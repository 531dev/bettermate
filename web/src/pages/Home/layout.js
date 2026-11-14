// Where each tile sits on the desktop grid (design/reference/web-ui.md, Dashboard). The Dial
// tile is 5 columns wide, and the 7 columns beside it are 4 + 3: the ActionBanner and the Setup
// tile on the left, readings on the right.
//
//   up to two readings    two rows. A row is a lead tile and a reading, or one tile across all 7.
//   three or four         the readings are a column of their own, one to a row, and the banner
//                         and Setup share those rows. Simple never has more than four.
//   more (Advanced)       two beside the dial as above; the rest follow in rows that share the
//                         12 columns evenly.
//
// Then the profile curve (12), and the chart (7) beside the recent shots (5). A tile grows to
// fill its row; nothing leaves a ragged edge, and no reading is stretched across the page.
//
// Below 1024px none of this applies: the tiles follow their order in the page.

// The classes are written out whole, so Tailwind's scanner finds them.
const BESIDE = {
  left: 'lg:col-span-4',
  right: 'lg:col-span-3',
  alone: 'lg:col-span-7',
};
// The tiles beside the dial are placed row by row, in this order.
const ORDER = [
  'lg:order-2',
  'lg:order-3',
  'lg:order-4',
  'lg:order-5',
  'lg:order-6',
  'lg:order-7',
  'lg:order-8',
];
const ROWS = ['', '', 'lg:row-span-2', 'lg:row-span-3', 'lg:row-span-4'];
const LEAD_COLUMN = 'lg:col-start-6 lg:col-span-4';
const READING_COLUMN = 'lg:col-start-10 lg:col-span-3';
const SHARE = {
  1: 'lg:order-9 lg:col-span-12',
  2: 'lg:order-9 lg:col-span-6',
  3: 'lg:order-9 lg:col-span-4',
  4: 'lg:order-9 lg:col-span-3',
};
const DIAL = 'lg:order-1 lg:col-span-5';
const DIAL_ALONE = 'lg:order-1 lg:col-span-12';
const RECENT = {
  besideDial: 'lg:col-span-7',
  besideChart: 'lg:order-12 lg:col-span-5',
  alone: 'lg:order-12 lg:col-span-12',
};

export const CURVE = 'lg:order-10 lg:col-span-12';
export const CHART = 'lg:order-11 lg:col-span-7';

const join = (...classes) => classes.filter(Boolean).join(' ');

// Three or four readings in a column, the lead tiles sharing its rows: with two of them the
// banner takes the first row of three, or the first two of four, and Setup the rest.
function column(lead, stats, hasChart) {
  const placed = { dial: join(DIAL, ROWS[stats]), action: '', setup: '', stats: [] };
  const spans = lead.length === 1 ? [stats] : [stats - 2, 2];
  const starts = [0, spans[0]];
  let next = 0;
  for (let row = 0; row < stats; row++) {
    const at = starts.indexOf(row);
    if (at >= 0 && at < lead.length) {
      placed[lead[at]] = join(ORDER[next++], LEAD_COLUMN, ROWS[spans[at]]);
    }
    placed.stats[row] = join(ORDER[next++], READING_COLUMN);
  }
  placed.recent = hasChart ? RECENT.besideChart : RECENT.alone;
  return placed;
}

/**
 * Places the ActionBanner, the Setup tile, `stats` readings and the recent shots.
 * Returns the classes of { dial, action, setup, stats: [one per reading], recent }.
 */
export function place({ hasAction, hasSetup, stats, hasChart }) {
  // The banner and Setup take the left of a row each, in that order; readings fill what is left.
  const lead = [hasAction && 'action', hasSetup && 'setup'].filter(Boolean);
  if (lead.length > 0 && (stats === 3 || stats === 4)) return column(lead, stats, hasChart);

  const placed = { dial: DIAL_ALONE, action: '', setup: '', stats: [], recent: '' };

  const waiting = Array.from({ length: stats }, (_, i) => i);
  const take = () => (waiting.length ? waiting.shift() : null);
  const rows = [0, 1].map(row => {
    const left = lead[row] ?? take();
    return [left, left == null ? null : take()].filter(tile => tile != null);
  });
  // A second row with nothing in it goes to the recent shots, unless they sit beside the chart.
  const recentBesideDial = rows[0].length > 0 && rows[1].length === 0 && !hasChart;

  let next = 0;
  rows.forEach(row => {
    row.forEach((tile, i) => {
      const classes = join(
        ORDER[next++],
        row.length === 1 ? BESIDE.alone : i === 0 ? BESIDE.left : BESIDE.right,
        // One row beside the dial, and the chart under it: the row is as tall as the dial.
        rows[1].length === 0 && !recentBesideDial && ROWS[2],
      );
      if (typeof tile === 'number') placed.stats[tile] = classes;
      else placed[tile] = classes;
    });
  });
  if (rows[0].length) placed.dial = join(DIAL, ROWS[2]);
  placed.recent = recentBesideDial
    ? join(ORDER[next], RECENT.besideDial)
    : hasChart
      ? RECENT.besideChart
      : RECENT.alone;

  // The rest: rows of at most four, as even as they come, each sharing the 12 columns.
  const count = Math.ceil(waiting.length / 4);
  for (let r = 0; r < count; r++) {
    const size = Math.ceil(waiting.length / (count - r));
    for (const tile of waiting.splice(0, size)) placed.stats[tile] = SHARE[size];
  }
  return placed;
}
