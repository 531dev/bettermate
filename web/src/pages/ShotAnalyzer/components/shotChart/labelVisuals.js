import {
  BREW_BY_TIME_LABEL,
  BREW_BY_WEIGHT_LABEL,
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
} from './constants';
import { readCssColorVar } from './helpers';

const DISPLAY_LABEL_BY_LABEL = {
  Temp: 'Temperature',
  'Target P': 'Target Pressure',
  'Target F': 'Target Pump Flow',
  'Target T': 'Target Temperature',
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

export function getShotChartBrewModeMeta(results, colors) {
  return results?.isBrewByWeight
    ? {
        label: BREW_BY_WEIGHT_LABEL,
        iconDef: 'scale',
        backgroundColor: readCssColorVar('--analyzer-brew-by-weight-label-bg', colors.weight),
        textColor: readCssColorVar('--analyzer-brew-by-weight-label-text', '#ffffff'),
        borderColor: readCssColorVar('--analyzer-brew-by-weight-label-border', colors.weight),
      }
    : {
        label: BREW_BY_TIME_LABEL,
        iconDef: 'clock',
        backgroundColor: readCssColorVar('--analyzer-brew-by-time-label-bg', '#475569'),
        textColor: readCssColorVar('--analyzer-brew-by-time-label-text', '#ffffff'),
        borderColor: readCssColorVar('--analyzer-brew-by-time-label-border', '#334155'),
      };
}
