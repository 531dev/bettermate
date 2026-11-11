import { Icon } from './Icon.jsx';
import { ModeRail } from './ModeNav.jsx';
import { useLocation } from 'preact-iso';
import { useEffect, useRef } from 'preact/hooks';
import { machine } from '../services/ApiService.js';
import { computed } from '@preact/signals';

const update = computed(() => machine.value.status.update);

// Analysis lives under History, so the menu stays about the daily routine.
const NAVIGATION_ITEMS = [
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

function MenuItem({ collapsed = false, icon, isUnread = false, label, link, isActive }) {
  const { path } = useLocation();
  const active = isActive(path);
  const baseClassName = collapsed
    ? 'btn-square min-h-0 min-w-0 bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
    : 'justify-start gap-3 text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none px-2';
  const activeClassName = collapsed
    ? 'btn-square min-h-0 min-w-0 bg-info px-0 text-info-content hover:bg-info hover:text-info-content'
    : 'justify-start gap-3 bg-info text-info-content hover:bg-info hover:text-info-content px-2';

  return (
    <div className={`flex h-11 flex-row ${collapsed ? 'w-12' : 'w-full'}`}>
      <a
        href={link}
        className={`btn btn-md relative h-11 flex-grow rounded-xl border-none ${active ? activeClassName : baseClassName}`}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
      >
        <Icon name={icon} />
        {isUnread && (
          <span className='indicator-item status status-warning absolute -top-0 -right-0'></span>
        )}
        {!collapsed && <span>{label}</span>}
      </a>
    </div>
  );
}

export function Navigation({ collapsed = false, onToggleCollapsed }) {
  const loc = useLocation();

  // Track the previous route so the collapse-on-navigation effect only fires
  // when the route actually changes, not when `collapsed` flips back to false
  // (which would close the menu immediately after the user opens it on mobile).
  const previousPathRef = useRef(loc.path);

  useEffect(() => {
    const pathChanged = previousPathRef.current !== loc.path;
    previousPathRef.current = loc.path;
    // Re-check viewport width INSIDE the effect (was captured once at module
    // init, so iPad orientation changes were ignored).
    const isMdDown = typeof window !== 'undefined' && window.innerWidth < 768;
    if (pathChanged && !collapsed && isMdDown) {
      onToggleCollapsed();
    }
  }, [loc.path, collapsed, onToggleCollapsed]);

  return (
    <>
      {!collapsed && (
        <div
          className='fixed end-0 top-0 bottom-0 left-0 z-9998 cursor-pointer bg-[var(--scrim)] md:hidden'
          onClick={onToggleCollapsed}
        />
      )}
      <aside
        className={`sidebar bg-base-100 fixed top-0 left-0 z-9999 flex h-dvh flex-col overflow-y-auto rounded-r-3xl p-3 pl-[max(0.75rem,env(safe-area-inset-left))] md:static md:m-2 md:mr-0 md:h-[calc(100dvh-1rem)] md:shrink-0 md:rounded-3xl landscape:static landscape:m-2 landscape:mr-0 landscape:h-[calc(100dvh-1rem)] landscape:shrink-0 landscape:rounded-3xl ${
          collapsed
            ? 'hidden md:flex md:w-[72px] landscape:flex landscape:w-[72px]'
            : 'w-[272px] md:w-[248px]'
        }`}
      >
        <div className='flex h-full flex-col'>
          <div>
            <div
              className={`align-center mb-4 flex h-11 flex-row items-center justify-center gap-2 ${collapsed ? 'w-12' : 'w-full'}`}
            >
              {collapsed ? (
                <a href='/' aria-label='BetterMate dashboard'>
                  <img className='h-7 w-7' src='/bettermate.svg' alt='' />
                </a>
              ) : (
                <a href='/' aria-label='BetterMate dashboard' className='w-full px-2'>
                  <img
                    className='bm-wordmark-light h-6 w-auto'
                    src='/bettermate-wordmark.svg'
                    alt='BetterMate'
                  />
                  <img
                    className='bm-wordmark-dark h-6 w-auto'
                    src='/bettermate-wordmark-inverse.svg'
                    alt='BetterMate'
                  />
                </a>
              )}
            </div>
          </div>
          <ModeRail collapsed={collapsed} />
          <div className='mt-4 space-y-1.5'>
            {NAVIGATION_ITEMS.map(item => (
              <MenuItem
                key={item.link}
                collapsed={collapsed}
                isUnread={item.link === '/settings' && update.value}
                {...item}
              />
            ))}
          </div>

          <div className='flex-grow'>&nbsp;</div>

          <div className='flex items-center justify-between gap-2'>
            {!collapsed && (
              <p className='min-w-0 pl-2 text-xs text-[var(--ink-muted)]'>
                Based on{' '}
                <a
                  href='https://gaggimate.eu'
                  target='_blank'
                  rel='noreferrer'
                  className='text-primary'
                >
                  GaggiMate
                </a>
              </p>
            )}
            <button
              type='button'
              onClick={onToggleCollapsed}
              className='btn btn-square btn-md text-base-content hover:bg-base-content/10 hover:text-base-content h-11 min-h-0 w-12 min-w-0 shrink-0 rounded-xl border-none bg-transparent px-0'
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
