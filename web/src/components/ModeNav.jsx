import { computed } from '@preact/signals';
import { useContext } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useQuery } from 'preact-fetching';
import { Icon } from './Icon.jsx';
import { ApiServiceContext, machine } from '../services/ApiService.js';
import { MODES } from '../pages/Home/utils.js';

const STEAM_MODE = 2;
const GRIND_MODE = 4;

const status = computed(() => machine.value.status);
const connected = computed(() => machine.value.connected);

function useModeNav() {
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

  const items = MODES.filter(m => m.id !== GRIND_MODE || showGrind).map(m => ({
    ...m,
    active: mode === m.id,
    disabled: !systemReady || (running && mode !== m.id),
  }));

  const select = id => {
    if (id !== mode) apiService.send({ tp: 'req:change-mode', mode: id });
    if (path !== '/') route('/');
  };

  return { items, select, running };
}

// The profile editor and Settings pin their own Save actions where the mode bar would be.
const hidesModeBar = path => path.startsWith('/profiles/') || path.startsWith('/settings');

function ModeBarItems() {
  const { items, select, running } = useModeNav();

  return items.map(m => (
    <button
      key={m.id}
      type='button'
      className='bm-modebar__item'
      aria-label={m.label}
      aria-pressed={m.active}
      disabled={m.disabled}
      title={running && m.disabled ? 'Stop the machine to switch modes' : undefined}
      onClick={() => select(m.id)}
    >
      <span className='bm-modebar__icon'>
        <Icon name={m.icon} />
      </span>
      <span>{m.label}</span>
    </button>
  ));
}

// Portrait phones: the machine's modes sit under the thumb on every page.
export function ModeBar() {
  const { path } = useLocation();
  if (hidesModeBar(path)) return null;

  return (
    <nav aria-label='Machine mode' className='bm-modebar md:hidden landscape:hidden'>
      <ModeBarItems />
    </nav>
  );
}

// Desktop and tablets: the same bar, floating over the bottom of the content.
export function ModeDock() {
  const { path } = useLocation();
  if (hidesModeBar(path)) return null;

  return (
    <nav aria-label='Machine mode' className='bm-dock'>
      <ModeBarItems />
    </nav>
  );
}

// Lets the end of every page scroll clear of the floating bar.
export function ModeDockSpacer() {
  const { path } = useLocation();
  return hidesModeBar(path) ? null : <div className='bm-dock-spacer' aria-hidden='true' />;
}

// Phones in landscape have no height to spare for a floating bar, so the rail holds the modes.
export function ModeRail({ collapsed = false }) {
  const { items, select, running } = useModeNav();

  return (
    <nav aria-label='Machine mode' className='bm-mode-rail flex-col gap-1.5'>
      {!collapsed && <div className='px-2 pb-1 text-xs text-[var(--ink-muted)]'>Machine mode</div>}
      {items.map(m => (
        <button
          key={m.id}
          type='button'
          aria-label={m.label}
          aria-pressed={m.active}
          disabled={m.disabled}
          title={running && m.disabled ? 'Stop the machine to switch modes' : m.label}
          onClick={() => select(m.id)}
          className={`btn btn-md h-11 rounded-xl border-none ${collapsed ? 'btn-square w-12 px-0' : 'w-full justify-start gap-3 px-2'} ${
            m.active
              ? 'bg-primary text-primary-content hover:bg-primary hover:text-primary-content'
              : 'text-base-content hover:bg-base-content/10 hover:text-base-content bg-transparent'
          }`}
        >
          <Icon name={m.icon} />
          {!collapsed && <span>{m.label}</span>}
        </button>
      ))}
    </nav>
  );
}
