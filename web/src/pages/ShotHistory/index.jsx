import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computed } from '@preact/signals';
import { Button } from '../../components/Button.jsx';
import { Input, Select } from '../../components/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { List } from '../../components/ListRow.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import PageLayout from '../../components/PageLayout.jsx';
import { Segmented } from '../../components/Segmented.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { Tile } from '../../components/Tile.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { parseBinaryIndex, indexToShotList } from './parseBinaryIndex.js';
import { parseBinaryShot } from './parseBinaryShot.js';
import { ShotRow } from './ShotRow.jsx';

const connected = computed(() => machine.value.connected);

const ITEMS_PER_PAGE = 10;

const SORTS = [
  ['date-desc', 'Newest first'],
  ['date-asc', 'Oldest first'],
  ['rating-desc', 'Highest rated'],
  ['rating-asc', 'Lowest rated'],
  ['profile-asc', 'Profile A to Z'],
  ['profile-desc', 'Profile Z to A'],
  ['duration-desc', 'Longest shot'],
  ['duration-asc', 'Shortest shot'],
  ['volume-desc', 'Highest yield'],
  ['volume-asc', 'Lowest yield'],
  ['id-desc', 'Highest ID'],
  ['id-asc', 'Lowest ID'],
];

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'rated', label: 'Rated' },
  { value: 'unrated', label: 'Unrated' },
];

// A machine that never got the time stamps its shots near zero.
const hasDate = shot => shot.timestamp >= 10000;
const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Today, Yesterday, then the date; the year only once it is not this one. Calendar days, not
// spans of 24 hours, so a shot from 11:59 PM yesterday reads as Yesterday.
function dayLabel(shot, month = 'long') {
  if (!hasDate(shot)) return month === 'long' ? 'No date' : '—';
  const date = new Date(shot.timestamp * 1000);
  const today = new Date();
  const daysAgo = Math.round((startOfDay(today) - startOfDay(date)) / 86400000);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString([], {
    weekday: month === 'long' ? 'long' : undefined,
    day: 'numeric',
    month,
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

const timeLabel = shot =>
  hasDate(shot)
    ? new Date(shot.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

/**
 * The tiles of a page of shots. In an order by date, shots that follow each other on one day
 * share a tile named for the day and show their time; in any other order the days no longer sort
 * the list, so it is one tile named for the order and every row shows its day.
 */
function groupShots(shots, sortBy, sortLabel) {
  if (sortBy !== 'date' && sortBy !== 'id') {
    return [{ key: sortBy, label: sortLabel, when: shot => dayLabel(shot, 'short'), shots }];
  }
  const groups = [];
  for (const shot of shots) {
    const label = dayLabel(shot);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.shots.push(shot);
    else groups.push({ key: `${label} ${shot.id}`, label, when: timeLabel, shots: [shot] });
  }
  return groups;
}

// Under 600px a row has no room for its facts and the time side by side.
const PHONE = '(max-width: 599.98px)';
function usePhoneWidth() {
  const [matches, setMatches] = useState(() => window.matchMedia(PHONE).matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE);
    const onChange = () => setMatches(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return matches;
}

export function ShotHistory() {
  const apiService = useContext(ApiServiceContext);
  const compact = usePhoneWidth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, rating, profile, duration, volume, id
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [filterBy, setFilterBy] = useState('all'); // all, rated, unrated
  const [currentPage, setCurrentPage] = useState(1);
  const loadHistoryAbortRef = useRef(null);
  const loadHistory = async () => {
    // Abort any in-flight fetch to prevent request pileup on the ESP32.
    loadHistoryAbortRef.current?.abort();
    const controller = new AbortController();
    loadHistoryAbortRef.current = controller;

    try {
      // Fetch binary index instead of websocket request
      const response = await fetch('/api/history/index.bin', { signal: controller.signal });
      if (!response.ok) {
        if (response.status === 404) {
          // Index doesn't exist, show empty list with option to rebuild
          console.log('Shot index not found. You may need to rebuild it if shots exist.');
          setHistory([]);
          setLoading(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const indexData = parseBinaryIndex(arrayBuffer);
      const shotList = indexToShotList(indexData);

      // Preserve loaded state and data from existing shots
      setHistory(prev => {
        const existingMap = new Map(prev.map(shot => [shot.id, shot]));
        return shotList.map(newShot => {
          const existing = existingMap.get(newShot.id);
          if (existing && existing.loaded) {
            // Preserve loaded data but update metadata from index
            return {
              ...existing,
              // Update metadata that might have changed (like rating and volume)
              rating: newShot.rating,
              volume: newShot.volume,
              incomplete: newShot.incomplete,
            };
          }
          return newShot;
        });
      });
      setLoading(false);
    } catch (error) {
      if (error.name === 'AbortError') return; // Intentional abort, not an error.
      console.error('Failed to load shot history:', error);
      setHistory([]);
      setLoading(false);
    }
  };
  const isConnected = connected.value;
  useEffect(() => {
    if (isConnected) {
      loadHistory();
    }
    return () => loadHistoryAbortRef.current?.abort();
    // loadHistory only touches refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const onDelete = useCallback(
    async id => {
      setLoading(true);
      await apiService.request({ tp: 'req:history:delete', id });
      // Reload the index after deletion
      await loadHistory();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiService],
  );

  const onNotesChanged = useCallback(async () => {
    // Reload the index to get updated ratings
    await loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLoad = useCallback(
    async id => {
      // Fetch binary only if not loaded
      const target = history.find(h => h.id === id);
      if (!target || target.loaded) return;
      const merge = fields =>
        setHistory(prev => prev.map(h => (h.id === id ? { ...h, ...fields(h) } : h)));
      try {
        // Pad ID to 6 digits with zeros to match backend filename format
        const paddedId = id.padStart(6, '0');
        const resp = await fetch(`/api/history/${paddedId}.slog`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const buf = await resp.arrayBuffer();
        const parsed = parseBinaryShot(buf, id);
        parsed.incomplete = (target?.incomplete ?? false) || parsed.incomplete;
        if (target?.notes) parsed.notes = target.notes;
        merge(h => ({
          ...parsed,
          // Preserve index metadata over shot file data
          volume: h.volume ?? parsed.volume, // Use index volume if available, fallback to shot volume
          rating: h.rating ?? parsed.rating, // Use index rating if available
          incomplete: h.incomplete ?? parsed.incomplete,
          loaded: true,
          loadFailed: false,
        }));
      } catch (e) {
        console.error('Failed loading shot', e);
        merge(() => ({ loadFailed: true }));
      }
    },
    [history],
  );

  // Filtered and sorted history with pagination
  const { paginatedHistory, totalPages, totalFilteredItems } = useMemo(() => {
    let filtered = history;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        shot => shot.profile?.toLowerCase().includes(search) || shot.id.toString().includes(search),
      );
    }

    // Apply status filter
    switch (filterBy) {
      case 'rated':
        filtered = filtered.filter(shot => shot.rating && shot.rating > 0);
        break;
      case 'unrated':
        filtered = filtered.filter(shot => !shot.rating || shot.rating === 0);
        break;
      default: // 'all'
        break;
    }

    // Apply sorting, on a copy: with no search and no filter this is still the loaded list
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'profile':
          comparison = (a.profile || '').localeCompare(b.profile || '');
          break;
        case 'duration':
          comparison = a.duration - b.duration;
          break;
        case 'volume':
          comparison = (a.volume || 0) - (b.volume || 0);
          break;
        case 'id':
          comparison = parseInt(a.id, 10) - parseInt(b.id, 10);
          break;
        case 'date':
        default:
          if (hasDate(a) && hasDate(b)) {
            comparison = a.timestamp - b.timestamp;
          } else if (hasDate(a)) {
            comparison = 1;
          } else if (hasDate(b)) {
            comparison = -1;
          } else {
            comparison = parseInt(a.id, 10) - parseInt(b.id, 10);
          }
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    const totalFilteredItems = filtered.length;
    const totalPages = Math.ceil(totalFilteredItems / ITEMS_PER_PAGE);

    // Apply pagination
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedHistory = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return { paginatedHistory, totalPages, totalFilteredItems };
  }, [history, searchTerm, filterBy, sortBy, sortOrder, currentPage]);

  // Deleting the last shot of the last page leaves that page empty: step back to one that exists.
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const sort = `${sortBy}-${sortOrder}`;
  const sortLabel = SORTS.find(([value]) => value === sort)?.[1];
  const groups = groupShots(paginatedHistory, sortBy, sortLabel);
  const narrowed = searchTerm.trim() || filterBy !== 'all';
  const showAll = () => {
    setSearchTerm('');
    setFilterBy('all');
    setCurrentPage(1);
  };

  // At most five page numbers, around the current one.
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => firstPage + i);

  return (
    <PageLayout variant='narrow'>
      <PageHeader
        title='Shot history'
        tabs={
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <a href='/analyzer' className='bm-link'>
              Analyzer
            </a>
            <a href='/statistics' className='bm-link'>
              Statistics
            </a>
            {history.length > 0 && (
              <span className='bm-data ml-auto'>
                {narrowed && `${totalFilteredItems} of `}
                {history.length} {history.length === 1 ? 'shot' : 'shots'}
              </span>
            )}
          </div>
        }
      />

      {history.length > 0 && (
        <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center'>
          <Input
            type='text'
            className='sm:flex-1'
            placeholder='Search shots'
            aria-label='Search shots'
            value={searchTerm}
            onInput={e => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to page 1 when searching
            }}
          />
          <Select
            className='w-40 sm:order-last sm:w-44'
            aria-label='Sort shots'
            value={sort}
            onChange={e => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
              setCurrentPage(1); // Reset to page 1 when sorting
            }}
          >
            {SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Segmented
            label='Filter shots'
            className='col-span-2 max-sm:flex max-sm:*:flex-1'
            options={FILTERS}
            value={filterBy}
            onChange={value => {
              setFilterBy(value);
              setCurrentPage(1); // Reset to page 1 when filtering
            }}
          />
        </div>
      )}

      {loading && history.length === 0 ? (
        <div className='flex justify-center py-16' aria-label='Loading shots'>
          <Spinner size={8} />
        </div>
      ) : history.length === 0 ? (
        <Tile>
          <h2 className='bm-sub'>No shots yet</h2>
          <p className='bm-help'>Pull a shot and it shows up here.</p>
        </Tile>
      ) : totalFilteredItems === 0 ? (
        <Tile>
          <h2 className='bm-sub'>No shots match</h2>
          <p className='bm-help'>The search looks at profile names and shot numbers.</p>
          <Button className='self-start' onClick={showAll}>
            Show all shots
          </Button>
        </Tile>
      ) : (
        groups.map(group => (
          <Tile key={group.key} eyebrow={group.label} aria-busy={loading}>
            <List>
              {group.shots.map(shot => (
                <ShotRow
                  key={shot.id}
                  shot={shot}
                  when={group.when(shot)}
                  compact={compact}
                  onDelete={onDelete}
                  onNotesChanged={onNotesChanged}
                  onLoad={onLoad}
                />
              ))}
            </List>
          </Tile>
        ))
      )}

      {totalPages > 1 && (
        <nav className='flex items-center justify-center gap-2 pt-2' aria-label='Pages of shots'>
          <Button
            iconOnly
            aria-label='Previous page'
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <Icon name='chevron-left' />
          </Button>
          <Segmented
            label='Page'
            options={pages.map(page => ({ value: page, label: String(page) }))}
            value={currentPage}
            onChange={setCurrentPage}
          />
          <Button
            iconOnly
            aria-label='Next page'
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <Icon name='chevron-right' />
          </Button>
        </nav>
      )}
    </PageLayout>
  );
}
