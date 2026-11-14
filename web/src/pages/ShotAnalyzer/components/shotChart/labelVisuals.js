import { WATER_DRAWN_PHASE_LABEL, WATER_DRAWN_TOTAL_LABEL } from './constants';

// The labels are also the keys the chart code uses; this is how each one is written for people,
// in sentence case. A chip sets its own uppercase.
const DISPLAY_LABEL_BY_LABEL = {
  Temp: 'Temperature',
  'Target P': 'Target pressure',
  'Target F': 'Target pump flow',
  'Target T': 'Target temperature',
  'Pump Flow': 'Pump flow',
  'Puck Flow': 'Puck flow',
  'Puck Resistance': 'Puck resistance',
  'Liquid Resistance': 'Liquid resistance',
  'Weight Flow': 'Weight flow',
  [WATER_DRAWN_PHASE_LABEL]: 'Pumped water (phase)',
  [WATER_DRAWN_TOTAL_LABEL]: 'Pumped water (total)',
};

const ICON_BY_LABEL = {
  Temp: 'thermometer',
  'Target T': 'sliders-horizontal',
  Pressure: 'gauge',
  'Target P': 'sliders-horizontal',
  'Pump Flow': 'droplet',
  'Target F': 'sliders-horizontal',
  'Puck Flow': 'sliders-horizontal',
  'Puck Resistance': 'gauge',
  'Liquid Resistance': 'gauge',
  Weight: 'scale',
  'Weight Flow': 'scale',
  [WATER_DRAWN_PHASE_LABEL]: 'droplet',
  [WATER_DRAWN_TOTAL_LABEL]: 'droplet',
};

export function getShotChartDisplayLabel(label) {
  return DISPLAY_LABEL_BY_LABEL[label] || label;
}

export function getShotChartLabelIcon(label) {
  return ICON_BY_LABEL[label] || null;
}
