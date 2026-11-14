// The fixed scales of the gauges, shared with the round display. A bar never rescales to look fuller.
export const TEMP_SCALE_MAX = 160;
export const PRESSURE_SCALE_MAX = 16;
const FLOW_SCALE_MAX = 10;
const WEIGHT_SCALE_MAX = 60;
const PUCK_RESISTANCE_SCALE_MAX = 10;

export const share = (value, max) => Math.max(0, Math.min(1, (value ?? 0) / max));
const fixed = (value, digits = 1) => (value ?? 0).toFixed(digits);
const percent = (value, tone) => ({
  value: `${Math.round(value ?? 0)}`,
  unit: '%',
  bar: { value: share(value, 100), tone },
});

/**
 * The readings a dashboard can show, each as the props of a StatTile.
 *
 * Fields:
 *   id         stored in localStorage to represent order and visibility on the Customize dashboard
 *   label      the label above the numeral, and the reading's name in Dashboard Settings
 *   available  (ds) => bool: false hides it from the Customize dashboard and from the settings
 *              pool. ds is either the useDashboardState() result or machine.value.status: both
 *              share the fields these guards use.
 *   present    (ds) => bool: whether this machine has the reading. Simple and Advanced leave out
 *              one it lacks; Customize shows what was chosen, with a dash for a missing value.
 *   stat       (ds, { precise }) => { value, unit, target, bar }: `value` is left out when there
 *              is nothing to read, `target` when no target is set. The bar's scale is fixed.
 */
export const METRIC_DEFINITIONS = [
  {
    id: 'pressure',
    label: 'Pressure',
    available: () => true,
    present: ds => ds.hasPressure,
    stat: ds => ({
      value: fixed(ds.currentPressure),
      unit: 'bar',
      target: ds.targetPressure > 0 ? fixed(ds.targetPressure) : null,
      bar: {
        value: share(ds.currentPressure, PRESSURE_SCALE_MAX),
        target: ds.targetPressure > 0 ? share(ds.targetPressure, PRESSURE_SCALE_MAX) : undefined,
        tone: 'primary',
      },
    }),
  },
  {
    id: 'flow',
    label: 'Flow',
    available: () => true,
    present: () => true,
    stat: ds => ({
      value: fixed(ds.currentFlow),
      unit: 'ml/s',
      target: ds.targetFlow > 0 ? fixed(ds.targetFlow) : null,
      bar: {
        value: share(ds.currentFlow, FLOW_SCALE_MAX),
        target: ds.targetFlow > 0 ? share(ds.targetFlow, FLOW_SCALE_MAX) : undefined,
        tone: 'flow',
      },
    }),
  },
  {
    id: 'weight',
    label: 'Weight',
    available: () => true, // always configurable: it shows a dash while no scale is connected
    present: ds => !!ds.volumetricAvailable,
    stat: ds => {
      if (!ds.volumetricAvailable) return {};
      // A shot that stops by weight fills its bar up to that weight.
      const goal = ds.mode === 1 && ds.brewTarget && ds.targetWeight > 0 ? ds.targetWeight : 0;
      return {
        value: fixed(ds.currentWeight),
        unit: 'g',
        target: goal ? `${Math.round(goal)}` : null,
        bar: goal
          ? { value: share(ds.currentWeight, goal), target: 1, tone: 'weight' }
          : { value: share(ds.currentWeight, WEIGHT_SCALE_MAX), tone: 'weight' },
      };
    },
  },
  {
    id: 'temp',
    label: 'Temperature',
    available: () => true,
    present: () => true,
    stat: (ds, { precise } = {}) => {
      const heated = ds.mode !== 0; // standby has no target
      return {
        value: precise ? fixed(ds.currentTemperature) : `${Math.round(ds.currentTemperature ?? 0)}`,
        unit: '°C',
        target: heated ? `${Math.round(ds.targetTemperature ?? 0)}` : null,
        bar: {
          value: share(ds.currentTemperature, TEMP_SCALE_MAX),
          target: heated ? share(ds.targetTemperature, TEMP_SCALE_MAX) : undefined,
          tone: 'heat',
        },
      };
    },
  },
  {
    id: 'waterlevel',
    label: 'Water tank',
    available: ds => !!ds.tofDistance,
    present: ds => ds.waterLevelPercent != null,
    stat: ds => (ds.waterLevelPercent != null ? percent(ds.waterLevelPercent) : {}),
  },
  {
    id: 'heaterpower',
    label: 'Heater power',
    available: () => true,
    present: () => true,
    stat: ds => percent(ds.mode === 0 ? 0 : ds.currentBoilerPower, 'heat'),
  },
  {
    id: 'pumppower',
    label: 'Pump power',
    available: () => true,
    present: () => true,
    stat: ds => percent(ds.currentPumpPower),
  },
  {
    id: 'puckresistance',
    label: 'Puck resistance',
    available: () => true,
    // The firmware reports 0 between shots and a very large number while the puck is dry.
    present: ds => ds.currentPuckResistance > 0 && ds.currentPuckResistance < 100,
    stat: ds => {
      const r = ds.currentPuckResistance ?? 0;
      if (!(r > 0 && r < 100)) return {};
      return { value: fixed(r, 2), bar: { value: share(r, PUCK_RESISTANCE_SCALE_MAX) } };
    },
  },
  {
    id: 'puckflow',
    label: 'Puck flow',
    available: () => true,
    present: () => true,
    stat: ds => ({
      value: fixed(ds.currentPuckFlow),
      unit: 'ml/s',
      bar: { value: share(ds.currentPuckFlow, FLOW_SCALE_MAX), tone: 'flow' },
    }),
  },
  {
    id: 'estimatedoutput',
    label: 'Estimated output',
    available: () => true,
    present: () => true,
    stat: ds => {
      const volume = ds.currentCoffeeVolume ?? 0;
      if (!(volume > 0)) return {};
      return { value: fixed(volume), unit: 'ml', bar: { value: share(volume, WEIGHT_SCALE_MAX) } };
    },
  },
];

export const metricById = id => METRIC_DEFINITIONS.find(metric => metric.id === id);
