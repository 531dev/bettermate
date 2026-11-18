import { computed } from '@preact/signals';
import { useLocation } from 'preact-iso';
import { machine } from '../services/ApiService.js';
import { activeWarnings } from '../utils/warnings.js';
import { Icon } from './Icon.jsx';
import { Wordmark } from './Wordmark.jsx';

const BREW_MODE = 1;

/**
 * The warnings worth a mark on the page for the machine's mode: none in standby, the flush
 * reminder only in Brew, and never the temperature reminder, which is active through every warm-up
 * and is what the dial's ring and its HEATING Chip already say.
 */
export function shownWarnings(status) {
  if (status.mode === 0) return [];
  return activeWarnings(status.warnings).filter(
    w => w.key !== 'temperature' && (w.key !== 'flush' || status.mode === BREW_MODE),
  );
}

const warningCount = computed(() => shownWarnings(machine.value.status).length);

// Detail pages step back to their list instead of opening the menu.
const backTarget = path => {
  if (path.startsWith('/profiles/')) return '/profiles';
  if (path.startsWith('/analyzer') || path.startsWith('/statistics')) return '/history';
  if (path === '/dashboard-settings') return '/';
  return null;
};

/**
 * The top bar under 1024px: menu (or back, on a detail page), the wordmark, and a warning glyph
 * only when a warning exists. It leads to the dashboard, which names the warning.
 */
export function AppBar({ onOpenNav, navOpen = false }) {
  const { path } = useLocation();
  const back = backTarget(path);
  const warnings = warningCount.value;

  return (
    <header className='bm-topbar'>
      {back ? (
        <a href={back} aria-label='Back' className='bm-topbar__btn'>
          <Icon name='arrow-left' />
        </a>
      ) : (
        <button
          type='button'
          aria-label='Open navigation'
          aria-expanded={navOpen}
          aria-controls='navigation'
          className='bm-topbar__btn'
          onClick={onOpenNav}
        >
          <Icon name='menu' />
        </button>
      )}
      <a
        href='/'
        aria-label='BetterMate dashboard'
        className='inline-flex min-h-11 items-center justify-self-center'
      >
        <Wordmark />
      </a>
      {warnings > 0 && (
        <a
          href='/'
          aria-label={`${warnings} active ${warnings === 1 ? 'warning' : 'warnings'}`}
          className='bm-topbar__btn text-(--warning)'
        >
          <Icon name='triangle-alert' />
        </a>
      )}
    </header>
  );
}
