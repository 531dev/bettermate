import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { useSignalEffect } from '@preact/signals';
import { ApiServiceContext } from '../../services/ApiService.js';
import { recentShotCountSignal } from '../../utils/dashboardManager.js';
import { parseBinaryIndex, indexToShotList } from '../ShotHistory/parseBinaryIndex.js';

async function loadRecentShots(count) {
  // Same binary format as index.bin, truncated server-side to the newest entries.
  const resp = await fetch(`/api/history/recent.bin?limit=${count}`);
  if (!resp.ok) return [];
  const buf = await resp.arrayBuffer();
  return indexToShotList(parseBinaryIndex(buf)).slice(0, count);
}

/**
 * The newest shots in the history, newest first. `loading` is true only until the first answer:
 * a later refresh swaps the list when it arrives, so the rows never blank.
 */
export function useRecentShots(enabled = true) {
  const apiService = useContext(ApiServiceContext);
  const [shots, setShots] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [refreshKey, setRefreshKey] = useState(0);
  const countMountedRef = useRef(false);

  // Trigger a refresh once the firmware confirms a shot was actually
  // persisted to history. Brew-process state (isActive/isFinished) can go
  // inactive well before extended recording (BLE scale weight settling)
  // finishes writing the entry, so we listen for the explicit save event
  // instead of inferring timing from process state.
  useEffect(() => {
    if (!apiService || !enabled) return undefined;
    const listenerId = apiService.on('evt:history-shot-saved', () => {
      setRefreshKey(k => k + 1);
    });
    return () => apiService.off('evt:history-shot-saved', listenerId);
  }, [apiService, enabled]);

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
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    loadRecentShots(recentShotCountSignal.value)
      .then(list => {
        if (!cancelled) setShots(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, enabled]);

  return { shots, loading };
}
