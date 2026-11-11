export const WARNING_LEVEL = { IGNORE: 0, WARN: 1, ERROR: 2 };

export const WARNING_LEVELS = [
  { value: WARNING_LEVEL.IGNORE, label: 'Ignore', activeClass: 'btn-primary' },
  { value: WARNING_LEVEL.WARN, label: 'Warn', activeClass: 'btn-warning' },
  { value: WARNING_LEVEL.ERROR, label: 'Error', activeClass: 'btn-error' },
];

// Keys match WarningManager on the firmware; icons are the same SVGs the display uses.
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

// Reminders about the next shot: they only matter on the dashboard, in the modes they affect.
const SHOT_REMINDERS = ['flush', 'temperature'];

export function urgentWarnings(states = []) {
  return activeWarnings(states).filter(w => !SHOT_REMINDERS.includes(w.key));
}
