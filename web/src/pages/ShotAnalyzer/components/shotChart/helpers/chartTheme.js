import {
  DASH_DERIVED,
  DASH_TARGET,
  LINE_WIDTH,
  PRESSURE_LINE_WIDTH,
  readChartTokens,
} from '../../../ui/chartTokens.js';
import { LEGEND_DASHED_LABELS, SERIES_TOKEN_BY_LABEL } from '../constants';

/**
 * Every colour and font a shot chart draws with, resolved from the tokens for the current theme.
 * Charts call this when they build and again when the theme changes; nothing here is cached.
 * The series also answer to the names the chart code has always used.
 */
export function getShotChartColors() {
  const tokens = readChartTokens();
  return {
    ...tokens,
    temp: tokens.temperature,
    tempTarget: tokens.temperature,
    phaseLine: tokens.phase,
    stopLabel: tokens.stop,
  };
}

const COLOR_KEY_BY_LABEL = {
  Phases: 'phase',
  Stops: 'stop',
  Temp: 'temperature',
  'Target T': 'temperature',
  Pressure: 'pressure',
  'Target P': 'pressure',
  'Pump Flow': 'flow',
  'Target F': 'flow',
  'Puck Flow': 'puckFlow',
  'Puck Resistance': 'puckResistance',
  'Liquid Resistance': 'liquidResistance',
  Weight: 'weight',
  'Weight Flow': 'weightFlow',
};

/** Resolved series colours by legend label, for a canvas (the exported legend). */
export function getLegendColorByLabel(colors) {
  return Object.fromEntries(
    Object.entries(COLOR_KEY_BY_LABEL).map(([label, key]) => [label, colors[key]]),
  );
}

/**
 * Series colours by label as `var(--token)`, for marks in the DOM: legend dots and the glyphs of
 * tooltip rows. They follow a theme switch by themselves.
 */
export const SERIES_CSS_COLOR_BY_LABEL = Object.fromEntries(
  Object.entries(SERIES_TOKEN_BY_LABEL).map(([label, token]) => [label, `var(${token})`]),
);

/** How the line of a series is drawn: 2.5px for pressure, 2px otherwise; dashed or dotted by kind. */
export function getSeriesLineSpec(label) {
  const isTarget = label === 'Target T' || label === 'Target P' || label === 'Target F';
  let dash = [];
  if (isTarget) dash = DASH_TARGET;
  else if (LEGEND_DASHED_LABELS.has(label)) dash = DASH_DERIVED;
  return {
    width: label === 'Pressure' ? PRESSURE_LINE_WIDTH : LINE_WIDTH,
    dash,
  };
}
