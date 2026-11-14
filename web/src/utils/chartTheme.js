import { color } from 'chart.js/helpers';

// How the shared charts are drawn (design/reference/web-ui.md, Charts): lines only, 2.5px for
// pressure and 2px for the rest, round joins, no fill and no points; four horizontal grid lines and
// no vertical ones; ticks in the data style at 11px; no animation. The legend is HTML (Chart.jsx).
//
// A canvas cannot read CSS variables, so the builders below leave every color and font out and
// `applyChartTheme` resolves the tokens into the config: before the chart is built, and again
// whenever the theme changes.

const SERIES = ['pressure', 'temperature', 'flow', 'weight'];
const TICK_SIZE = 11;

/** The color of a series as CSS, for a legend dot: it follows the theme by itself. */
export const seriesColor = series => `var(--series-${series})`;

// The tokens as last resolved, for callbacks that run long after a chart was built.
let theme = null;

function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  const ink = read('--ink');
  theme = {
    series: Object.fromEntries(SERIES.map(name => [name, read(`--series-${name}`)])),
    grid: read('--chart-grid'),
    tick: read('--ink-muted'),
    marker: read('--line-strong'),
    // A selected stretch of the time axis is a soft step of ink; a hovered one is half of that.
    band: color(ink).alpha(0.1).rgbString(),
    hover: color(ink).alpha(0.05).rgbString(),
    font: read('--font-mono'),
  };
  return theme;
}

/** The font of every tick and label, as a CSS shorthand: load it before measuring text with it. */
export const chartFont = () => `${TICK_SIZE}px ${(theme || readTheme()).font}`;

/** The fill of a band of the time axis right now: 'band' for the selected one, 'hover' under a pointer. */
export const bandColor = kind => (theme || readTheme())[kind];

// The first fill behind an element: the tile, cell or page a chart happens to sit on.
function groundOf(element) {
  for (let node = element; node; node = node.parentElement) {
    const fill = getComputedStyle(node).backgroundColor;
    if (color(fill).rgb?.a > 0) return fill;
  }
  return 'transparent';
}

/**
 * Resolves the tokens into a chart's raw config: `{ data, options }` as written, or `chart.config`.
 * Nested writes through `chart.options`, a resolver proxy, never reach the drawing, so this writes
 * to the raw objects and the caller updates the chart.
 *   canvas  the chart's canvas, to find the ground its labels are set against
 */
export function applyChartTheme(config, canvas) {
  const t = readTheme();
  const font = { family: t.font, size: TICK_SIZE, weight: 400 };
  const ground = canvas ? groundOf(canvas) : 'transparent';

  for (const dataset of config.data.datasets) {
    if (dataset.series) dataset.borderColor = t.series[dataset.series];
  }

  const options = config.options;
  for (const scale of Object.values(options.scales || {})) {
    scale.ticks = { ...scale.ticks, color: t.tick, font };
    scale.grid = { ...scale.grid, color: t.grid };
    if (scale.title) scale.title = { ...scale.title, color: t.tick, font };
  }

  for (const mark of Object.values(options.plugins?.annotation?.annotations || {})) {
    if (mark.kind === 'phase') {
      mark.borderColor = t.marker;
      // A halo of the ground keeps the name readable where a line runs behind it.
      Object.assign(mark.label, {
        color: t.tick,
        font: { ...font, weight: 500 },
        textStrokeColor: ground,
        textStrokeWidth: 3,
      });
    } else if (mark.kind === 'band') {
      mark.backgroundColor = t.band;
    }
  }
}

// ── Builders ────────────────────────────────────────────────────────────────────────────────

/**
 * An axis from `low` to `high` in three whole steps, so it draws four grid lines and the ticks
 * of two such axes share them.
 */
export function niceAxis(low, high, steps = [1, 2, 4, 5, 10, 20, 25, 40, 50, 100, 200]) {
  for (const step of steps) {
    const min = Math.floor(low / step) * step;
    if (min + 3 * step >= high) return { min, max: min + 3 * step };
  }
  return { min: Math.floor(low), max: Math.ceil(high) };
}

/** The dash of a target, and of the stretch of a profile's curve that is only a limit. */
export const DASHED = { borderDash: [5, 4], borderCapStyle: 'butt' };

const LINE_KINDS = {
  // A target is the dashed line of its series. It breaks where its y is null: no target set.
  target: { ...DASHED, spanGaps: false },
  // A reading worked out from another one (puck flow, weight flow) is the dotted line of its series.
  estimate: { borderDash: [0.01, 5] },
};

/**
 * One line of a chart: 2.5px for the pressure reading, 2px for every other line.
 *   series  'pressure' | 'temperature' | 'flow' | 'weight': its color token
 *   label   its name in the legend; a target has none of its own
 *   data    [{ x, y }], already sorted by x: the charts skip Chart.js parsing
 *   kind    'target' or 'estimate', see above
 */
export function line(series, label, data, { kind, ...rest } = {}) {
  return {
    series,
    label,
    data,
    kind,
    borderWidth: series === 'pressure' && !kind ? 2.5 : 2,
    ...LINE_KINDS[kind],
    ...rest,
  };
}

/**
 * A value axis with four ticks from `min` to `max`.
 *   position  'left' (default) or 'right'
 *   grid      false on a second axis: one set of grid lines for the chart
 *   format    tick text
 *   hidden    scales its lines but shows nothing, like weight beside pressure
 */
export function valueAxis({ min, max }, { position = 'left', grid = true, format, hidden } = {}) {
  return {
    type: 'linear',
    position,
    display: !hidden,
    min,
    max,
    border: { display: false },
    grid: { display: grid, drawTicks: false },
    ticks: { count: 4, padding: 8, ...(format && { callback: format }) },
  };
}

/** The tick step that divides `span` seconds into at most four parts. */
export const secondsStep = span =>
  [1, 2, 5, 10, 15, 20, 30, 60, 120, 300].find(step => span / step <= 4) ?? 600;

/** The time axis in seconds: no grid, at most five ticks, and the unit once, on the first tick. */
export function secondsAxis(min, max, format = (value, index) => (index ? value : `${value} s`)) {
  return {
    type: 'linear',
    min,
    max,
    border: { display: false },
    grid: { display: false },
    ticks: {
      stepSize: secondsStep(max - min),
      includeBounds: false,
      align: 'inner',
      maxRotation: 0,
      padding: 4,
      callback: format,
    },
  };
}

/**
 * A vertical line where a phase starts, with its name running up beside it, as the stage names
 * are set: uppercase mono, which a canvas has to be given, and no box, so no reading hides behind it.
 */
export function phaseLine(x, name, showName = true) {
  return {
    type: 'line',
    kind: 'phase',
    xMin: x,
    xMax: x,
    // The first phase starts at the plot's own edge, which needs no line.
    borderWidth: x > 0 ? 1 : 0,
    label: {
      display: !!(showName && name),
      content: String(name || '').toUpperCase(),
      backgroundColor: 'transparent',
      rotation: -90,
      position: 'end',
      xAdjust: 9,
      padding: { x: 4, y: 0 },
    },
  };
}

/** The selected stretch of the time axis, behind the lines. */
export function band(xMin, xMax, rest) {
  return {
    type: 'box',
    kind: 'band',
    drawTime: 'beforeDatasetsDraw',
    xMin,
    xMax,
    borderWidth: 0,
    ...rest,
  };
}

/** The options every chart shares. `scales` and `annotations` are the chart's own. */
export function chartOptions({ scales, annotations = {}, ...rest }) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    // The data is { x, y } in order already.
    parsing: false,
    normalized: true,
    spanGaps: true,
    events: [],
    elements: {
      line: { fill: false, tension: 0, borderJoinStyle: 'round', borderCapStyle: 'round' },
      point: { radius: 0, hoverRadius: 0, hitRadius: 0 },
    },
    plugins: {
      // The legend is a row of Chips above the canvas.
      legend: { display: false },
      tooltip: { enabled: false },
      annotation: { clip: false, annotations },
    },
    scales,
    ...rest,
  };
}
