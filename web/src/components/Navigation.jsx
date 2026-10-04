import { Icon } from './Icon.jsx';
import { useLocation } from 'preact-iso';
import { useEffect, useRef } from 'preact/hooks';
import {
  DASHBOARD_MODES,
  dashboardModeSignal,
  setDashboardMode,
} from '../utils/dashboardManager.js';
import { machine } from '../services/ApiService.js';
import { computed } from '@preact/signals';

const update = computed(() => machine.value.status.update);

const NAVIGATION_SECTIONS = [
  {
    id: 'dashboard',
    showDivider: true,
    items: [
      {
        label: 'Dashboard',
        link: '/',
        icon: 'house',
        editLink: '/dashboard-settings',
        editIcon: 'pencil',
      },
    ],
  },
  {
    id: 'analysis',
    showDivider: true,
    items: [
      { label: 'Profiles', link: '/profiles', icon: 'list' },
      { label: 'Shot History', link: '/history', icon: 'history' },
      { label: 'Shot Analyzer', link: '/analyzer', icon: 'search', isNew: false },
      { label: 'Statistics', link: '/statistics', icon: 'chart-column', isNew: false },
    ],
  },
  {
    id: 'settings',
    showDivider: true,
    items: [{ label: 'Settings', link: '/settings', icon: 'settings' }],
  },
];

function DashboardModeDropdown({ editLink, editIcon, editActive, isActive }) {
  const mode = dashboardModeSignal.value;

  // daisyUI dropdowns are focus-driven — blur to close after a selection.
  const selectMode = value => {
    setDashboardMode(value);
    document.activeElement?.blur();
  };

  const options = [
    { value: DASHBOARD_MODES.SIMPLE, label: 'Simple' },
    { value: DASHBOARD_MODES.ADVANCED, label: 'Advanced' },
  ];

  return (
    <div className='dropdown dropdown-end h-full'>
      {/* div+tabindex instead of <button>: Safari doesn't focus buttons on click,
          which daisyUI's focus-driven dropdown relies on. */}
      <div
        tabIndex={0}
        role='button'
        aria-label='Dashboard view'
        title='Dashboard view'
        className={`flex h-full cursor-pointer items-center justify-center rounded-r-xl px-2.5 ${
          editActive
            ? 'bg-info text-info-content'
            : isActive
              ? 'bg-info text-info-content hover:text-info-content'
              : 'hover:bg-base-content/10 hover:text-base-content bg-transparent text-[var(--ink-muted)]'
        }`}
      >
        <Icon name={editIcon} className='h-3 w-3' />
      </div>
      <ul
        tabIndex={0}
        className='dropdown-content menu bg-base-100 rounded-box border-base-300 z-10 mt-1 w-44 border p-2'
      >
        {options.map(option => (
          <li key={option.value}>
            <button type='button' onClick={() => selectMode(option.value)}>
              <span className='flex-grow'>{option.label}</span>
              {mode === option.value && <Icon name={'check'} className='h-3 w-3' />}
            </button>
          </li>
        ))}
        <li>
          <a href={editLink} onClick={() => selectMode(DASHBOARD_MODES.CUSTOM)}>
            <span className='flex-grow'>Customize</span>
            {mode === DASHBOARD_MODES.CUSTOM && <Icon name={'check'} className='h-3 w-3' />}
          </a>
        </li>
      </ul>
    </div>
  );
}

function MenuItem({
  collapsed = false,
  icon,
  isNew = false,
  isUnread = false,
  label,
  link,
  editLink,
  editIcon,
}) {
  const { path } = useLocation();
  const isActive = path === link;
  const editActive = path === editLink;
  const isExpanded = collapsed === false;
  const editLinkEnabled = editLink && editIcon && !collapsed;
  // Rounding lives on the children — the row wrapper can't use overflow-hidden
  // or it would clip the dashboard-mode dropdown.
  const commonClasses = `btn btn-md border-none h-11 ${editLinkEnabled ? 'rounded-l-xl rounded-r-none' : 'rounded-xl'}`;
  const baseClassName = collapsed
    ? 'btn-square min-h-0 min-w-0 bg-transparent px-0 text-base-content hover:bg-base-content/10 hover:text-base-content'
    : 'justify-start gap-3 text-base-content hover:text-base-content hover:bg-base-content/10 bg-transparent border-none px-2';
  const activeClassName = collapsed
    ? 'btn-square min-h-0 min-w-0 bg-info px-0 text-info-content hover:bg-info hover:text-info-content'
    : 'justify-start gap-3 bg-info text-info-content hover:bg-info hover:text-info-content px-2';
  const className = `${commonClasses} ${isActive ? activeClassName : baseClassName}`;

  return (
    <div className={`flex h-11 flex-row ${collapsed ? 'w-12' : 'w-full'}`}>
      <a
        href={link}
        className={`flex-grow ${className} relative`}
        aria-label={collapsed ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        title={collapsed ? label : undefined}
      >
        <Icon name={icon} />
        {isUnread && (
          <span className='indicator-item status status-warning absolute -top-0 -right-0'></span>
        )}
        {isExpanded ? (
          <div className='indicator'>
            {isNew ? (
              <span className='indicator-item pl-8 text-xs font-bold text-[var(--success)]'>
                NEW
              </span>
            ) : null}
            <span>{label}</span>
          </div>
        ) : null}
      </a>
      {editLinkEnabled && (
        <DashboardModeDropdown
          editLink={editLink}
          editIcon={editIcon}
          editActive={editActive}
          isActive={isActive}
        />
      )}
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
        className={`sidebar border-base-300 bg-base-100 fixed top-0 left-0 z-9999 flex h-screen flex-col overflow-y-auto border-r p-5 md:static landscape:static ${
          collapsed ? 'hidden md:flex md:w-[90px] landscape:flex landscape:w-[90px]' : 'w-[290px]'
        }`}
      >
        <div className='flex h-full flex-col'>
          <div>
            <div
              className={`align-center flex h-11 flex-row items-center justify-center gap-2 ${collapsed ? 'w-12' : 'w-full'}`}
            >
              {collapsed ? (
                <Icon name='coffee' title='BetterMate' />
              ) : (
                <a href='/' aria-label='BetterMate dashboard' className='w-full'>
                  <img
                    className='bm-wordmark-light w-full'
                    src='/bettermate-wordmark.svg'
                    alt='BetterMate'
                  />
                  <img
                    className='bm-wordmark-dark w-full'
                    src='/bettermate-wordmark-inverse.svg'
                    alt='BetterMate'
                  />
                </a>
              )}
            </div>
          </div>
          {NAVIGATION_SECTIONS.map(section => (
            <div key={section.id}>
              {section.showDivider ? <hr className='h-5 border-0' /> : null}
              <div className='space-y-1.5'>
                {section.items.map(item => {
                  return (
                    <MenuItem
                      key={item.link}
                      collapsed={collapsed}
                      isUnread={item.link === '/settings' && update.value}
                      {...item}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          <div className='flex-grow'>&nbsp;</div>

          {!collapsed && (
            <>
              <div className='flex flex-row items-center justify-center gap-2'>
                <div className='relative inline-block'>
                  <a
                    aria-label='github'
                    rel='noopener noreferrer'
                    href='https://github.com/jniebuhr/gaggimate'
                    target='_blank'
                    className='btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 border-none bg-transparent'
                  >
                    <Icon name={'monitor'} className='text-lg' />
                  </a>
                </div>

                <div className='relative inline-block'>
                  <a
                    aria-label='discord'
                    rel='noopener noreferrer'
                    href='https://discord.gaggimate.eu/'
                    target='_blank'
                    className='btn btn-sm btn-circle text-base-content hover:text-base-content hover:bg-base-content/10 border-none bg-transparent'
                  >
                    <Icon name={'info'} className='text-lg' />
                  </a>
                </div>
              </div>
              <p className='my-5 text-center text-xs text-[var(--ink-muted)]'>
                BetterMate · based on{' '}
                <a
                  href='https://gaggimate.eu'
                  target='_blank'
                  rel='noreferrer'
                  className='text-primary'
                >
                  GaggiMate
                </a>
              </p>
            </>
          )}

          <div>
            <button
              type='button'
              onClick={onToggleCollapsed}
              className={
                collapsed
                  ? 'btn btn-square btn-md text-base-content hover:bg-base-content/10 hover:text-base-content h-11 min-h-0 w-12 min-w-0 rounded-xl border-none bg-transparent px-0'
                  : 'btn btn-md text-base-content hover:text-base-content hover:bg-base-content/10 h-11 w-full justify-start gap-3 border-none bg-transparent px-2'
              }
              aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
              title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            >
              <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} />
              {!collapsed ? (
                <div className='indicator'>
                  <span>Collapse</span>
                </div>
              ) : null}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
