export const TARGET_FLOW_MAX = 12;
export const TARGET_PRESSURE_MAX = 16;

export const SINGLE_METRIC_PAGE_KEYS = {
  BASICS: 'basics',
  PRESSURE_FLOW: 'pressureFlow',
  FLOW_VOLUME: 'flowVolume',
  TEMPERATURE: 'temperature',
  PUCK_RESISTANCE: 'puckResistance',
  ALL: 'all',
};

export const COMPARE_DETAIL_METRIC_PAGE_KEYS = {
  PUMP_FLOW: 'pumpFlow',
  PUMPED_WATER: 'pumpedWater',
};

export const MAIN_CHART_HEIGHT_DEFAULT = 280;
export const TEMP_CHART_HEIGHT_RATIO = 80 / 280;
export const TEMP_CHART_HEIGHT_MIN = 72;

export const REPLAY_TARGET_FPS = 30;
export const REPLAY_FRAME_INTERVAL_MS = 1000 / REPLAY_TARGET_FPS;

export const DEFAULT_REPLAY_EXPORT_CONFIG = {
  exportType: 'video',
  exportFormat: 'mp4',
  includeLegend: false,
  layoutPreset: 'chart_native',
  videoSource: null,
  videoCrop: null,
  chartPlacement: null,
};

export function getReplayExportStatusLabel(status, exportFormat = 'mp4') {
  switch (status) {
    case 'idle':
      return '';
    case 'preparing':
      return exportFormat === 'webm' ? 'Preparing WebM export...' : 'Preparing MP4 export...';
    case 'renderingImage':
      return 'Rendering PNG export...';
    case 'preparingJson':
      return 'Preparing shot JSON...';
    case 'recording':
      return 'Recording replay...';
    case 'downloading':
      return 'Downloading export...';
    case 'error':
      return 'Replay export failed.';
    default:
      return '';
  }
}

export function getReplayExportStatusHint() {
  return '';
}

export const EXTERNAL_TOOLTIP_FALLBACK_OFFSET_X = 12;
export const EXTERNAL_TOOLTIP_POINTER_GAP = 10;
export const EXTERNAL_TOOLTIP_BOUNDS_PADDING = 4;
export const EXTERNAL_TOOLTIP_VERTICAL_OFFSET = 0;

export const WATER_DRAWN_PHASE_LABEL = 'Pumped Water (Phase)';
export const WATER_DRAWN_TOTAL_LABEL = 'Pumped Water (Total)';

// The series token of every legend and tooltip entry. A token colours the mark; the word beside
// it stays ink.
export const SERIES_TOKEN_BY_LABEL = {
  Phases: '--analyzer-phase',
  Stops: '--analyzer-stop',
  Temp: '--analyzer-temperature',
  'Target T': '--analyzer-temperature',
  Pressure: '--analyzer-pressure',
  'Target P': '--analyzer-pressure',
  'Pump Flow': '--analyzer-flow',
  'Target F': '--analyzer-flow',
  'Puck Flow': '--analyzer-puck-flow',
  'Puck Resistance': '--analyzer-puck-resistance',
  'Liquid Resistance': '--analyzer-liquid-resistance',
  Weight: '--analyzer-weight',
  'Weight Flow': '--analyzer-weight-flow',
  [WATER_DRAWN_PHASE_LABEL]: '--analyzer-water',
  [WATER_DRAWN_TOTAL_LABEL]: '--analyzer-water',
};

// Series that share a hue differ by their line: a target is dashed, a series derived from
// another reading is dotted. The legend draws the same mark.
export const LEGEND_DASHED_LABELS = new Set([
  'Target T',
  'Target P',
  'Target F',
  'Puck Flow',
  'Liquid Resistance',
  'Weight Flow',
]);

export const TOOLTIP_WATER_LABELS = new Set([WATER_DRAWN_PHASE_LABEL, WATER_DRAWN_TOTAL_LABEL]);

export const LEGEND_ORDER = [
  'Phases',
  'Stops',
  'Pressure',
  'Target P',
  'Pump Flow',
  'Target F',
  'Puck Flow',
  'Puck Resistance',
  'Liquid Resistance',
  'Weight',
  'Weight Flow',
  'Temp',
  'Target T',
];

const TOOLTIP_ORDER = [
  'Phases',
  'Stops',
  'Pressure',
  'Target P',
  'Pump Flow',
  'Target F',
  'Puck Flow',
  'Puck Resistance',
  'Liquid Resistance',
  'Weight Flow',
  'Weight',
  WATER_DRAWN_PHASE_LABEL,
  WATER_DRAWN_TOTAL_LABEL,
  'Temp',
  'Target T',
];

export const TOOLTIP_INDEX = TOOLTIP_ORDER.reduce((acc, label, index) => {
  acc[label] = index;
  return acc;
}, {});

export const TOOLTIP_GROUP_BY_LABEL = {
  Pressure: 'pressure',
  'Target P': 'pressure',
  'Pump Flow': 'flow',
  'Target F': 'flow',
  'Puck Flow': 'flow',
  'Puck Resistance': 'resistance',
  'Liquid Resistance': 'resistance',
  Weight: 'weight',
  'Weight Flow': 'weight',
  [WATER_DRAWN_PHASE_LABEL]: 'water',
  [WATER_DRAWN_TOTAL_LABEL]: 'water',
  Temp: 'temp',
  'Target T': 'temp',
};

export const VISIBILITY_KEY_BY_LABEL = {
  Phases: 'phaseNames',
  Stops: 'stops',
  Temp: 'temp',
  'Target T': 'targetTemp',
  Pressure: 'pressure',
  'Target P': 'targetPressure',
  'Pump Flow': 'flow',
  'Target F': 'targetFlow',
  'Puck Flow': 'puckFlow',
  'Puck Resistance': 'puckResistance',
  'Liquid Resistance': 'liquidResistance',
  Weight: 'weight',
  'Weight Flow': 'weightFlow',
};

export const INITIAL_VISIBILITY = {
  phaseNames: true,
  stops: true,
  brewModeLabel: true,
  temp: true,
  targetTemp: true,
  pressure: true,
  targetPressure: true,
  flow: true,
  targetFlow: true,
  puckFlow: true,
  puckResistance: false,
  liquidResistance: false,
  weight: true,
  weightFlow: true,
};

export const UNIT_BY_LABEL = {
  Temp: '°C',
  'Target T': '°C',
  Pressure: 'bar',
  'Target P': 'bar',
  'Pump Flow': 'ml/s',
  'Target F': 'ml/s',
  'Puck Flow': 'ml/s',
  'Puck Resistance': 's·√bar/mL',
  'Liquid Resistance': 'bar·s/mL',
  Weight: 'g',
  'Weight Flow': 'g/s',
  [WATER_DRAWN_PHASE_LABEL]: 'ml',
  [WATER_DRAWN_TOTAL_LABEL]: 'ml',
};
