import PropTypes from 'prop-types';
import { gaugeGradient } from './gaugeScales.js';
import { heatState, PRESSURE_SCALE_MAX, TEMP_SCALE_MAX } from './machineView.js';

const FLOW_SCALE_MAX = 10;
const WEIGHT_SCALE_MAX = 60;

const pctOf = (value, max) => Math.max(0, Math.min(100, ((value ?? 0) / max) * 100));

function Stat({ stat, detailed }) {
  return (
    <div className='flex min-w-0 items-center justify-between gap-2'>
      <div className='min-w-0'>
        <div className='truncate text-xs leading-4 tracking-[0.02em] text-[var(--ink-muted)] uppercase'>
          {stat.label}
        </div>
        <div className='flex items-baseline gap-1.5 whitespace-nowrap'>
          <span className='text-[26px] leading-8 font-light'>
            {stat.value}
            {stat.unit && <span className='ml-0.5 text-sm font-normal'>{stat.unit}</span>}
          </span>
          {detailed && stat.flag && (
            <span className='text-xs font-medium text-[var(--heat-text)]'>{stat.flag}</span>
          )}
        </div>
        {detailed && (
          <div className='h-4 truncate text-xs leading-4 text-[var(--ink-muted)]'>{stat.note}</div>
        )}
      </div>
      <div
        className={`bm-gauge mr-2 ${stat.gauge === 'neutral' ? 'bm-gauge--neutral' : ''}`}
        style={{ background: gaugeGradient(stat.gauge) }}
        aria-hidden='true'
      >
        {stat.targetPct != null && (
          <span className='bm-gauge__target' style={{ bottom: `${stat.targetPct}%` }} />
        )}
        <span className='bm-gauge__mark' style={{ bottom: `${stat.pct}%` }} />
      </div>
    </div>
  );
}

Stat.propTypes = {
  stat: PropTypes.object.isRequired,
  detailed: PropTypes.bool,
};

const powerStat = (id, label, value) => ({
  id,
  label,
  value: `${Math.round(value ?? 0)}`,
  unit: '%',
  pct: pctOf(value, 100),
  gauge: 'neutral',
});

// Simple view: the dial holds temperature and pressure, so these are the other readings
// that can change what you do next.
function simpleStatIds({
  mode,
  isActive,
  isFinished,
  isFlushing,
  volumetricAvailable,
  grindTarget,
}) {
  const running = isActive || isFlushing;
  switch (mode) {
    case 0:
      return [];
    case 2:
      return ['water'];
    case 3:
      return running ? ['flow'] : ['water'];
    case 4:
      // While grinding by weight the dial is already counting it.
      return running && grindTarget === 1 ? [] : volumetricAvailable ? ['weight'] : [];
    default:
      if (running) return ['flow', volumetricAvailable ? 'weight' : 'water'];
      // A finished shot's yield is on the dial.
      return isFinished ? ['water'] : ['weight', 'water'];
  }
}

function buildStats(ds, advanced) {
  const heat = heatState(ds.currentTemperature, ds.targetTemperature);
  const stats = [
    {
      id: 'temp',
      label: 'Temperature',
      value: `${(ds.currentTemperature ?? 0).toFixed(1)}°`,
      note: ds.mode !== 0 ? `Target ${Math.round(ds.targetTemperature ?? 0)}°` : '',
      flag: ds.mode !== 0 && heat === 'heating' ? 'Heating' : null,
      pct: pctOf(ds.currentTemperature, TEMP_SCALE_MAX),
      targetPct: ds.mode !== 0 ? pctOf(ds.targetTemperature, TEMP_SCALE_MAX) : null,
      gauge: 'temp',
    },
  ];
  if (ds.hasPressure) {
    stats.push({
      id: 'pressure',
      label: 'Pressure',
      value: (ds.currentPressure ?? 0).toFixed(1),
      unit: 'bar',
      note: ds.targetPressure > 0 ? `Target ${ds.targetPressure.toFixed(1)}` : '',
      pct: pctOf(ds.currentPressure, PRESSURE_SCALE_MAX),
      targetPct: ds.targetPressure > 0 ? pctOf(ds.targetPressure, PRESSURE_SCALE_MAX) : null,
      gauge: 'pressure',
    });
  }
  stats.push({
    id: 'flow',
    label: 'Flow',
    value: (ds.currentFlow ?? 0).toFixed(1),
    unit: 'ml/s',
    note: ds.targetFlow > 0 ? `Target ${ds.targetFlow.toFixed(1)}` : '',
    pct: pctOf(ds.currentFlow, FLOW_SCALE_MAX),
    targetPct: ds.targetFlow > 0 ? pctOf(ds.targetFlow, FLOW_SCALE_MAX) : null,
    gauge: 'fill',
  });
  if (ds.volumetricAvailable) {
    const scaleMax = Math.max(WEIGHT_SCALE_MAX, (ds.targetWeight ?? 0) * 1.25);
    stats.push({
      id: 'weight',
      label: 'Weight',
      value: (ds.currentWeight ?? 0).toFixed(1),
      unit: 'g',
      note: ds.brewTarget && ds.targetWeight ? `Target ${Math.round(ds.targetWeight)} g` : '',
      pct: pctOf(ds.currentWeight, scaleMax),
      targetPct: ds.brewTarget && ds.targetWeight ? pctOf(ds.targetWeight, scaleMax) : null,
      gauge: 'fill',
    });
  }
  if (ds.waterLevelPercent !== null) {
    stats.push({
      id: 'water',
      label: 'Water tank',
      value: `${Math.round(ds.waterLevelPercent)}`,
      unit: '%',
      pct: ds.waterLevelPercent,
      gauge: 'level',
    });
  }
  if (advanced) {
    stats.push(powerStat('heater', 'Heater power', ds.mode === 0 ? 0 : ds.currentBoilerPower));
    if (ds.currentPuckResistance > 0 && ds.currentPuckResistance < 100) {
      stats.push({
        id: 'puck',
        label: 'Puck resistance',
        value: ds.currentPuckResistance.toFixed(2),
        pct: pctOf(ds.currentPuckResistance, 10),
        gauge: 'neutral',
      });
    }
  }
  if (advanced) stats.push(powerStat('pump', 'Pump power', ds.currentPumpPower));
  const shown = advanced
    ? stats
    : simpleStatIds(ds).flatMap(id => stats.filter(stat => stat.id === id));
  if (ds.hasReading) return shown;
  return shown.map(stat => ({
    ...stat,
    value: '—',
    unit: '',
    note: '',
    flag: null,
    pct: 0,
    targetPct: null,
  }));
}

export function StatGrid({ ds, advanced = false }) {
  const stats = buildStats(ds, advanced);
  if (stats.length === 0) return null;
  return (
    <section
      aria-label='Machine readings'
      className='bm-group grid grid-cols-2 gap-x-6 gap-y-3 px-5 [&>:last-child:nth-child(odd)]:col-span-2'
    >
      {stats.map(stat => (
        <Stat key={stat.id} stat={stat} detailed={advanced} />
      ))}
    </section>
  );
}

StatGrid.propTypes = {
  ds: PropTypes.object.isRequired,
  advanced: PropTypes.bool,
};
