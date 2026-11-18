// Where each tile sits on the desktop grid (design/reference/web-ui.md, Dashboard). The Dial
// tile is 5 columns wide, and the 7 columns beside it are 4 + 3: the ActionBanner and the Setup
// tile on the left, readings on the right.
//
//   up to two readings    two rows. A row is a lead tile and a reading, or one tile across all 7.
//   three or four         the readings are a column of their own, one to a row, and the banner
//                         and Setup share those rows. Simple never has more than four.
//   more (Advanced)       two beside the dial as above; the rest follow in rows that share the
//                         12 columns evenly. An empty tile (no scale) comes last, on a row of
//                         its own: it is taller than a reading, and would stretch its neighbours.
//
// Then the profile curve (12), and the chart (7) beside the recent shots (5). A tile grows to
// fill its row; nothing leaves a ragged edge, and no reading is stretched across the page.
//
// This takes a window of 1200px (75rem): beside the sidebar, 4 columns of a narrower one do not
// hold a label and its Stepper. Below that the tiles follow their order in the page, each a
// full row with the readings two to a row, as on a tablet.

// The classes are written out whole, so Tailwind's scanner finds them.
const BESIDE = {
  left: 'min-[75rem]:col-span-4',
  right: 'min-[75rem]:col-span-3',
  alone: 'min-[75rem]:col-span-7',
};
// The tiles beside the dial are placed row by row, in this order.
const ORDER = [
  'min-[75rem]:order-2',
  'min-[75rem]:order-3',
  'min-[75rem]:order-4',
  'min-[75rem]:order-5',
  'min-[75rem]:order-6',
  'min-[75rem]:order-7',
  'min-[75rem]:order-8',
];
const ROWS = ['', '', 'min-[75rem]:row-span-2', 'min-[75rem]:row-span-3', 'min-[75rem]:row-span-4'];
const LEAD_COLUMN = 'min-[75rem]:col-start-6 min-[75rem]:col-span-4';
const READING_COLUMN = 'min-[75rem]:col-start-10 min-[75rem]:col-span-3';
const SHARE = {
  1: 'min-[75rem]:order-9 min-[75rem]:col-span-12',
  2: 'min-[75rem]:order-9 min-[75rem]:col-span-6',
  3: 'min-[75rem]:order-9 min-[75rem]:col-span-4',
  4: 'min-[75rem]:order-9 min-[75rem]:col-span-3',
};
const DIAL = 'min-[75rem]:order-1 min-[75rem]:col-span-5';
const DIAL_ALONE = 'min-[75rem]:order-1 min-[75rem]:col-span-12';
const RECENT = {
  besideDial: 'min-[75rem]:col-span-7',
  besideChart: 'min-[75rem]:order-12 min-[75rem]:col-span-5',
  alone: 'min-[75rem]:order-12 min-[75rem]:col-span-12',
};

export const CURVE = 'min-[75rem]:order-10 min-[75rem]:col-span-12';
export const CHART = 'min-[75rem]:order-11 min-[75rem]:col-span-7';

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
 * Places the ActionBanner, the Setup tile, `stats` readings and the recent shots. `emptyLast`
 * says the last reading is an empty tile.
 * Returns the classes of { dial, action, setup, stats: [one per reading], recent }.
 */
export function place({ hasAction, hasSetup, stats, hasChart, emptyLast = false }) {
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
  const empty = emptyLast && waiting.at(-1) === stats - 1 ? waiting.pop() : null;
  if (empty != null) placed.stats[empty] = SHARE[1];
  const count = Math.ceil(waiting.length / 4);
  for (let r = 0; r < count; r++) {
    const size = Math.ceil(waiting.length / (count - r));
    for (const tile of waiting.splice(0, size)) placed.stats[tile] = SHARE[size];
  }
  return placed;
}
