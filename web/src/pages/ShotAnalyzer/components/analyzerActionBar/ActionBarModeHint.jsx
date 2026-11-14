/* global globalThis */

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Popover } from '../../ui/Popover.jsx';

const MODE_HINT_MS = 4200;

const MODE_HINTS = {
  browser: {
    title: 'Save to browser',
    body: 'Imported shots and profiles are now saved to the browser library.',
  },
  temp: {
    title: 'View temporarily',
    body: 'Imported shots and profiles now open in the analyzer without being saved.',
  },
};

/** What the import mode just became, said once under the control that changed it. */
export function ModeHint({ hint, anchor, onClose }) {
  const copy = MODE_HINTS[hint] || MODE_HINTS.temp;

  return (
    <Popover
      open={Boolean(hint)}
      onClose={onClose}
      anchor={anchor}
      placement='bottom-end'
      role='status'
      label={copy.title}
      width='min(22rem, calc(100vw - 24px))'
      className='an-libbar-hint'
    >
      <span className='an-label'>{copy.title}</span>
      <span className='bm-help'>{copy.body}</span>
    </Popover>
  );
}

/**
 * Changes the import mode and says what it became for a few seconds, under the control that
 * changed it. `changeMode(nextMode, anchorElement)`.
 */
export function useAnalyzerActionBarModeHint({ onImportModeChange }) {
  const anchor = useRef(null);
  const timer = useRef(null);
  const [hint, setHint] = useState('');

  const clearTimer = useCallback(() => {
    if (timer.current) {
      globalThis.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const closeHint = useCallback(() => {
    clearTimer();
    setHint('');
  }, [clearTimer]);

  const changeMode = useCallback(
    (nextMode, anchorElement) => {
      if (!onImportModeChange) return;
      const mode = nextMode === 'browser' ? 'browser' : 'temp';
      anchor.current = anchorElement || null;
      onImportModeChange(mode);
      clearTimer();
      setHint(anchor.current ? mode : '');
      timer.current = globalThis.setTimeout(() => setHint(''), MODE_HINT_MS);
    },
    [clearTimer, onImportModeChange],
  );

  useEffect(() => clearTimer, [clearTimer]);

  return { hint, hintAnchor: anchor, changeMode, closeHint };
}
