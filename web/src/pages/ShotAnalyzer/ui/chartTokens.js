/* global globalThis */
import { Chart } from 'chart.js';
import { useEffect, useState } from 'preact/hooks';

/**
 * Colours and fonts for anything drawn on a canvas, read from the tokens at the moment of drawing.
 * A canvas cannot take `var(--token)`, so charts resolve the tokens here and resolve them again
 * when the theme changes (`useThemeVersion`).
 */

// name in code -> custom property
const TOKEN_BY_KEY = {
  ink: '--ink',
  onInk: '--on-ink',
  inkMuted: '--ink-muted',
  inkFaint: '--ink-faint',
  surface0: '--surface-0',
  surface1: '--surface-1',
  surface2: '--surface-2',
  line: '--line',
  lineStrong: '--line-strong',
  track: '--track',
  grid: '--chart-grid',
  warning: '--warning',
  danger: '--danger',
  pressure: '--analyzer-pressure',
  flow: '--analyzer-flow',
  puckFlow: '--analyzer-puck-flow',
  water: '--analyzer-water',
  temperature: '--analyzer-temperature',
  weight: '--analyzer-weight',
  weightFlow: '--analyzer-weight-flow',
  puckResistance: '--analyzer-puck-resistance',
  liquidResistance: '--analyzer-liquid-resistance',
  duration: '--analyzer-duration',
  phase: '--analyzer-phase',
  stop: '--analyzer-stop',
};

const FONT_FALLBACK = {
  mono: "'Geist Mono', ui-monospace, monospace",
  sans: "'Funnel Display', system-ui, sans-serif",
};

function rootStyle() {
  const root = globalThis.document?.documentElement;
  return root ? globalThis.getComputedStyle(root) : null;
}

/** One token's value as the document resolves it now, such as '#0f20ec'. */
export function readToken(name) {
  return rootStyle()?.getPropertyValue(name).trim() || '';
}

/** Every chart colour and both font stacks, resolved for the current theme. */
export function readChartTokens() {
  const style = rootStyle();
  const read = name => style?.getPropertyValue(name).trim() || '';
  const tokens = {};
  for (const [key, name] of Object.entries(TOKEN_BY_KEY)) tokens[key] = read(name);
  tokens.fontMono = read('--font-mono') || FONT_FALLBACK.mono;
  tokens.fontSans = read('--font-sans') || FONT_FALLBACK.sans;
  return tokens;
}

/** Line widths of the Charts rules: 2.5 for pressure, 2 for every other series. */
export const LINE_WIDTH = 2;
export const PRESSURE_LINE_WIDTH = 2.5;
/** The dash of a target, of a derived series and of shot 2 in a comparison. */
export const DASH_TARGET = [6, 4];
export const DASH_DERIVED = [2, 4];

/** Axis ticks: Geist Mono 11px in ink-muted. */
export function tickStyle(tokens) {
  return { color: tokens.inkMuted, font: { family: tokens.fontMono, size: 11, weight: 400 } };
}

/** A canvas font string in one of the two bundled faces: `canvasFont(tokens, 11)`. */
export function canvasFont(tokens, size = 11, { weight = 400, sans = false } = {}) {
  return `${weight} ${size}px ${sans ? tokens.fontSans : tokens.fontMono}`;
}

/** Horizontal grid lines in chart-grid; an x axis passes `false` and draws none. */
export function gridStyle(tokens, horizontal = true) {
  return horizontal
    ? { display: true, color: tokens.grid, lineWidth: 1, drawTicks: false }
    : { display: false, drawTicks: false };
}

/** The line of a dataset: no fill, no points, round joins. Spread it into a dataset. */
export function lineStyle(color, { width = LINE_WIDTH, dash } = {}) {
  return {
    borderColor: color,
    backgroundColor: color,
    borderWidth: width,
    borderDash: dash || [],
    borderJoinStyle: 'round',
    // a dash keeps its length with a butt cap; a solid line ends round
    borderCapStyle: dash?.length ? 'butt' : 'round',
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: 0,
  };
}

/**
 * A number that changes whenever the theme does. Put it in the dependencies of whatever builds a
 * chart's colours, so a theme switch recolours the chart.
 */
export function useThemeVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const root = globalThis.document?.documentElement;
    if (!root || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => setVersion(value => value + 1));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return version;
}

// Lets the verification scripts read chart configs in development; stripped from builds.
if (import.meta.env.DEV) globalThis.__bmChart = Chart;
