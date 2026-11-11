import PropTypes from 'prop-types';
import { computed } from '@preact/signals';
import { useLocation } from 'preact-iso';
import { Icon } from './Icon.jsx';
import { machine } from '../services/ApiService.js';
import { urgentWarnings } from '../utils/warnings.js';

const warningCount = computed(() => {
  const s = machine.value.status;
  return s.mode === 0 ? 0 : urgentWarnings(s.warnings).length;
});

// Detail pages step back to their list instead of opening the menu.
const backTarget = path => {
  if (path.startsWith('/profiles/')) return '/profiles';
  if (path.startsWith('/analyzer') || path.startsWith('/statistics')) return '/history';
  if (path === '/dashboard-settings') return '/';
  return null;
};

const iconButton =
  'btn btn-ghost btn-circle text-base-content hover:bg-base-content/10 border-none';

// Portrait phones only: menu or back on the left, the wordmark centered, exceptions on the right.
export function AppBar({ onOpenNav }) {
  const { path } = useLocation();
  const back = backTarget(path);
  // The dashboard lists its warnings on the machine card, so the icon only points back from elsewhere.
  const warnings = path === '/' ? 0 : warningCount.value;

  return (
    <header className='bm-appbar md:hidden landscape:hidden'>
      {back ? (
        <a href={back} aria-label='Back' className={iconButton}>
          <Icon name='arrow-left' />
        </a>
      ) : (
        <button
          type='button'
          aria-label='Open navigation'
          className={iconButton}
          onClick={onOpenNav}
        >
          <Icon name='menu' />
        </button>
      )}
      <a href='/' aria-label='BetterMate dashboard' className='justify-self-center'>
        <img
          className='bm-wordmark-light h-5 w-auto'
          src='/bettermate-wordmark.svg'
          alt='BetterMate'
        />
        <img
          className='bm-wordmark-dark h-5 w-auto'
          src='/bettermate-wordmark-inverse.svg'
          alt='BetterMate'
        />
      </a>
      {warnings > 0 ? (
        <a
          href='/'
          aria-label={`${warnings} active ${warnings === 1 ? 'warning' : 'warnings'}`}
          className={`${iconButton} text-[var(--warning)]`}
        >
          <Icon name='triangle-alert' />
        </a>
      ) : (
        <span />
      )}
    </header>
  );
}

AppBar.propTypes = {
  onOpenNav: PropTypes.func.isRequired,
};
