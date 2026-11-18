import { color } from 'chart.js/helpers';

// How the shared charts are drawn (design/reference/web-ui.md, Charts, and the Chart card): lines
// only, told apart by weight and dash as well as colour (pressure solid 2.5px, temperature solid
// 2px, flow dashed 6 4, weight dotted 1 5 with round caps), round joins, no fill and no points;
// each line named at its right end with its last value and unit (Chart.jsx draws those); four
// horizontal grid lines and no vertical ones; ticks in the data style, 13px; no animation. The
// legend is HTML (Chart.jsx), shown only on a chart wider than 480px.
//
// A canvas cannot read CSS variables, so the builders below leave every color and font out and
// `applyChartTheme` resolves the tokens into the config: before the chart is built, and again
// whenever the theme changes.

const SERIES = ['pressure', 'temperature', 'flow', 'weight'];
const TICK_SIZE = 13;

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
    ink,
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

/** Each series' own line, so that none depends on its hue. */
export const SERIES_LINE = {
  pressure: { borderWidth: 2.5, borderDash: [], borderCapStyle: 'round' },
  temperature: { borderWidth: 2, borderDash: [], borderCapStyle: 'round' },
  flow: { borderWidth: 2, borderDash: [6, 4], borderCapStyle: 'butt' },
  weight: { borderWidth: 2, borderDash: [1, 5], borderCapStyle: 'round' },
};

/** The fine dash of a target, and of the stretch of a profile's curve that is only a limit. */
export const DASHED = { borderDash: [2, 3], borderCapStyle: 'butt', borderWidth: 1.5 };

const LINE_KINDS = {
  // A target is a fine dashed line of its series' colour. It breaks where its y is null.
  target: { ...DASHED, spanGaps: false },
  // A reading worked out from another one (puck flow, weight flow): a fine dash and dot in the
  // colour of its source.
  estimate: { borderDash: [4, 3, 1, 3], borderCapStyle: 'butt', borderWidth: 1.5 },
};

/** The unit an end label gives each series; an estimate names its own (weight flow is g/s). */
const UNITS = { pressure: 'bar', temperature: '°', flow: 'ml/s', weight: 'g' };

/**
 * One line of a chart, drawn as its series is (SERIES_LINE) or as its kind.
 *   series  'pressure' | 'temperature' | 'flow' | 'weight': its color token and line
 *   label   its name in the legend; a target has none of its own and no end label
 *   data    [{ x, y }], already sorted by x: the charts skip Chart.js parsing
 *   kind    'target' or 'estimate', see above
 *   unit    of its end label, when it is not its series' own
 */
export function line(series, label, data, { kind, unit, ...rest } = {}) {
  return {
    series,
    label,
    data,
    kind,
    unit: unit ?? UNITS[series],
    ...SERIES_LINE[series],
    ...LINE_KINDS[kind],
    ...rest,
  };
}

// ── End labels and what a screen reader hears ──────────────────────────────────────────────

const SPOKEN_UNITS = {
  bar: 'bar',
  '°': 'degrees',
  'ml/s': 'millilitres a second',
  g: 'grams',
  'g/s': 'grams a second',
};

/** A reading as its end label writes it: '9.0 bar', '93°', '2.1 ml/s', '36.1 g'. */
export const endText = (value, unit) =>
  unit === '°' ? `${Math.round(value)}°` : `${value.toFixed(1)} ${unit}`;

const spoken = (value, unit) =>
  unit === '°'
    ? `${Math.round(value)} degrees`
    : `${value.toFixed(1)} ${SPOKEN_UNITS[unit] || unit}`;

/** The lines that carry an end label: named readings with at least one point. */
function labelled(chart) {
  const out = [];
  chart.data.datasets.forEach((dataset, index) => {
    if (!dataset.label || dataset.kind === 'target' || !dataset.unit) return;
    if (!chart.isDatasetVisible(index)) return;
    const points = dataset.data;
    let last = points.length - 1;
    while (last >= 0 && (points[last]?.y == null || Number.isNaN(points[last].y))) last--;
    if (last < 0) return;
    out.push({ dataset, point: points[last] });
  });
  return out;
}

const listed = words =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;

/**
 * What the chart says to a screen reader: its series, the span of time, and the final values.
 *   lead  the chart's own name, said first: 'Shot 12'
 */
export function describeChart(chart, lead) {
  const lines = labelled(chart);
  const head = lead ? `${lead}. ` : '';
  if (!lines.length) return `${head}No readings yet.`;
  const names = lines.map(({ dataset }, i) => (i ? dataset.label.toLowerCase() : dataset.label));
  const x = chart.scales.x;
  const span = x ? Math.round(x.max - x.min) : 0;
  return (
    `${head}${listed(names)} over ${span} seconds. Final values: ` +
    `${listed(lines.map(({ dataset, point }) => spoken(point.y, dataset.unit)))}.`
  );
}

// Labels keep this far apart, and this far from the plot or its right-hand scale.
const LABEL_STEP = 16;
const LABEL_GAP = 8;

/**
 * Names each line at its right end with its last value and unit, in ink, in a gutter right of
 * the plot (and of a right-hand scale); labels that would touch are nudged 16px apart. It also
 * keeps the canvas's spoken label current, since a live chart grows without a render.
 */
export const endLabels = {
  id: 'endLabels',
  beforeLayout(chart) {
    const lines = labelled(chart);
    const { ctx } = chart;
    ctx.save();
    ctx.font = chartFont();
    const widest = Math.max(
      0,
      ...lines.map(({ dataset, point }) => ctx.measureText(endText(point.y, dataset.unit)).width),
    );
    ctx.restore();
    // The raw config, which the layout reads next (writes through `chart.options` are lost).
    // Reserve a little more than this frame needs, so a label growing by a digit does not move
    // the plot on every reading.
    const layout = (chart.config.options.layout ||= {});
    if (typeof layout.padding !== 'object') layout.padding = {};
    layout.padding.right = widest ? Math.ceil((widest + LABEL_GAP) / 8) * 8 : 0;
  },
  afterDatasetsDraw(chart) {
    const lines = labelled(chart);
    const area = chart.chartArea;
    const t = theme || readTheme();
    const canvas = chart.canvas;
    const said = describeChart(chart, canvas.dataset.chartName);
    if (canvas.getAttribute('aria-label') !== said) canvas.setAttribute('aria-label', said);
    if (!lines.length || !area) return;

    const marks = lines
      .map(({ dataset, point }) => {
        const scale = chart.scales[dataset.yAxisID || 'y'];
        const y = scale.getPixelForValue(point.y);
        return {
          text: endText(point.y, dataset.unit),
          y: Math.min(area.bottom, Math.max(area.top, y)),
        };
      })
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < marks.length; i++)
      marks[i].y = Math.max(marks[i].y, marks[i - 1].y + LABEL_STEP);
    const overflow = marks.length ? marks.at(-1).y - area.bottom : 0;
    if (overflow > 0) {
      marks.at(-1).y = area.bottom;
      for (let i = marks.length - 2; i >= 0; i--)
        marks[i].y = Math.min(marks[i].y, marks[i + 1].y - LABEL_STEP);
    }

    const { ctx } = chart;
    ctx.save();
    ctx.font = chartFont();
    ctx.fillStyle = t.ink;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const mark of marks) ctx.fillText(mark.text, chart.width, mark.y);
    ctx.restore();
  },
};

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
    grid: { display: grid && !hidden, drawTicks: false },
    // All four, however short the plot: Chart.js would drop every other one under about 80px.
    ticks: { count: 4, autoSkip: false, padding: 8, ...(format && { callback: format }) },
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
      // The first label sits inside the edge, so it needs more room than Chart.js counts for it.
      autoSkipPadding: 12,
      callback: format,
    },
  };
}

// A plot shorter than this has no room for names beside its lines: they would run across the curves.
const NAME_ROOM = 140;
// How a name sits beside its line: the gap between them, and half the height of its line of text.
const NAME_GAP = 9;
const NAME_PAD = 4;
const NAME_HALF = TICK_SIZE * 0.6;

// Whether the name of the phase that starts at `x` has room on the chart as it is laid out now:
// it must end before the next phase's line.
const roomForName =
  x =>
  ({ chart }) => {
    const area = chart.chartArea;
    if (!area) return true;
    if (area.height < NAME_ROOM) return false;
    let next = Infinity;
    for (const mark of Object.values(chart.config.options.plugins.annotation?.annotations || {})) {
      if (mark.kind === 'phase' && mark.xMin > x && mark.xMin < next) next = mark.xMin;
    }
    if (next === Infinity) return true;
    const scale = chart.scales.x;
    // The plugin keeps a name inside the plot, so the first one sits further from its line.
    const centre = Math.max(scale.getPixelForValue(x), area.left + NAME_PAD + NAME_HALF) + NAME_GAP;
    return scale.getPixelForValue(next) >= centre + NAME_HALF + 2;
  };

/**
 * A vertical line where a phase starts, with its name running up beside it, as the stage names
 * are set: uppercase mono, which a canvas has to be given, and no box, so no reading hides behind it.
 * A short plot keeps the lines and leaves the names out, and so does a phase too narrow for its name.
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
      display: showName && name ? roomForName(x) : false,
      content: String(name || '').toUpperCase(),
      backgroundColor: 'transparent',
      rotation: -90,
      position: 'end',
      xAdjust: NAME_GAP,
      padding: { x: NAME_PAD, y: 0 },
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
    layout: { padding: { right: 0 } },
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
