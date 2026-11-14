// Shared formatting helpers for Statistics components.

/** A missing value, as the design writes it. */
export const MISSING = '—';

export function fmt(val, digits = 1) {
  return Number.isFinite(val) ? val.toFixed(digits) : MISSING;
}

/** A signed difference: '+0.3', '-1.2'. Null when there is none. */
export function fmtDelta(val, digits = 1) {
  if (!Number.isFinite(val)) return null;
  return `${val >= 0 ? '+' : ''}${val.toFixed(digits)}`;
}
