import { computed } from '@preact/signals';
import { useContext, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useQuery } from 'preact-fetching';
import { Icon } from './Icon.jsx';
import { toast } from './Toast.jsx';
import { ApiServiceContext, machine } from '../services/ApiService.js';
import { pendingCommand } from '../utils/commands.js';
import { setClock24h } from '../utils/dashboardManager.js';
import { connection, fault } from '../utils/machineState.js';

// The machine's modes by firmware id. Each glyph's meaning is fixed across both faces.
export const MODES = [
  { id: 0, icon: 'power', label: 'Standby' },
  { id: 1, icon: 'coffee', label: 'Brew' },
  { id: 2, icon: 'wind', label: 'Steam' },
  { id: 3, icon: 'droplet', label: 'Water' },
  { id: 4, icon: 'bean', label: 'Grind' },
];
const STEAM_MODE = 2;
const WATER_MODE = 3;
const GRIND_MODE = 4;

const status = computed(() => machine.value.status);
const connected = computed(() => machine.value.connected);

// The profile editor and Settings pin their own action where the mode bar would be.
export const hidesModeBar = path => path.startsWith('/profiles/') || path.startsWith('/settings');

// Why the other modes are locked, as the hidden sentence a locked mode is described by, and what
// a press on one answers.
function lockReason({ connected, offline, faulted, systemReady, pending, flushing, mode }) {
  if (offline) return ['Locked while the machine is offline.', 'The machine is offline.'];
  if (!connected) return ['Locked until the machine connects.', 'The machine is not connected.'];
  if (faulted) return ['Locked until the fault is fixed.', 'Fix the fault to change mode.'];
  if (!systemReady) return ['Locked until the machine is ready.', 'The machine is not ready yet.'];
  if (pending) return ['Locked while the machine answers.', 'Wait for the machine to answer.'];
  if (flushing) return ['Locked while the flush runs.', 'Stop the flush to change mode.'];
  if (mode === GRIND_MODE) return ['Locked while grinding.', 'Stop grinding to change mode.'];
  if (mode === WATER_MODE) return ['Locked while water runs.', 'Stop the water to change mode.'];
  return ['Locked while a shot runs.', 'Stop the shot to change mode.'];
}

function ModeBarItems() {
  const apiService = useContext(ApiServiceContext);
  const { path, route } = useLocation();
  const s = status.value;

  // Same rules as the dashboard: anything but a ready controller locks the machine in standby.
  const systemReady = connected.value && (!s.system || s.system.state === 'ready');
  const mode = systemReady ? s.mode : 0;
  // The firmware stops the running process on every mode change, so a stray tap must not end a
  // shot. Steam runs for as long as the mode is selected, so being in Steam never locks; while
  // anything else runs Steam locks with the rest (a web mode change stops the process).
  const running = !!s.process?.a && mode !== STEAM_MODE;
  const pending = !!pendingCommand.value;
  const [reason, answer] = lockReason({
    connected: connected.value,
    offline: connection.value === 'offline',
    faulted: !!fault.value,
    systemReady,
    pending,
    flushing: !!s.process?.u,
    mode,
  });
  const anyLocked = !systemReady || running || pending;

  const { data: settings } = useQuery(
    'settings-cache',
    async () => (await fetch('/api/settings')).json(),
    { staleTime: 30000, refetchOnWindowFocus: false },
  );
  // The mode bar is on every page, so this is where the machine's clock setting reaches the web.
  const clock24h = settings?.clock24hFormat;
  useEffect(() => {
    if (clock24h !== undefined) setClock24h(clock24h);
  }, [clock24h]);
  const showGrind =
    settings?.smartGrindActive || (settings?.altRelayFunction ?? 1) === 1 || mode === GRIND_MODE;

  const select = id => {
    if (id !== mode) apiService.send({ tp: 'req:change-mode', mode: id });
    if (path !== '/') route('/');
  };
  // A press on a locked mode answers in the one Toast region.
  const explain = () => toast(answer);

  return (
    <>
      {MODES.filter(m => m.id !== GRIND_MODE || showGrind).map(m => {
        // Locked, not disabled: drawn in ink-faint, still focusable, and it says why.
        const locked = anyLocked && mode !== m.id;
        return (
          <button
            key={m.id}
            type='button'
            className='bm-modebar__item'
            aria-pressed={mode === m.id}
            aria-disabled={locked ? 'true' : undefined}
            aria-describedby={locked ? 'modebar-lock' : undefined}
            onClick={() => (locked ? explain() : select(m.id))}
          >
            <Icon name={m.icon} size={22} />
            {m.label}
          </button>
        );
      })}
      <span id='modebar-lock' className='bm-sr'>
        {anyLocked ? reason : ''}
      </span>
    </>
  );
}

/**
 * The machine's modes, floating over the bottom of every page but the profile editor and Settings.
 * It is state, not navigation: pressing a mode changes what the machine is doing. The one set of
 * mode controls at any window size.
 */
export function ModeBar() {
  const { path } = useLocation();
  if (hidesModeBar(path)) return null;

  return (
    <nav aria-label='Machine mode' className='bm-modebar bm-modebar--float'>
      <ModeBarItems />
    </nav>
  );
}
