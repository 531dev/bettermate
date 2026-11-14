import { metricById, PRESSURE_SCALE_MAX, share } from '../../utils/metricDefinitions.js';
import { grindsByWeight } from './machineView.js';

// While a shot runs: what the pump, the cup and the boiler are doing.
const SHOT = ['pressure', 'flow', 'weight', 'temp'];
// Advanced: every reading, all the time.
const EVERY = [...SHOT, 'waterlevel', 'heaterpower', 'pumppower', 'puckresistance'];
const FLOW_SCALE_MAX = 10;

// Simple, between shots: only what can change what you do next. The dial already holds the
// boiler and the pump, so they are not repeated here.
function restingIds(ds, shotFinished) {
  switch (ds.mode) {
    case 1:
      // A finished shot's yield is on the dial.
      return shotFinished ? ['waterlevel'] : ['weight', 'waterlevel'];
    case 3:
      return ds.isActive ? ['flow', 'waterlevel'] : ['waterlevel'];
    case 4:
      // While grinding by weight the dial is already counting it.
      return ds.isActive && grindsByWeight(ds) ? [] : ['weight'];
    default:
      return ['waterlevel'];
  }
}

// The dial shows the time, the yield and the ratio of a finished shot; these add the rest.
function results(stats) {
  return [
    stats?.maxPressure != null && {
      id: 'maxpressure',
      label: 'Max pressure',
      value: stats.maxPressure.toFixed(1),
      unit: 'bar',
      bar: { value: share(stats.maxPressure, PRESSURE_SCALE_MAX), tone: 'primary' },
    },
    stats?.avgFlow != null && {
      id: 'avgflow',
      label: 'Average flow',
      value: stats.avgFlow.toFixed(2),
      unit: 'ml/s',
      bar: { value: share(stats.avgFlow, FLOW_SCALE_MAX), tone: 'flow' },
    },
  ].filter(Boolean);
}

function lastShot({ shots, loading }) {
  const shot = shots[0];
  // The tile holds its place while the history loads, so nothing under it jumps.
  if (!shot) return loading ? [{ id: 'lastshot', label: 'Last shot' }] : [];
  return [
    {
      id: 'lastshot',
      label: 'Last shot',
      value: shot.duration != null ? (shot.duration / 1000).toFixed(1) : undefined,
      unit: 's',
      note: [
        shot.volume != null && `${shot.volume.toFixed(1)} g`,
        shot.maxPressure != null && `${shot.maxPressure.toFixed(1)} bar`,
      ]
        .filter(Boolean)
        .join(' · '),
    },
  ];
}

/**
 * The readings of the dashboard, in order, each as the props of a StatTile plus `id` and `note`.
 *   view           'simple', 'advanced' or 'custom'
 *   chosen         the reading ids of the Customize view
 *   finishedStats  useFinishedStats(): the finished shot's max pressure and average flow
 *   recent         useRecentShots()
 */
export function pickReadings(ds, { view, chosen = [], finishedStats, recent }) {
  const { mode, isActive, isFinished, isFlushing, processInfo } = ds;
  const flush = !!processInfo?.u || isFlushing;
  const shotRunning = mode === 1 && isActive && !flush;
  const shotFinished = mode === 1 && isFinished && !flush;
  const detailed = view !== 'simple';

  const ids =
    view === 'custom'
      ? chosen
      : view === 'advanced'
        ? EVERY
        : shotRunning
          ? SHOT
          : restingIds(ds, shotFinished);
  const live = ids
    .map(metricById)
    .filter(Boolean)
    .filter(metric => (view === 'custom' ? metric.available(ds) : metric.present(ds)))
    .map(metric => {
      // Until the first telemetry there is nothing to read: a dash and an unlit bar.
      if (!ds.hasReading) return { id: metric.id, label: metric.label, bar: {} };
      const stat = {
        id: metric.id,
        label: metric.label,
        ...metric.stat(ds, { precise: detailed }),
      };
      // Simple names a target only where it is the point of the reading: the weight a shot stops at.
      if (!detailed && !(shotRunning && metric.id === 'weight')) delete stat.target;
      return stat;
    });

  if (shotFinished) return [...results(finishedStats), ...live];
  // The last shot belongs to the resting machine, where the next one is decided.
  const resting = view !== 'custom' && mode <= 1 && !shotRunning;
  return resting ? [...live, ...lastShot(recent)] : live;
}
