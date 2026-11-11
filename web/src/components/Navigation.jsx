import { computed } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { machine } from '../services/ApiService.js';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { usePresence } from './motion.js';
import { Wordmark } from './Wordmark.jsx';

const update = computed(() => machine.value.status.update);

// Analysis lives under History, so the menu stays about the daily routine.
const PAGES = [
  {
    label: 'Dashboard',
    link: '/',
    icon: 'house',
    isActive: p => p === '/' || p === '/dashboard-settings',
  },
  { label: 'Profiles', link: '/profiles', icon: 'list', isActive: p => p.startsWith('/profiles') },
  {
    label: 'History',
    link: '/history',
    icon: 'history',
    isActive: p => ['/history', '/analyzer', '/statistics'].some(root => p.startsWith(root)),
  },
  {
    label: 'Settings',
    link: '/settings',
    icon: 'settings',
    isActive: p => p.startsWith('/settings'),
  },
];

/**
 * The wordmark, the four pages and the GaggiMate credit. From 1024px this is the sidebar tile.
 * Below that it is the menu the top bar opens (`open`): it sits over a scrim and closes on a
 * choice, on Escape and on a press outside.
 */
export function Navigation({ open = false, onClose }) {
  const { path } = useLocation();
  const panel = useRef(null);
  const scrim = usePresence(open);

  // Going back or forward with the menu open leaves it behind.
  const shownPath = useRef(path);
  useEffect(() => {
    if (shownPath.current !== path) onClose?.();
    shownPath.current = path;
  }, [path, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const links = panel.current.querySelectorAll('.bm-nav__item');
    (panel.current.querySelector('[aria-current="page"]') || links[0]).focus();
    const onKey = event => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      {scrim.mounted && (
        <div className={cx('bm-scrim lg:hidden', scrim.shown && 'is-open')} onClick={onClose} />
      )}
      <aside id='navigation' ref={panel} className={cx('bm-tile bm-sidebar', open && 'is-open')}>
        <a
          href='/'
          aria-label='BetterMate dashboard'
          className='bm-sidebar__brand'
          onClick={onClose}
        >
          <Wordmark />
        </a>
        <nav className='bm-nav' aria-label='Pages'>
          {PAGES.map(page => (
            <a
              key={page.link}
              href={page.link}
              className='bm-nav__item'
              aria-current={page.isActive(path) ? 'page' : undefined}
              onClick={onClose}
            >
              <Icon name={page.icon} />
              {page.label}
              {page.link === '/settings' && update.value && (
                <Icon name='download' size={18} title='Update available' className='ml-auto' />
              )}
            </a>
          ))}
        </nav>
        <p className='bm-help bm-sidebar__credit'>
          Based on{' '}
          <a className='bm-link' href='https://gaggimate.eu' target='_blank' rel='noreferrer'>
            GaggiMate
          </a>
        </p>
      </aside>
    </>
  );
}
