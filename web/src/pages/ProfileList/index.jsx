import Sortable, { MultiDrag } from 'sortablejs';
try {
  Sortable?.mount(new MultiDrag());
} catch (error) {
  // to avoid error when vite is reloading the page in dev mode
}

import { computed } from '@preact/signals';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Input } from '../../components/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Menu, MenuItem, MenuSeparator } from '../../components/Menu.jsx';
import { prefersReducedMotion, tokenMs } from '../../components/motion.js';
import PageHeader from '../../components/PageHeader.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import { Segmented } from '../../components/Segmented.jsx';
import { Loader } from '../../components/Loader.jsx';
import { Tile } from '../../components/Tile.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { downloadJson } from '../../utils/download.js';
import { ConfirmDialog } from '../../components/Dialog.jsx';
import { ProfileRow } from './ProfileRow.jsx';
import { parseProfile } from './utils.js';

const connected = computed(() => machine.value.connected);

const KINDS = [
  { value: 'extraction', label: 'Extraction' },
  { value: 'utility', label: 'Utility' },
];

export function ProfileList() {
  const apiService = useContext(ApiServiceContext);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  // The list stays on the page while it reloads; only the first load has nothing to show.
  const [loaded, setLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('extraction');
  const [isDragging, setIsDragging] = useState(false);
  const [askClear, setAskClear] = useState(false);
  const containerRef = useRef(null);
  const importRef = useRef(null);
  const favoriteCount = profiles.map(p => (p.favorite ? 1 : 0)).reduce((a, b) => a + b, 0);
  const unfavoriteDisabled = favoriteCount <= 1;
  const favoriteDisabled = favoriteCount >= 10;
  const hasUtilityProfiles = useMemo(() => profiles.some(p => p.utility), [profiles]);

  useEffect(() => {
    if (!hasUtilityProfiles) {
      setActiveTab('extraction');
    }
  }, [hasUtilityProfiles]);

  const loadProfiles = useCallback(async () => {
    const response = await apiService.request({ tp: 'req:profiles:list' });
    setProfiles(response.profiles);
    setLoading(false);
    setLoaded(true);
  }, [apiService]);

  // The order is saved 300 ms after the last move, so a run of moves is one request.
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
  const shownProfiles = profilesToShow.filter(p =>
    activeTab === 'utility' ? p.utility : !p.utility,
  );
  const hasRows = shownProfiles.length > 0;

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
      animation: prefersReducedMotion() ? 0 : tokenMs('--duration-fast', 120),
      handle: '[data-drag-handle]',
      disabled: isFiltered,
      onStart: onDragStart,
      onChange: onDragChange,
      onEnd: onDragEnd,
    });

    return () => {
      sortable.destroy();
    };
    // `hasRows`: the list is not on the page while it is empty.
  }, [loading, searchTerm, hasRows, onDragStart, onDragChange, onDragEnd]);

  // The list loads once the machine answers, and again whenever the connection comes back.
  const isConnected = connected.value;
  useEffect(() => {
    if (isConnected) loadProfiles();
  }, [isConnected, loadProfiles]);

  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:delete', id });
      await loadProfiles();
    },
    [apiService, loadProfiles],
  );

  const onSelect = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:select', id });
      await loadProfiles();
    },
    [apiService, loadProfiles],
  );

  const onFavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:favorite', id });
      await loadProfiles();
    },
    [apiService, loadProfiles],
  );

  const onUnfavorite = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:profiles:unfavorite', id });
      await loadProfiles();
    },
    [apiService, loadProfiles],
  );

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
    [apiService, profiles, loadProfiles],
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
  }, [profiles, apiService, loadProfiles]);

  const search = searchTerm.trim();

  return (
    <PageLayout variant='narrow'>
      <PageHeader
        noStack
        title='Profiles'
        actions={
          <>
            <Menu label='More profile actions' size='sm'>
              <MenuItem icon='upload' onClick={() => importRef.current?.click()}>
                Import
              </MenuItem>
              <MenuItem icon='download' onClick={onExport}>
                Export all
              </MenuItem>
              <MenuSeparator />
              <MenuItem danger onClick={() => setAskClear(true)}>
                Delete all profiles
              </MenuItem>
            </Menu>
            <Button variant='ink' size='sm' href='/profiles/new' aria-label='New profile'>
              <Icon name='plus' size={18} />
              New
            </Button>
          </>
        }
      />

      <Input
        type='text'
        placeholder='Search profiles'
        aria-label='Search profiles'
        value={searchTerm}
        onInput={e => {
          setSearchTerm(e.target.value);
        }}
      />
      <input
        ref={importRef}
        onChange={onUpload}
        className='hidden'
        id='profileImport'
        type='file'
        accept='.json,application/json,.tcl'
        aria-label='Select a JSON file containing profile data to import'
      />

      {hasUtilityProfiles && (
        <Segmented
          label='Profile kind'
          className='self-start'
          options={KINDS}
          value={activeTab}
          onChange={setActiveTab}
        />
      )}

      {!loaded ? (
        <p
          className='flex items-center justify-center gap-3 py-16 text-(--ink-muted)'
          aria-busy='true'
        >
          <Loader size={24} />
          Loading profiles
        </p>
      ) : (
        <Tile aria-busy={loading}>
          {hasRows ? (
            <div className='bm-list' role='list' aria-label='Profile list' ref={containerRef}>
              {shownProfiles.map((data, idx, filtered) => (
                <ProfileRow
                  key={data.id}
                  data={data}
                  onDelete={onDelete}
                  onSelect={onSelect}
                  favoriteDisabled={favoriteDisabled}
                  unfavoriteDisabled={unfavoriteDisabled}
                  onUnfavorite={onUnfavorite}
                  onFavorite={onFavorite}
                  onDuplicate={onDuplicate}
                  disabledDrag={!!search}
                  isDragging={isDragging}
                  onMoveTop={moveProfileTop}
                  onMoveBottom={moveProfileBottom}
                  isFirst={idx === 0}
                  isLast={idx === filtered.length - 1}
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <>
              <h2 className='bm-sub'>No profiles yet</h2>
              <p className='bm-help'>Create one with New, or import a profile file.</p>
              <Button className='self-start' onClick={() => importRef.current?.click()}>
                <Icon name='upload' size={18} />
                Import
              </Button>
            </>
          ) : search ? (
            <>
              <h2 className='bm-sub'>No profiles match “{search}”</h2>
              <p className='bm-help'>The search looks at names and descriptions.</p>
              <Button className='self-start' onClick={() => setSearchTerm('')}>
                Clear search
              </Button>
            </>
          ) : (
            <p className='bm-help'>No {activeTab} profiles yet.</p>
          )}
        </Tile>
      )}
      <ConfirmDialog
        open={askClear}
        onClose={() => setAskClear(false)}
        onConfirm={onClear}
        title='Delete all profiles?'
        body='Every profile is removed from the machine. Shots stay in History.'
        confirmLabel='Delete all'
      />
    </PageLayout>
  );
}
