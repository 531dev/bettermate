import { effect } from '@preact/signals';
import { announce } from '../components/Toast.jsx';
import { machine } from '../services/ApiService.js';

const MODE_NAMES = ['Standby', 'Brew', 'Steam', 'Water', 'Grind'];
// Within this margin the boiler counts as at temperature, as on the dashboard.
const AT_TEMP_MARGIN = 5;

const heat = s =>
  !s.targetTemperature || s.mode === 0 || s.mode === 4
    ? null
    : s.currentTemperature < s.targetTemperature - AT_TEMP_MARGIN
      ? 'Heating.'
      : 'Ready.';

const seconds = ms => `${(ms / 1000).toFixed(1)} seconds`;

/**
 * What the status region says as the machine changes (Accessibility, What a screen reader hears):
 * the mode ("Steam."), heating and ready, a shot starting, each new phase, and a shot finishing
 * with its time and yield. Readings themselves are never announced. Nothing is said for the state
 * the page finds when it opens, only for changes after that.
 */
export function startAnnouncer() {
  let last = null;
  return effect(() => {
    const { status: s, history } = machine.value;
    if (!history.length) return; // nothing is known before the first reading
    const now = {
      mode: s.mode,
      heat: heat(s),
      active: !!s.process?.a,
      utility: !!s.process?.u,
      phase: s.process?.a ? s.process.l : null,
    };
    const was = last;
    last = now;
    if (!was) return;

    if (now.mode !== was.mode) {
      announce(`${MODE_NAMES[now.mode] ?? 'Mode changed'}.`);
      return;
    }
    if (now.active && !was.active) {
      announce(now.utility ? 'Flush started.' : now.mode === 1 ? 'Shot started.' : 'Started.');
      return;
    }
    if (!now.active && was.active) {
      const p = s.process;
      if (now.mode === 1 && !was.utility && p?.e) {
        const grams = p.tt === 'volumetric' ? p.pp : s.currentWeight;
        announce(
          `Shot finished: ${seconds(p.e)}${grams > 0 ? `, ${grams.toFixed(1)} grams` : ''}.`,
        );
      } else {
        announce(was.utility ? 'Flush finished.' : 'Stopped.');
      }
      return;
    }
    if (now.active && now.phase && now.phase !== was.phase && !now.utility) {
      announce(`${now.phase}.`);
      return;
    }
    if (!now.active && now.heat && was.heat && now.heat !== was.heat) announce(now.heat);
  });
}
