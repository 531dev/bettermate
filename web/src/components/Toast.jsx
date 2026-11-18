import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { cx } from './cx.js';
import { usePresence } from './motion.js';

// ── Announcements ────────────────────────────────────────────────────────────────────────────
// One visually hidden status region and one alert region, both in the page from the start
// (Accessibility, What a screen reader hears). A status message is one short sentence; at most one
// is written every two seconds, and a newer one replaces one that is still waiting.

const STATUS_GAP_MS = 2000;
const said = signal({ status: '', alert: '' });
let lastStatus = 0;
let waiting = null;
let waitTimer = 0;

function write(kind, text) {
  // Emptied first, so the same sentence twice is still heard twice.
  said.value = { ...said.value, [kind]: '' };
  requestAnimationFrame(() => (said.value = { ...said.value, [kind]: text }));
}

/**
 * Says one sentence to a screen reader without moving focus. `alert` interrupts: only a fault and
 * the loss of the connection do.
 */
export function announce(text, { alert = false } = {}) {
  if (!text) return;
  if (alert) {
    write('alert', text);
    return;
  }
  const wait = lastStatus + STATUS_GAP_MS - Date.now();
  if (wait <= 0) {
    lastStatus = Date.now();
    write('status', text);
    return;
  }
  waiting = text;
  clearTimeout(waitTimer);
  waitTimer = setTimeout(() => {
    lastStatus = Date.now();
    write('status', waiting);
    waiting = null;
  }, wait);
}

/** The two live regions. Rendered once by the shell, outside everything that comes and goes. */
export function LiveRegions() {
  const { status, alert } = said.value;
  return (
    <>
      <div role='status' aria-live='polite' className='bm-sr' id='bm-status'>
        {status}
      </div>
      <div role='alert' className='bm-sr' id='bm-alert'>
        {alert}
      </div>
    </>
  );
}

// ── Toasts ───────────────────────────────────────────────────────────────────────────────────

const STAY_MS = 5000;
const STAY_ACTION_MS = 8000;
const current = signal(null);
let serial = 0;

/**
 * Something just happened and nothing needs doing: "Profile saved". One at a time; a new one
 * replaces the one on screen. It stays 5 s, or 8 s with an action, and waits while hovered or
 * focused. Its words also go to the status region (or the alert region for a failure), so it never
 * takes focus. A failure is never only a Toast: the field or a Notice keeps saying it.
 *   text    a fact in the past tense, at most 32 characters, no full stop
 *   action  { label, onClick }: one word, also reachable some other way
 *   alert   a failure
 */
export function toast(text, { action, alert = false } = {}) {
  serial += 1;
  current.value = { id: serial, text, action, alert };
  announce(text, { alert });
}

/** The one Toast region, at the bottom centre above the mode bar. */
export function Toasts() {
  const item = current.value;
  // The last Toast stays drawn while it leaves.
  const last = useRef(item);
  if (item) last.current = item;
  const { mounted, shown } = usePresence(!!item);
  const paused = useRef(null);
  const timer = useRef(0);

  useEffect(() => {
    if (!item) return undefined;
    let left = item.action ? STAY_ACTION_MS : STAY_MS;
    let from = Date.now();
    const run = () => {
      clearTimeout(timer.current);
      from = Date.now();
      timer.current = setTimeout(() => {
        if (current.value === item) current.value = null;
      }, left);
    };
    const pause = () => {
      clearTimeout(timer.current);
      left = Math.max(1000, left - (Date.now() - from));
    };
    paused.current = { run, pause };
    run();
    return () => clearTimeout(timer.current);
  }, [item]);

  const hold = () => paused.current?.pause?.();
  const release = event => {
    // Moving from the Toast to its own button is not leaving it.
    if (event?.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
    paused.current?.run?.();
  };

  const show = last.current;
  return (
    <div className='bm-toasts'>
      {mounted && show && (
        <div
          key={show.id}
          className={cx(
            'bm-toast',
            show.action && 'bm-toast--action',
            item ? shown && 'is-open' : 'is-leaving',
          )}
          onMouseEnter={hold}
          onMouseLeave={release}
          onFocusIn={hold}
          onFocusOut={release}
        >
          <span className='min-w-0 flex-1'>{show.text}</span>
          {show.action && (
            <button
              type='button'
              className='bm-btn bm-btn--quiet'
              onClick={() => {
                current.value = null;
                show.action.onClick();
              }}
            >
              {show.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
