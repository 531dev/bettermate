export const MODES = [
  { id: 0, icon: 'power', label: 'Standby' },
  { id: 1, icon: 'coffee', label: 'Brew' },
  { id: 2, icon: 'wind', label: 'Steam' },
  { id: 3, icon: 'droplet', label: 'Water' },
  { id: 4, icon: 'bean', label: 'Grind' },
];

export const fmtElapsed = (ms = 0) => {
  const secs = Math.floor(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export const fmtPhaseTarget = (p, grind) => {
  if (p?.tt === 'time') return `${(p.pt / 1000).toFixed(0)}s`;
  if (p?.tt === 'volumetric') return `${p.pt.toFixed(grind ? 1 : 0)}g`;
  return '';
};

export const getPhaseLabel = (p, grind) => {
  if (grind) return 'Grinding';
  if (p?.s === 'brew') return 'Infusion';
  return 'Preinfusion';
};

export const getPrimaryIcon = (active, finished) => {
  if (active) return 'pause';
  if (finished) return 'check';
  return 'play';
};

export const getPrimaryLabel = (active, finished) => {
  if (active) return 'Pause';
  if (finished) return 'Finish';
  return 'Start';
};
