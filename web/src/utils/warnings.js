export const WARNING_LEVEL = { IGNORE: 0, WARN: 1, ERROR: 2 };

// As options of a Segmented control. `tone` is the Chip and notice tone of a shown warning.
export const WARNING_LEVELS = [
  { value: WARNING_LEVEL.IGNORE, label: 'Ignore' },
  { value: WARNING_LEVEL.WARN, label: 'Warn', tone: 'warning' },
  { value: WARNING_LEVEL.ERROR, label: 'Error', tone: 'danger' },
];

// A shown warning is amber; one set to Error is the fault tone. Never orange: that is heat.
export const warningTone = level => (level === WARNING_LEVEL.ERROR ? 'danger' : 'warning');

// Keys match WarningManager on the firmware; icons are the same glyphs the display uses.
export const WARNINGS = [
  { key: 'water', label: 'Water tank low', settingKey: 'warnWaterLevel', icon: 'droplet' },
  {
    key: 'temperature',
    label: 'Temperature not stable',
    settingKey: 'warnTemperature',
    icon: 'thermometer',
  },
  {
    key: 'switch',
    label: 'Steam switch left on',
    settingKey: 'warnSteamSwitch',
    icon: 'wind',
  },
  { key: 'flush', label: 'Flush recommended', settingKey: 'warnFlush', icon: 'droplet' },
  {
    key: 'scaleConnected',
    label: 'Scale not connected',
    settingKey: 'warnScaleConnected',
    icon: 'bluetooth',
  },
  {
    key: 'scaleBattery',
    label: 'Scale battery low',
    settingKey: 'warnScaleBattery',
    icon: 'triangle-alert',
  },
];

export const warningByKey = key => WARNINGS.find(w => w.key === key);

// Expand the compact firmware form ({k, l, a}) used in evt:status and evt:brew:confirm.
export function parseWarningStates(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(w => ({ key: w.k, level: w.l ?? 0, active: w.a ?? true }));
}

// Join firmware warning states with their definitions, keeping only shown (non-ignored) active ones.
export function activeWarnings(states = []) {
  return states
    .filter(s => s.level > WARNING_LEVEL.IGNORE && (s.active ?? true))
    .map(s => ({ ...warningByKey(s.key), ...s }))
    .filter(w => w.icon);
}
