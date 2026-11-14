import { PRESSURE_SCALE_MAX, TEMP_SCALE_MAX, share } from '../../utils/metricDefinitions.js';
import { fmtElapsed, getPhaseLabel } from './utils.js';

// Within this margin the boiler counts as at temperature, same as the touch UI's steam hint.
const AT_TEMP_MARGIN = 5;

const MODE_NAMES = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];

export function heatState(current = 0, target = 0) {
  if (current < target - AT_TEMP_MARGIN) return 'heating';
  if (current > target + AT_TEMP_MARGIN) return 'cooling';
  return 'ready';
}

export const grindsByWeight = ds => ds.grindTarget === 1 && !!ds.volumetricAvailable;

export const grindTargetLabel = ds =>
  grindsByWeight(ds)
    ? `${ds.grindTargetVolume} g`
    : `${Math.round((ds.grindTargetDuration ?? 0) / 1000)} s`;

// How long until the boiler reaches its target, from how fast it has been climbing.
function heatEta(history, target) {
  const latest = history?.at(-1);
  if (!latest) return null;
  const earlier = history.find(entry => entry.timestamp >= latest.timestamp - 20000);
  const seconds = (latest.timestamp - earlier.timestamp) / 1000;
  if (seconds < 8) return null;
  const perSecond = (latest.currentTemperature - earlier.currentTemperature) / seconds;
  if (perSecond < 0.05) return null;
  const remaining = (target - latest.currentTemperature) / perSecond;
  if (remaining < 60) return `Ready in about ${Math.max(10, Math.round(remaining / 10) * 10)} s`;
  return `Ready in about ${Math.round(remaining / 60)} min`;
}

// The one status Chip of the Dial tile. Standby has none: the normal state stays quiet.
const READY = { label: 'Ready', tone: 'success', dot: true };
const FINISHED = { label: 'Finished', tone: 'success' };
const running = label => ({ label, tone: 'primary', dot: true });
const SYSTEM_CHIPS = {
  offline: { label: 'Connecting' },
  starting: { label: 'Starting' },
  waiting: { label: 'No controller', tone: 'warning' },
  updating: running('Updating'),
  autotuning: running('Autotuning'),
  mismatch: { label: 'Version mismatch', tone: 'danger' },
  error: { label: 'Fault', tone: 'danger' },
};

const amount = value => `${Number((value ?? 0).toFixed(1))}`;

/**
 * The dashboard says one thing about the machine and offers one next action. This is all of its
 * wording, per machine state, and what the dial shows in each (design/reference/web-ui.md):
 *
 *   title    the Dial tile's label: the mode, and the profile in Brew
 *   chip     its one status Chip, { label, tone, dot }, or null
 *   heating  the boiler is below its target: the tile takes the heat ground
 *   ring     the Dial's arcs, { left, right } or { full }, each [value, target, tone]
 *   dial     the centre: { label, value, unit, line }
 *   action   the ActionBanner, { label, sub, icon, stop, progress, disabled, onClick }, or null
 *
 * `shot` is what useShotPlan() knows about the selected profile, `nextWake` the next scheduled
 * wake as a phrase, and `openGrinderSettings` leads to where a grinder is turned on.
 */
export function describeMachine(ds, { shot = {}, nextWake = '', openGrinderSettings } = {}) {
  const { mode, processInfo: p, isActive, isFinished, isFlushing } = ds;
  const current = Math.round(ds.currentTemperature ?? 0);
  const target = Math.round(ds.targetTemperature ?? 0);
  const heat = heatState(ds.currentTemperature, ds.targetTemperature);
  const profile = ds.selectedProfile || 'Default';

  const temperature = ds.hasReading ? `${current}°` : undefined;
  const pressure = ds.hasPressure ? `${(ds.currentPressure ?? 0).toFixed(1)} bar` : null;
  const elapsed = fmtElapsed(p?.e);
  const offTarget =
    heat === 'heating'
      ? heatEta(ds.history, target) || `${target - current}° to go`
      : `${current - target}° to go`;

  // The ring waits unlit until the first reading, and marks a target only while one is set.
  const live = (value, max) => (ds.hasReading ? share(value, max) : null);
  const notch = (value, max) => (ds.hasReading && mode !== 0 && value > 0 ? share(value, max) : -1);
  const boilerArc = [
    live(ds.currentTemperature, TEMP_SCALE_MAX),
    notch(ds.targetTemperature, TEMP_SCALE_MAX),
    'heat',
  ];
  const pumpArc = [
    live(ds.currentPressure, PRESSURE_SCALE_MAX),
    notch(ds.targetPressure, PRESSURE_SCALE_MAX),
    'primary',
  ];
  // A machine without a pressure sensor gets the single ring in Brew too.
  const shotRing = ds.hasPressure ? { left: boilerArc, right: pumpArc } : { full: boilerArc };
  const boilerRing = { full: boilerArc };
  const restingRing = { full: [boilerArc[0], -1, 'faint'] };
  const progressRing = position => ({ full: [position, -1, 'ink'] });

  const boiler = line => ({ label: 'Boiler', value: temperature, line });
  const heatChip = { label: heat === 'heating' ? 'Heating' : 'Cooling', tone: 'heat' };
  const boilerChip = heat === 'ready' ? READY : heatChip;
  const heating = heat === 'heating';

  // The share of the running step that is done, and the same in words.
  const step = p?.pt > 0 ? share(p.pp, p.pt) : undefined;
  const stepLine = () => {
    if (!(p?.pt > 0)) return undefined;
    return p.tt === 'volumetric'
      ? `${(p.pp ?? 0).toFixed(1)} of ${amount(p.pt)} g`
      : `${Math.floor((p.pp ?? 0) / 1000)} of ${Math.round(p.pt / 1000)} s`;
  };
  const stop = (label, sub) => ({
    label,
    sub,
    icon: 'stop',
    stop: true,
    progress: step,
    onClick: ds.deactivate,
  });
  const done = sub => ({ label: 'Done', sub, icon: 'check', onClick: ds.clear });
  const start = (label, sub) => ({ label, sub, icon: 'play', onClick: ds.activate });
  const wake = { label: 'Wake up', sub: 'Starts heating', icon: 'power' };

  if (!ds.systemReady) {
    return {
      title: 'Standby',
      chip: SYSTEM_CHIPS[ds.systemState] ?? { label: 'Not ready', tone: 'warning' },
      ring: restingRing,
      dial: boiler(),
      // The controller's own words for why, without the trailing dots it adds on the display.
      action: { ...wake, sub: `${ds.systemMessage}`.replace(/\.+$/, ''), disabled: true },
    };
  }

  const grindReady = mode !== 4 || ds.isGrindAvailable;
  const byWeight = grindsByWeight(ds);
  const stopsGrind = byWeight
    ? `Stops at ${grindTargetLabel(ds)}`
    : `Stops after ${grindTargetLabel(ds)}`;
  const stopsShot =
    ds.brewTarget && shot.weightOut
      ? `Stops at ${shot.weightOut} g`
      : shot.seconds > 0
        ? `Stops after ${shot.seconds} s`
        : undefined;
  const title = mode === 1 ? `Brew · ${profile}` : (MODE_NAMES[mode] ?? 'BetterMate');

  // Until the first telemetry the temperatures are placeholders, so claim nothing about them and
  // start nothing. A running process keeps its Stop action regardless.
  if (!ds.hasReading && !isActive && !isFinished && !isFlushing) {
    const waiting = [
      wake,
      start('Start shot'),
      null,
      start('Start water'),
      grindReady ? start('Start grinding') : null,
    ][mode];
    return {
      title,
      chip: { label: 'Reading' },
      ring:
        [restingRing, shotRing, boilerRing, boilerRing, progressRing(null)][mode] ?? restingRing,
      dial: mode === 4 ? { label: 'Grind target' } : boiler(),
      action: waiting && {
        ...waiting,
        sub: 'Reading the machine',
        onClick: undefined,
        disabled: true,
      },
    };
  }

  switch (mode) {
    case 0:
      return {
        title,
        chip: null,
        ring: restingRing,
        dial: boiler(nextWake),
        action: { ...wake, onClick: () => ds.changeMode(1) },
      };
    case 1: {
      if (isFlushing) {
        return {
          title,
          chip: running('Flushing'),
          ring: shotRing,
          dial: { label: p?.l || 'Flush', value: elapsed, line: pressure },
          action: stop('Stop flush', 'Water is running'),
        };
      }
      if (isActive) {
        const phase = p?.l || getPhaseLabel(p);
        return {
          title,
          chip: running('Brewing'),
          ring: shotRing,
          dial: {
            label: phase,
            value: elapsed,
            line: [temperature, pressure].filter(Boolean).join(' · '),
          },
          action: stop('Stop shot', stepLine() ?? phase),
        };
      }
      if (isFinished) {
        // A shot stopped by weight reports what it measured; a timed one only has the scale.
        const weight = (p?.tt === 'volumetric' ? p.pp : ds.currentWeight) || null;
        return {
          title,
          chip: FINISHED,
          ring: shotRing,
          dial: {
            label: 'Shot time',
            value: elapsed,
            line: [
              weight && `${weight.toFixed(1)} g`,
              weight && shot.dose && `1:${(weight / shot.dose).toFixed(1)}`,
            ]
              .filter(Boolean)
              .join(' · '),
          },
          action: done('Clears this shot'),
        };
      }
      return {
        title,
        chip: boilerChip,
        heating,
        ring: shotRing,
        dial: boiler(heat === 'ready' ? shot.line : offTarget),
        action: start('Start shot', stopsShot),
      };
    }
    case 2:
      // Steam has nothing to press: it runs for as long as the wand is open.
      return {
        title,
        chip: boilerChip,
        heating,
        ring: boilerRing,
        dial: boiler(heat === 'ready' ? 'Open the steam wand' : offTarget),
        action: null,
      };
    case 3:
      // The firmware only times brew and grind; for water it counts what was pumped.
      if (isActive) {
        return {
          title,
          chip: running('Pumping'),
          ring: boilerRing,
          dial: boiler(
            ds.currentWaterPumped > 0
              ? `${Math.round(ds.currentWaterPumped)} ml pumped`
              : undefined,
          ),
          action: stop('Stop water', 'Close the valve when you are done'),
        };
      }
      if (isFinished) {
        return {
          title,
          chip: FINISHED,
          ring: boilerRing,
          dial: boiler(),
          action: done('Ready for more water'),
        };
      }
      return {
        title,
        chip: boilerChip,
        heating,
        ring: boilerRing,
        dial: boiler(heat === 'ready' ? undefined : offTarget),
        action: start('Start water', 'Then open the valve'),
      };
    case 4: {
      if (!ds.isGrindAvailable) {
        return {
          title,
          chip: { label: 'Not set up', tone: 'warning' },
          ring: progressRing(null),
          dial: { label: 'Grinder' },
          action: {
            label: 'Open settings',
            sub: 'Turn the grinder on under Plugins',
            icon: 'settings',
            onClick: openGrinderSettings,
          },
        };
      }
      // A grind that ran out its time is given no end by the firmware, and the elapsed time it
      // then reports is not one: such a grind took the time it was set to.
      const ranFor = isFinished && p?.tt === 'time' ? fmtElapsed(Math.min(p.e, p.pt)) : elapsed;
      // By weight the dial counts grams, by time it counts the clock; both against the target.
      const ground = label => ({
        label,
        value: byWeight ? (ds.currentWeight ?? 0).toFixed(1) : ranFor,
        unit: byWeight ? 'g' : undefined,
        line: `of ${grindTargetLabel(ds)}`,
      });
      if (isActive) {
        return {
          title,
          chip: running('Grinding'),
          ring: progressRing(step ?? 0),
          dial: ground('Grinding'),
          action: stop('Stop grinding', stepLine()),
        };
      }
      if (isFinished) {
        return {
          title,
          chip: FINISHED,
          ring: progressRing(1),
          dial: ground('Ground'),
          action: done('Clears this grind'),
        };
      }
      return {
        title,
        chip: READY,
        ring: progressRing(0),
        dial: {
          label: 'Grind target',
          value: byWeight
            ? `${ds.grindTargetVolume}`
            : `${Math.round((ds.grindTargetDuration ?? 0) / 1000)}`,
          unit: byWeight ? 'g' : 's',
        },
        action: start('Start grinding', stopsGrind),
      };
    }
    default:
      return { title, chip: null, ring: restingRing, dial: boiler(), action: null };
  }
}
