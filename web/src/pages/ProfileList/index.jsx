import { Icon } from '../../components/Icon.jsx';
import Sortable, { MultiDrag } from 'sortablejs';
try {
  Sortable?.mount(new MultiDrag());
} catch (error) {
  // to avoid error when vite is reloading the page in dev mode
}

import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-dayjs-4/dist/chartjs-adapter-dayjs-4.esm';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { useConfirmAction } from '../../hooks/useConfirmAction.js';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Spinner } from '../../components/Spinner.jsx';
import Card from '../../components/Card.jsx';
import { parseProfile } from './utils.js';
import { downloadJson } from '../../utils/download.js';
import { Tooltip } from '../../components/Tooltip.jsx';
import { buildStatisticsProfileHref } from '../Statistics/utils/statisticsRoute.js';

Chart.register(
  LineController,
  TimeScale,
  LinearScale,
  CategoryScale,
  PointElement,
  LineElement,
  Filler,
  Legend,
);

const PhaseLabels = {
  preinfusion: 'Pre-Infusion',
  brew: 'Brew',
};

const connected = computed(() => machine.value.connected);

function ProfileCard({
  data,
  onDelete,
  onSelect,
  onFavorite,
  onUnfavorite,
  onDuplicate,
  favoriteDisabled,
  unfavoriteDisabled,
  disabledDrag,
  isDragging,
  onMoveTop,
  onMoveBottom,
  isFirst,
  isLast,
}) {
  const { armed: confirmDelete, armOrRun: confirmOrDelete } = useConfirmAction(4000);
  const [tooltipsDisabled, setTooltipsDisabled] = useState(false);

  const handleMoveTop = useCallback(() => {
    setTooltipsDisabled(true);
    onMoveTop(data.id);
    setTimeout(() => setTooltipsDisabled(false), 500);
  }, [onMoveTop, data.id]);

  const handleMoveBottom = useCallback(() => {
    setTooltipsDisabled(true);
    onMoveBottom(data.id);
    setTimeout(() => setTooltipsDisabled(false), 500);
  }, [onMoveBottom, data.id]);

  const favoriteToggleDisabled = data.favorite ? unfavoriteDisabled : favoriteDisabled;
  const favoriteToggleClass = favoriteToggleDisabled ? 'opacity-50 cursor-not-allowed' : '';

  const onFavoriteToggle = useCallback(() => {
    if (data.favorite && !unfavoriteDisabled) onUnfavorite(data.id);
    else if (!data.favorite && !favoriteDisabled) onFavorite(data.id);
  }, [data.favorite, unfavoriteDisabled, favoriteDisabled, onUnfavorite, onFavorite, data.id]);

  const onDownload = useCallback(() => {
    const download = {
      ...data,
    };
    delete download.id;
    delete download.selected;
    delete download.favorite;

    downloadJson(download, `profile-${data.id}.json`);
  }, [data]);
  const statsHref = buildStatisticsProfileHref({ source: 'gaggimate', profileName: data.label });

  // Toggle profile details
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const onToggleDetails = useCallback(() => setDetailsCollapsed(v => !v), []);
  const detailsSectionId = `profile-${data.id}-summary`;

  const phases = Array.isArray(data?.phases) ? data.phases : [];

  // Sum total duration from phases (in seconds)
  const totalDurationSeconds = phases.reduce(
    (sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0),
    0,
  );
  const weightOut = phases
    .flatMap(p => p.targets || [])
    .filter(t => t.type === 'volumetric')
    .at(-1)?.value;
  const facts = [
    `${data.temperature}°C`,
    data.dose && `${data.dose} g in`,
    weightOut && `${weightOut} g out`,
    `${totalDurationSeconds} s`,
    phases.length > 1 && `${phases.length} phases`,
  ]
    .filter(Boolean)
    .join(', ');

  // Mobile actions menu — state-driven (was using the Popover API which isn't
  // supported in Safari <17 / Firefox <125, leaving the menu broken on most
  // iPads and many phones).
  const kebabRef = useRef(null);
  const popoverRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const positionPopover = useCallback(() => {
    const btn = kebabRef.current;
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    const rect = btn.getBoundingClientRect();
    const w = pop.offsetWidth || 224; // ~w-56
    const h = pop.offsetHeight || 0;
    const gap = 6;
    let top = rect.bottom + gap;
    let left = rect.right - w; // right-aligned to the button
    const margin = 8;
    if (left < margin) left = margin;
    const maxLeft = window.innerWidth - w - margin;
    if (left > maxLeft) left = maxLeft;
    const maxTop = window.innerHeight - h - margin;
    if (top > maxTop) top = Math.max(margin, rect.top - h - gap);
    pop.style.position = 'fixed';
    pop.style.inset = 'auto auto auto auto';
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const toggleMenu = useCallback(e => {
    e?.preventDefault?.();
    setMenuOpen(v => !v);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    // Position now (DOM is mounted because the conditional render put the div
    // in the tree this tick) and then re-position on resize/scroll.
    positionPopover();
    const onResize = () => positionPopover();
    const onDocClick = e => {
      const pop = popoverRef.current;
      const btn = kebabRef.current;
      if (!pop || !btn) return;
      if (pop.contains(e.target) || btn.contains(e.target)) return;
      setMenuOpen(false);
    };
    const onKey = e => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen, positionPopover]);

  return (
    <Card
      sm={12}
      role='listitem'
      className={`profile-card-container border-2 [&>.card-body]:p-3 ${data.selected ? 'border-primary' : 'border-transparent'}`}
    >
      <div
        className='flex flex-row items-center'
        role='group'
        aria-labelledby={`profile-${data.id}-title`}
      >
        <div className='flex min-w-0 flex-grow flex-col'>
          <div className='flex flex-row items-center gap-1'>
            <button
              type='button'
              onClick={() => onSelect(data.id)}
              className='flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3 text-left'
              aria-label={`Select ${data.label} profile`}
              aria-pressed={data.selected}
            >
              <span className={`bm-pick ${data.selected ? 'bm-pick--on' : ''}`}>
                {data.selected && <Icon name='check' />}
              </span>
              <span className='min-w-0 flex-1'>
                <span className='flex min-w-0 items-center gap-2'>
                  <span id={`profile-${data.id}-title`} className='bm-row__title'>
                    {data.label}
                  </span>
                  {data.type === 'pro' && (
                    <span className='shrink-0 text-xs text-[var(--ink-muted)]'>Pro</span>
                  )}
                </span>
                <span className='bm-row__sub'>{facts}</span>
              </span>
            </button>
            <div
              className='flex shrink-0 flex-row'
              role='group'
              aria-label={`Actions for ${data.label} profile`}
            >
              <a
                href={`/profiles/${data.id}`}
                className='btn btn-ghost btn-circle'
                aria-label={`Edit ${data.label} profile`}
                title='Edit'
              >
                <Icon name='pencil' />
              </a>
              {/* Secondary actions share a labeled menu on every viewport. */}
              <div>
                <button
                  ref={kebabRef}
                  onClick={toggleMenu}
                  className='btn btn-ghost btn-circle'
                  aria-label={`Open actions menu for ${data.label} profile`}
                  aria-haspopup='menu'
                  aria-expanded={menuOpen}
                  aria-controls={`profile-${data.id}-menu`}
                >
                  <Icon name='more-horizontal' />
                  <span className='sr-only'>More</span>
                </button>
                {menuOpen && (
                  <div
                    id={`profile-${data.id}-menu`}
                    ref={popoverRef}
                    role='menu'
                    className='bg-base-100 rounded-box z-50 w-56 p-2'
                    onKeyDown={e => {
                      if (e.key === 'Escape') closeMenu();
                    }}
                  >
                    <ul className='menu' role='none'>
                      <li role='none'>
                        <button
                          role='menuitem'
                          onClick={() => {
                            onToggleDetails();
                            closeMenu();
                          }}
                          className='justify-start'
                          aria-label={`${detailsCollapsed ? 'Show' : 'Hide'} details for ${data.label}`}
                          aria-expanded={!detailsCollapsed}
                          aria-controls={detailsSectionId}
                        >
                          <Icon name={detailsCollapsed ? 'chevron-down' : 'chevron-up'} />
                          <span>{detailsCollapsed ? 'Show details' : 'Hide details'}</span>
                        </button>
                      </li>
                      <li role='none'>
                        <button
                          role='menuitem'
                          onClick={() => {
                            onFavoriteToggle();
                            closeMenu();
                          }}
                          disabled={favoriteToggleDisabled}
                          className={`justify-start ${favoriteToggleClass}`}
                          aria-label={
                            data.favorite
                              ? `Remove ${data.label} from favorites`
                              : `Add ${data.label} to favorites`
                          }
                          aria-pressed={data.favorite}
                        >
                          <Icon name={'check'} />
                          <span>{data.favorite ? 'Unfavorite' : 'Favorite'}</span>
                        </button>
                      </li>
                      <li role='none'>
                        <a
                          role='menuitem'
                          href={statsHref}
                          onClick={closeMenu}
                          className='justify-start'
                          aria-label={`View statistics for ${data.label} profile`}
                        >
                          <Icon name={'chart-column'} />
                          <span>Statistics</span>
                        </a>
                      </li>
                      <li role='none'>
                        <button
                          role='menuitem'
                          onClick={() => {
                            onDownload();
                            closeMenu();
                          }}
                          className='justify-start'
                          aria-label={`Export ${data.label} profile`}
                        >
                          <Icon name={'save'} />
                          <span>Export</span>
                        </button>
                      </li>
                      <li role='none'>
                        <button
                          role='menuitem'
                          onClick={() => {
                            onDuplicate(data.id);
                            closeMenu();
                          }}
                          className='justify-start'
                          aria-label={`Duplicate ${data.label} profile`}
                        >
                          <Icon name={'list'} />
                          <span>Duplicate</span>
                        </button>
                      </li>
                      <li role='none'>
                        <button
                          role='menuitem'
                          onClick={() => {
                            confirmOrDelete(() => {
                              onDelete(data.id);
                              closeMenu();
                            });
                          }}
                          className={`justify-start ${confirmDelete ? 'bg-error text-error-content rounded font-semibold' : 'text-[var(--danger)]'}`}
                          aria-label={
                            confirmDelete
                              ? `Confirm deletion of ${data.label} profile`
                              : `Delete ${data.label} profile`
                          }
                          title={confirmDelete ? 'Click to confirm delete' : 'Delete profile'}
                        >
                          <Icon name={'trash-2'} />
                          <span>{confirmDelete ? 'Confirm' : 'Delete'}</span>
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={`${isDragging ? 'hidden' : ''}`}>
            {!detailsCollapsed && (
              <p id={detailsSectionId} className='mt-2 pl-11 text-sm text-[var(--ink-muted)]'>
                {data.description}
              </p>
            )}
            <div
              className={`flex flex-row gap-2 py-2 ${detailsCollapsed ? 'hidden' : ''}`}
              aria-label={`Profile details for ${data.label}`}
            >
              <div className='flex flex-col justify-evenly pr-1'>
                <Tooltip content='Move to top' disabled={isDragging || tooltipsDisabled}>
                  <button
                    onClick={handleMoveTop}
                    disabled={isFirst}
                    className='drag-to-top btn btn-sm btn-ghost'
                    aria-label={`Move ${data.label} to top`}
                    aria-disabled={isFirst}
                  >
                    <Icon name={'chevron-up'} />
                  </button>
                </Tooltip>
                <Tooltip
                  content={`${disabledDrag ? 'Drag disabled on search result' : 'Drag to reorder'}`}
                  disabled={isDragging}
                >
                  <div
                    className={`drag-handle btn btn-sm btn-ghost ${disabledDrag ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}`}
                  >
                    <Icon name={'list'} />
                  </div>
                </Tooltip>
                <Tooltip content='Move to bottom' disabled={isDragging || tooltipsDisabled}>
                  <button
                    onClick={handleMoveBottom}
                    disabled={isLast}
                    className='drag-to-bottom btn btn-sm btn-ghost'
                    aria-label={`Move ${data.label} to bottom`}
                    aria-disabled={isLast}
                  >
                    <Icon name={'chevron-down'} />
                  </button>
                </Tooltip>
              </div>
              <div className='flex-grow overflow-x-auto'>
                {data.type === 'pro' ? (
                  <ExtendedProfileChart data={{ ...data, phases }} className='max-h-36' />
                ) : (
                  <SimpleContent phases={phases} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Whole-list actions are rare, so they wait behind one menu beside the search.
function ProfilesMenu({ onExport, onClear }) {
  const { armed: confirmClear, armOrRun: confirmOrClear } = useConfirmAction(4000);
  const menuRef = useRef(null);
  const closeMenu = () => {
    if (menuRef.current) menuRef.current.open = false;
  };

  return (
    <details ref={menuRef} className='relative shrink-0'>
      <summary className='btn btn-ghost btn-circle list-none' aria-label='More profile actions'>
        <Icon name='more-horizontal' />
      </summary>
      <div className='absolute top-full right-0 z-50 mt-2 flex w-56 flex-col rounded-xl border border-[var(--line-strong)] bg-[var(--surface-1)] p-2'>
        <button
          type='button'
          id='export-profiles'
          className='btn btn-ghost justify-start'
          onClick={() => {
            onExport();
            closeMenu();
          }}
        >
          Export all
        </button>
        <label
          htmlFor='profileImport'
          className='btn btn-ghost cursor-pointer justify-start'
          onClick={closeMenu}
        >
          Import
        </label>
        <button
          type='button'
          className={`btn justify-start ${confirmClear ? 'btn-error' : 'btn-ghost text-[var(--danger)]'}`}
          onClick={() =>
            confirmOrClear(() => {
              onClear();
              closeMenu();
            })
          }
        >
          {confirmClear ? 'Confirm delete all' : 'Delete all'}
        </button>
      </div>
    </details>
  );
}

function SimpleContent({ phases }) {
  if (phases.length === 0) {
    return <div className='text-sm text-[var(--ink-muted)]'>No phases</div>;
  }

  return (
    <div className='flex flex-row items-center gap-2' role='list' aria-label='Brew phases'>
      {phases.map((phase, i) => (
        <div key={i} className='flex flex-row items-center gap-2' role='listitem'>
          {i > 0 && <SimpleDivider />}
          <SimpleStep
            phase={phase.phase}
            type={phase.name}
            duration={phase.duration}
            targets={phase.targets || []}
          />
        </div>
      ))}
    </div>
  );
}

function SimpleDivider() {
  return <Icon name={'chevron-right'} className='text-[var(--ink-muted)]' aria-hidden='true' />;
}

function SimpleStep(props) {
  return (
    <div className='bg-base-100 border-base-300 flex flex-col gap-1 rounded-lg border p-3'>
      <div className='flex flex-row gap-2'>
        <span className='text-base-content text-sm font-bold'>{PhaseLabels[props.phase]}</span>
        <span className='text-sm text-[var(--ink-muted)]'>{props.type}</span>
      </div>
      <div className='text-sm text-[var(--ink-muted)] italic'>
        {props.targets.length === 0 && <span>Duration: {props.duration}s</span>}
        {props.targets.map((t, i) => (
          <span key={i}>
            Exit on: {t.value}
            {t.type === 'volumetric' && 'g'}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProfileList() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('extraction');
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const favoriteCount = profiles.map(p => (p.favorite ? 1 : 0)).reduce((a, b) => a + b, 0);
  const unfavoriteDisabled = favoriteCount <= 1;
  const favoriteDisabled = favoriteCount >= 10;
  const hasUtilityProfiles = useMemo(() => profiles.some(p => p.utility), [profiles]);

  useEffect(() => {
    if (!hasUtilityProfiles) {
      setActiveTab('extraction');
    }
  }, [hasUtilityProfiles]);

  const loadProfiles = async () => {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfiles(response.profiles);
    setLoading(false);
  };

  // Placeholder for future persistence of order (intentionally empty)
  // Debounced persistence of profile order (300ms)
  const orderDebounceRef = useRef(null);
  const pendingOrderRef = useRef(null);
  const persistProfileOrder = useCallback(
    orderedProfiles => {
      pendingOrderRef.current = orderedProfiles.map(p => p.id);
      if (orderDebounceRef.current) {
        clearTimeout(orderDebounceRef.current);
      }
      orderDebounceRef.current = setTimeout(async () => {
        const orderedIds = pendingOrderRef.current;
        if (!orderedIds) return;
        try {
          await apiService.request({ tp: 'req:profiles:reorder', order: orderedIds });
        } catch (e) {
          // optional: log or surface error
        }
      }, 300);
    },
    [apiService],
  );

  // Cleanup: flush pending order on unmount
  useEffect(() => {
    return () => {
      if (orderDebounceRef.current) {
        clearTimeout(orderDebounceRef.current);
        if (pendingOrderRef.current) {
          // fire and forget; no await during unmount
          apiService
            .request({ tp: 'req:profiles:reorder', order: pendingOrderRef.current })
            .catch(() => {});
        }
      }
    };
  }, [apiService]);

  // Filtered profiles
  const profilesToShow = useMemo(() => {
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      return profiles.filter(
        profile =>
          profile.label?.toLowerCase().includes(search) ||
          profile.description?.toLowerCase().includes(search),
      );
    }
    return profiles;
  }, [profiles, searchTerm]);

  const clearDropHighlights = useCallback(() => {
    if (!containerRef.current) return;
    const highlighted = containerRef.current.querySelectorAll('.drop-highlight');
    highlighted.forEach(el => {
      el.classList.remove('drop-highlight');
    });
  }, []);

  const moveProfileTop = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx <= 0) return prev;

        const item = prev[idx];
        const reordered = [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];

        const normalized = [
          ...reordered.filter(p => !p.utility),
          ...reordered.filter(p => p.utility),
        ];

        persistProfileOrder(normalized);
        return normalized;
      });
    },
    [persistProfileOrder],
  );

  const moveProfileBottom = useCallback(
    id => {
      setProfiles(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx === -1 || idx === prev.length - 1) {
          return prev;
        }

        const item = prev[idx];
        const reordered = [...prev.slice(0, idx), ...prev.slice(idx + 1), item];

        const normalized = [
          ...reordered.filter(p => !p.utility),
          ...reordered.filter(p => p.utility),
        ];

        persistProfileOrder(normalized);
        return normalized;
      });
    },
    [persistProfileOrder],
  );

  const onDragStart = useCallback(() => {
    setIsDragging(true);
    if (!containerRef.current) return;

    // Clear any previous drop highlights
    clearDropHighlights();
  }, [clearDropHighlights]);

  const onDragChange = useCallback(
    evt => {
      const { newIndex, oldIndex } = evt;
      if (newIndex == null || oldIndex == null) return;
      const container = containerRef.current;
      if (!container) return;

      // Clear previous highlights
      clearDropHighlights();

      // Resolve the card element at newIndex among visible items
      const cards = container.querySelectorAll('.profile-card-container');
      const targetElement = cards && cards[newIndex];
      if (!targetElement) return;
      // highlight the element's new position in the list
      targetElement.classList.add('drop-highlight');
    },
    [clearDropHighlights],
  );

  const onDragEnd = useCallback(
    evt => {
      setIsDragging(false);

      // Clear any drop highlights
      clearDropHighlights();

      const { oldIndex, newIndex, oldIndicies } = evt;
      if (oldIndex === newIndex) return;

      setProfiles(prev => {
        const displayedProfiles = prev.filter(p =>
          activeTab === 'utility' ? p.utility : !p.utility,
        );

        const movedItems = (
          oldIndicies && oldIndicies.length > 0 ? oldIndicies : [{ index: oldIndex }]
        )
          .map(({ index }) => displayedProfiles[index])
          .filter(Boolean); // filter all falsey

        if (movedItems.length === 0) return prev;

        const movedIds = new Set(movedItems.map(p => p.id));
        const remainingVisible = displayedProfiles.filter(p => !movedIds.has(p.id));

        const insertAt = Math.min(newIndex, remainingVisible.length);
        const reorderedVisible = [
          ...remainingVisible.slice(0, insertAt),
          ...movedItems,
          ...remainingVisible.slice(insertAt),
        ];

        const next =
          activeTab === 'utility'
            ? [...prev.filter(p => !p.utility), ...reorderedVisible]
            : [...reorderedVisible, ...prev.filter(p => p.utility)];

        persistProfileOrder(next);
        return next;
      });
    },
    [activeTab, clearDropHighlights, persistProfileOrder],
  );

  // Sorting via SortableJS
  useEffect(() => {
    if (loading || !containerRef.current) return;

    const isFiltered = !!searchTerm.trim();

    const sortable = Sortable.create(containerRef.current, {
      multiDrag: true,
      selectedClass: 'profile-list-drag-selected-item',
      animation: 150,
      handle: '.drag-handle',
      disabled: isFiltered,
      onStart: onDragStart,
      onChange: onDragChange,
      onEnd: onDragEnd,
    });

    return () => {
      sortable.destroy();
    };
  }, [loading, searchTerm, onDragStart, onDragChange, onDragEnd]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const loadData = async () => {
      if (connected.value) {
        await loadProfiles();
      }
    };
    loadData();
  }, [connected.value]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:delete', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSelect = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:select', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onFavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:favorite', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onUnfavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:unfavorite', id });
      await loadProfiles();
    },
    [apiService, setLoading],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onDuplicate = useCallback(
    async id => {
      setLoading(true);
      const original = profiles.find(p => p.id === id);
      if (original) {
        const copy = { ...original };
        delete copy.id;
        delete copy.selected;
        delete copy.favorite;
        copy.label = `${original.label} Copy`;
        await apiService.request({ tp: 'req:profiles:save', profile: copy });
      }
      await loadProfiles();
    },
    [apiService, profiles, setLoading],
  );

  const onExport = useCallback(() => {
    const exportedProfiles = profiles.map(p => {
      const ep = {
        ...p,
      };
      delete ep.id;
      delete ep.selected;
      delete ep.favorite;
      return ep;
    });

    downloadJson(exportedProfiles, 'profiles.json');
  }, [profiles]);

  const onUpload = function (evt) {
    if (evt.target.files.length) {
      const file = evt.target.files[0];
      const reader = new FileReader();
      reader.onload = async e => {
        const result = e.target.result;
        if (typeof result === 'string') {
          setLoading(true);
          try {
            const profiles = parseProfile(result);
            for (const p of profiles) {
              await apiService.request({ tp: 'req:profiles:save', profile: p });
            }
          } catch {
            // Individual save errors are surfaced by WS timeout; continue to reload list.
          }
          await loadProfiles();
        }
      };
      reader.readAsText(file);
    }
  };

  const onClear = useCallback(async () => {
    setLoading(true);
    for (const p of profiles) {
      if (!p.selected) {
        await apiService.request({ tp: 'req:profiles:delete', id: p.id });
      }
    }
    await loadProfiles();
  }, [profiles, apiService]);

  if (loading) {
    return (
      <div
        className='flex w-full flex-row items-center justify-center py-16'
        role='status'
        aria-live='polite'
        aria-label='Loading profiles'
      >
        <Spinner size={8} />
      </div>
    );
  }

  return (
    <div className='mx-auto w-full max-w-4xl'>
      <div className='mb-3 flex items-center justify-between gap-3'>
        <h1 className='bm-page-title'>Profiles</h1>
        <a href='/profiles/new' className='btn btn-outline gap-1'>
          <Icon name='plus' />
          New profile
        </a>
      </div>

      <div className='mb-2 flex items-center gap-1'>
        <label className='input min-w-0 flex-1'>
          <Icon name={'search'} />
          <input
            type='text'
            placeholder='Search...'
            aria-label='Search profiles'
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
            }}
            className='grow'
          />
        </label>
        <ProfilesMenu onExport={onExport} onClear={onClear} />
        <input
          onChange={onUpload}
          className='hidden'
          id='profileImport'
          type='file'
          accept='.json,application/json,.tcl'
          aria-label='Select a JSON file containing profile data to import'
        />
      </div>
      {hasUtilityProfiles && (
        <div role='tablist' className='tabs tabs-border mb-4'>
          <button
            role='tab'
            className={`tab ${activeTab === 'extraction' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('extraction')}
            aria-label='Switch to extraction tab'
          >
            Extraction
          </button>
          <button
            role='tab'
            className={`tab ${activeTab === 'utility' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('utility')}
            aria-label='Switch to utility tab'
          >
            Utility
          </button>
        </div>
      )}
      <div
        className='grid grid-cols-1 gap-2 lg:grid-cols-12'
        role='list'
        aria-label='Profile list'
        ref={containerRef}
      >
        {profilesToShow
          .filter(p => (activeTab === 'utility' ? p.utility : !p.utility))
          .map((data, idx, filtered) => (
            <ProfileCard
              key={data.id}
              data={data}
              onDelete={onDelete}
              onSelect={onSelect}
              favoriteDisabled={favoriteDisabled}
              unfavoriteDisabled={unfavoriteDisabled}
              onUnfavorite={onUnfavorite}
              onFavorite={onFavorite}
              onDuplicate={onDuplicate}
              disabledDrag={!!searchTerm.trim()}
              isDragging={isDragging}
              onMoveTop={moveProfileTop}
              onMoveBottom={moveProfileBottom}
              isFirst={idx === 0}
              isLast={idx === filtered.length - 1}
            />
          ))}
      </div>
    </div>
  );
}
