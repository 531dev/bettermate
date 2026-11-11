import { computed } from '@preact/signals';
import { useContext } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useQuery } from 'preact-fetching';
import { Icon } from './Icon.jsx';
import { ApiServiceContext, machine } from '../services/ApiService.js';

// The machine's modes by firmware id. Each glyph's meaning is fixed across both faces.
export const MODES = [
  { id: 0, icon: 'power', label: 'Standby' },
  { id: 1, icon: 'coffee', label: 'Brew' },
  { id: 2, icon: 'wind', label: 'Steam' },
  { id: 3, icon: 'droplet', label: 'Water' },
  { id: 4, icon: 'bean', label: 'Grind' },
];
const STEAM_MODE = 2;
const GRIND_MODE = 4;

const status = computed(() => machine.value.status);
const connected = computed(() => machine.value.connected);

// The profile editor and Settings pin their own action where the mode bar would be.
export const hidesModeBar = path => path.startsWith('/profiles/') || path.startsWith('/settings');

function ModeBarItems() {
  const apiService = useContext(ApiServiceContext);
  const { path, route } = useLocation();
  const s = status.value;

  // Same rules as the dashboard: anything but a ready controller locks the machine in standby.
  const systemReady = connected.value && (!s.system || s.system.state === 'ready');
  const mode = systemReady ? s.mode : 0;
  // The firmware stops the running process on every mode change, so a stray tap must not end a shot.
  // Steam runs for as long as the mode is selected, so it never locks.
  const running = !!s.process?.a && mode !== STEAM_MODE;

  const { data: settings } = useQuery(
    'settings-cache',
    async () => (await fetch('/api/settings')).json(),
    { staleTime: 30000, refetchOnWindowFocus: false },
  );
  const showGrind =
    settings?.smartGrindActive || (settings?.altRelayFunction ?? 1) === 1 || mode === GRIND_MODE;

  const select = id => {
    if (id !== mode) apiService.send({ tp: 'req:change-mode', mode: id });
    if (path !== '/') route('/');
  };

  return MODES.filter(m => m.id !== GRIND_MODE || showGrind).map(m => {
    const disabled = !systemReady || (running && mode !== m.id);
    return (
      <button
        key={m.id}
        type='button'
        className='bm-modebar__item'
        aria-label={m.label}
        aria-pressed={mode === m.id}
        disabled={disabled}
        title={running && disabled ? 'Stop the machine to switch modes' : undefined}
        onClick={() => select(m.id)}
      >
        <Icon name={m.icon} size={22} />
        {m.label}
      </button>
    );
  });
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
