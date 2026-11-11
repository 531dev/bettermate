import { Icon } from '../../../components/Icon.jsx';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { parseBinaryIndex, indexToShotList } from '../../ShotHistory/parseBinaryIndex.js';
import { ApiServiceContext } from '../../../services/ApiService.js';
import { cleanName } from '../../ShotAnalyzer/utils/analyzerUtils.js';
import {
  shotMetricSlotsSignal,
  clock24hSignal,
  recentShotCountSignal,
} from '../../../utils/dashboardManager.js';
import PropTypes from 'prop-types';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';

// Compares calendar dates, not raw milliseconds, so 11:59 PM yesterday
// correctly reads as "Yesterday" even if less than 24 h ago.
function getRelativeDayLabel(timestamp) {
  if (!timestamp || timestamp < 10000) return '';
  const d = new Date(timestamp * 1000);
  const today = new Date();
  const shotDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayDay - shotDay) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long' });
}

function formatShotDateTime(timestamp, hour12) {
  if (!timestamp || timestamp < 10000) return '';
  return new Date(timestamp * 1000).toLocaleString([], {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
}

function formatShotTime(timestamp, hour12) {
  if (!timestamp || timestamp < 10000) return '';
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
}

async function loadRecentShots(recentShotCount) {
  // Same binary format as index.bin, truncated server-side to the newest entries.
  const resp = await fetch(`/api/history/recent.bin?limit=${recentShotCount}`);
  if (!resp.ok) return [];
  const buf = await resp.arrayBuffer();
  return indexToShotList(parseBinaryIndex(buf)).slice(0, recentShotCount);
}

const METRIC_DEFS = {
  duration: {
    label: 'Duration',
    unit: 's',
    getValue: shot => (shot.duration != null ? (shot.duration / 1000).toFixed(1) : null),
  },
  weight: {
    label: 'Weight',
    unit: 'g',
    getValue: shot => (shot.volume != null ? shot.volume.toFixed(1) : null),
  },
  avgTemp: {
    label: 'Temperature',
    unit: '°C',
    getValue: shot => (shot.avgTemp != null ? shot.avgTemp.toFixed(1) : null),
  },
  maxPressure: {
    label: 'Pressure',
    unit: 'bar',
    getValue: shot => (shot.maxPressure != null ? shot.maxPressure.toFixed(1) : null),
  },
  avgFlow: {
    label: 'Flow',
    unit: 'ml/s',
    getValue: shot => (shot.avgFlow != null ? shot.avgFlow.toFixed(2) : null),
  },
};

function ShotRow({ shot, slots }) {
  const hour12 = !clock24hSignal.value;
  const facts = slots
    .map(slotId => {
      const def = METRIC_DEFS[slotId];
      const value = def ? def.getValue(shot) : null;
      return value == null ? null : `${value} ${def.unit}`;
    })
    .filter(Boolean)
    .join(', ');

  return (
    <li>
      <a
        href={`/analyzer/internal/${shot.id}`}
        className='bm-row'
        aria-label='Open in Analyzer'
        title={formatShotDateTime(shot.timestamp, hour12)}
      >
        <span className='bm-row__icon'>
          <Icon name='coffee' />
        </span>
        <span className='min-w-0 flex-1'>
          <span className='bm-row__title'>{cleanName(shot.profile || 'Unknown')}</span>
          <span className='bm-row__sub'>{facts}</span>
        </span>
        <span className='shrink-0 text-right text-sm leading-5'>
          <span className='block'>{getRelativeDayLabel(shot.timestamp)}</span>
          <span className='block text-[var(--ink-muted)]'>
            {formatShotTime(shot.timestamp, hour12)}
          </span>
        </span>
        <span className='bm-row__arrow'>
          <Icon name='arrow-right' />
        </span>
      </a>
    </li>
  );
}

ShotRow.propTypes = {
  shot: PropTypes.object.isRequired,
  slots: PropTypes.arrayOf(PropTypes.string).isRequired,
};

function ShotRowSkeleton() {
  return (
    <div className='bm-row'>
      <SkeletonBlock className='h-11 w-11 shrink-0 rounded-full' />
      <div className='flex min-w-0 flex-1 flex-col gap-2'>
        <SkeletonBlock className='h-3 w-2/3' />
        <SkeletonBlock className='h-2.5 w-1/2' />
      </div>
    </div>
  );
}

export function RecentShotsCard({ max }) {
  const apiService = useContext(ApiServiceContext);
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const countMountedRef = useRef(false);
  const slots = shotMetricSlotsSignal.value;

  // Trigger a refresh once the firmware confirms a shot was actually
  // persisted to history. Brew-process state (isActive/isFinished) can go
  // inactive well before extended recording (BLE scale weight settling)
  // finishes writing the entry, so we listen for the explicit save event
  // instead of inferring timing from process state.
  useEffect(() => {
    if (!apiService) return;
    const listenerId = apiService.on('evt:history-shot-saved', () => {
      setRefreshKey(k => k + 1);
    });
    return () => apiService.off('evt:history-shot-saved', listenerId);
  }, [apiService]);

  // Trigger a refresh when the count setting changes.
  // Guarded so the initial mount-time subscribe call doesn't itself count as
  // a "change" and trigger a redundant fetch alongside the mount-time fetch
  // already performed by the useEffect below.
  useSignalEffect(() => {
    void recentShotCountSignal.value;
    if (countMountedRef.current) {
      setRefreshKey(k => k + 1);
    } else {
      countMountedRef.current = true;
    }
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const list = await loadRecentShots(recentShotCountSignal.value);
        if (cancelled) return;
        setShots(list);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section className='bm-group' aria-label='Recent shots'>
      <div className='bm-group__head'>
        <h2 className='bm-group__title'>Recent shots</h2>
        <a href='/history' className='bm-link'>
          All shots
        </a>
      </div>
      {loading && (
        <div>
          {Array.from({ length: Math.min(recentShotCountSignal.value, max ?? Infinity) }).map(
            (_, i) => (
              <ShotRowSkeleton key={i} />
            ),
          )}
        </div>
      )}
      {!loading && shots.length === 0 && (
        <p className='text-sm text-[var(--ink-muted)]'>
          No shots yet. Pull a shot and it will show up here.
        </p>
      )}
      {!loading && shots.length > 0 && (
        <ul>
          {shots.slice(0, max).map(shot => (
            <ShotRow key={shot.id} shot={shot} slots={slots} />
          ))}
        </ul>
      )}
    </section>
  );
}

RecentShotsCard.propTypes = {
  max: PropTypes.number,
};
