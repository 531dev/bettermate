// Shot and grind time as m:ss.
export const fmtElapsed = (ms = 0) => {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

// What to call a brew phase that has no name of its own.
export const getPhaseLabel = p => (p?.s === 'brew' ? 'Infusion' : 'Preinfusion');

// Profile names can arrive as file names.
export const cleanName = name => (name || '').replace(/\.json$/i, '');
