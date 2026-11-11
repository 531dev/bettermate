import { fmtElapsed, fmtPhaseTarget, getPhaseLabel } from '../utils.js';

// Within this margin the boiler counts as at temperature, same as the touch UI's steam hint.
const AT_TEMP_MARGIN = 5;

export const TEMP_SCALE_MAX = 160; // fixed gauge scale, shared with the round display
export const PRESSURE_SCALE_MAX = 16;

export function heatState(current = 0, target = 0) {
  if (current < target - AT_TEMP_MARGIN) return 'heating';
  if (current > target + AT_TEMP_MARGIN) return 'cooling';
  return 'ready';
}

const grindTargetLabel = ds =>
  ds.grindTarget === 1 && ds.volumetricAvailable
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

// The screen says one thing about the machine and offers one next action. The dial answers
// what you most want to know in that state. All the wording for every state lives here.
export function describeMachine(ds, { plan = '', dose = null, nextWake = '' } = {}) {
  const { mode, processInfo: p, isActive, isFinished, isFlushing } = ds;
  const current = Math.round(ds.currentTemperature ?? 0);
  const target = Math.round(ds.targetTemperature ?? 0);
  const heat = heatState(ds.currentTemperature, ds.targetTemperature);
  const heatLine = heat === 'heating' ? `Heating to ${target}°` : `Cooling to ${target}°`;
  const progress = Math.max(0, Math.min(100, ((p?.pp ?? 0) / (p?.pt || 1)) * 100));

  const temperature = ds.hasReading ? `${current}°` : '—';
  const pressure = ds.hasPressure ? `${(ds.currentPressure ?? 0).toFixed(1)} bar` : null;
  const elapsed = fmtElapsed(p?.e);
  const offTarget =
    heat === 'heating'
      ? heatEta(ds.history, target) || `${target - current}° to go`
      : `${current - target}° to go`;
  const shotRim = ds.hasPressure ? 'split' : 'temp';
  const boiler = (rim, detail, asleep = false) => ({
    rim,
    reading: temperature,
    label: 'Boiler',
    detail,
    asleep,
  });
  const clock = (rim, readings) => ({ rim, reading: elapsed, readings: readings.filter(Boolean) });

  if (!ds.systemReady) {
    return {
      title: 'Standby',
      status: 'Not ready',
      tone: 'warning',
      dial: boiler('temp', undefined, true),
      action: { kind: 'status', title: 'Waiting for the machine', sub: ds.systemMessage },
    };
  }

  // Until the first telemetry the temperatures are placeholders, so claim nothing about them.
  // A running process keeps its Stop action regardless.
  if (!ds.hasReading && !isActive && !isFinished && !isFlushing) {
    return {
      title: mode === 1 ? ds.selectedProfile || 'Default' : 'BetterMate',
      status: 'Reading the machine',
      tone: 'idle',
      dial: boiler(mode === 1 ? shotRim : 'temp'),
      action: null,
    };
  }

  const stop = (title, sub) => ({
    kind: 'button',
    title,
    sub,
    icon: 'stop',
    running: true,
    progress,
    onClick: ds.deactivate,
  });
  const done = { kind: 'button', title: 'Done', icon: 'check', onClick: ds.clear };

  switch (mode) {
    case 0:
      return {
        title: 'Standby',
        status: 'Ready to wake',
        tone: 'idle',
        dial: boiler('temp', nextWake, true),
        action: {
          kind: 'button',
          title: 'Wake machine',
          sub: 'Starts heating',
          icon: 'power',
          onClick: () => ds.changeMode(1),
        },
      };
    case 1: {
      const title = ds.selectedProfile || 'Default';
      if (isFlushing) {
        return {
          title,
          status: 'Flushing',
          tone: 'active',
          dial: clock(shotRim, [pressure]),
          action: stop('Stop flush', 'Water is running'),
        };
      }
      if (isActive) {
        const phaseTarget = fmtPhaseTarget(p, false);
        const phase = p?.l || getPhaseLabel(p, false);
        return {
          title,
          status: getPhaseLabel(p, false),
          tone: 'active',
          dial: clock(shotRim, [temperature, pressure]),
          action: stop('Stop shot', phaseTarget ? `${phase}, target ${phaseTarget}` : phase),
        };
      }
      if (isFinished) {
        // A shot stopped by weight reports what it measured; a timed one only has the scale.
        const weight = (p?.tt === 'volumetric' ? p.pp : ds.currentWeight) || null;
        return {
          title,
          status: 'Shot finished',
          tone: 'ready',
          dial: clock(shotRim, [
            weight && `${weight.toFixed(1)} g`,
            weight && dose && `1:${(weight / dose).toFixed(1)}`,
          ]),
          action: done,
        };
      }
      return {
        title,
        status: heat === 'ready' ? 'Ready to brew' : heatLine,
        tone: heat === 'ready' ? 'ready' : 'heat',
        dial: boiler(shotRim, heat === 'ready' ? plan : offTarget),
        action: { kind: 'button', title: 'Start shot', icon: 'play', onClick: ds.activate },
      };
    }
    case 2:
      return {
        title: 'Steam',
        status: heat === 'ready' ? 'Ready to steam' : heatLine,
        tone: heat === 'ready' ? 'ready' : 'heat',
        dial: boiler('temp', heat === 'ready' ? undefined : offTarget),
        action: heat === 'ready' ? { kind: 'status', title: 'Open the steam wand' } : null,
      };
    case 3:
      // The firmware only times brew and grind; for water it counts what was pumped.
      if (isActive) {
        return {
          title: 'Water',
          status: 'Pulling water',
          tone: 'active',
          dial: boiler(
            'temp',
            ds.currentWaterPumped > 0
              ? `${Math.round(ds.currentWaterPumped)} ml pumped`
              : undefined,
          ),
          action: stop('Stop water', 'Close the valve when you are done'),
        };
      }
      if (isFinished) {
        return {
          title: 'Water',
          status: 'Finished',
          tone: 'ready',
          dial: boiler('temp'),
          action: done,
        };
      }
      return {
        title: 'Water',
        status: heat === 'ready' ? 'Ready for water' : heatLine,
        tone: heat === 'ready' ? 'ready' : 'heat',
        dial: boiler('temp', heat === 'ready' ? undefined : offTarget),
        action: {
          kind: 'button',
          title: 'Start water',
          sub: 'Then open the valve',
          icon: 'play',
          onClick: ds.activate,
        },
      };
    case 4: {
      if (!ds.isGrindAvailable) {
        return {
          title: 'Grind',
          status: 'Grinder not set up',
          tone: 'warning',
          dial: null,
          action: { kind: 'status', title: 'Turn it on under Settings, Plugins' },
        };
      }
      const byWeight = ds.grindTarget === 1 && ds.volumetricAvailable;
      const grindDial = position => ({
        rim: 'progress',
        progress: position,
        reading: byWeight ? (ds.currentWeight ?? 0).toFixed(1) : elapsed,
        unit: byWeight ? 'g' : undefined,
        label: `of ${grindTargetLabel(ds)}`,
      });
      if (isActive) {
        return {
          title: 'Grind',
          status: 'Grinding',
          tone: 'active',
          dial: grindDial(progress / 100),
          action: stop('Stop grind'),
        };
      }
      if (isFinished) {
        return {
          title: 'Grind',
          status: 'Finished',
          tone: 'ready',
          dial: grindDial(1),
          action: done,
        };
      }
      return {
        title: 'Grind',
        status: 'Ready to grind',
        tone: 'ready',
        dial: {
          rim: 'progress',
          progress: 0,
          reading: byWeight
            ? ds.grindTargetVolume
            : Math.round((ds.grindTargetDuration ?? 0) / 1000),
          unit: byWeight ? 'g' : 's',
          label: 'Grind target',
          stepper: { name: 'grind', onDecrease: ds.lowerTarget, onIncrease: ds.raiseTarget },
        },
        action: { kind: 'button', title: 'Start grind', icon: 'play', onClick: ds.activate },
      };
    }
    default:
      return { title: 'BetterMate', status: '', tone: 'idle', dial: null, action: null };
  }
}
