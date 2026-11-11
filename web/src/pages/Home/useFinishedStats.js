import { useContext, useEffect, useState } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';
import { parseBinaryIndex, indexToShotList } from '../ShotHistory/parseBinaryIndex.js';

// Max pressure and average flow of the shot that just finished.
export function useFinishedStats({ isActive, isFinished, isBrewing }) {
  const apiService = useContext(ApiServiceContext);
  const [finishedStats, setFinishedStats] = useState(null);

  // Always mounted (unlike the finished view itself), so this can't miss the
  // event if it arrives before the next status update flips isFinished true.
  useEffect(() => {
    if (!apiService) return;
    const listenerId = apiService.on('evt:shot-finished-stats', msg => {
      setFinishedStats({
        maxPressure: msg.maxPressure > 0 ? msg.maxPressure : null,
        avgFlow: msg.avgFlow > 0 ? msg.avgFlow : null,
      });
    });
    return () => apiService.off('evt:shot-finished-stats', listenerId);
  }, [apiService]);

  // Clear stale stats the moment a new shot starts, so a missed/dropped
  // websocket message can never leave a previous shot's numbers visible.
  useEffect(() => {
    if (isActive) setFinishedStats(null);
  }, [isActive]);

  // Fallback for a page reload landing directly on an already-finished shot:
  // the live evt:shot-finished-stats event only fires once, at the moment the
  // shot stopped, so a fresh mount never receives it. The recent-shots index
  // always has the same stats for the most recently completed shot.
  useEffect(() => {
    if (!isFinished || !isBrewing || finishedStats !== null) return;
    let cancelled = false;
    fetch('/api/history/recent.bin?limit=1')
      .then(resp => (resp.ok ? resp.arrayBuffer() : null))
      .then(buf => {
        if (cancelled || !buf) return;
        const [latest] = indexToShotList(parseBinaryIndex(buf));
        if (latest) {
          setFinishedStats({ maxPressure: latest.maxPressure, avgFlow: latest.avgFlow });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFinished, isBrewing, finishedStats]);

  return finishedStats;
}
