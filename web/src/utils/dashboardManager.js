import { signal } from '@preact/signals';

/* global globalThis */

// What the dashboard remembers on this device. Every setting is one localStorage key, read once
// into a signal. The keys and their values are those of earlier releases; the settings the tile
// layout has no use for (one joined column, compact and pinned panels, reading columns) are no
// longer read, and their stored values are left alone.

const store = () => globalThis.window?.localStorage;

const read = key => {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    store().setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const readList = (key, fallback) => {
  try {
    const list = JSON.parse(read(key));
    return Array.isArray(list) ? list : [...fallback];
  } catch {
    return [...fallback];
  }
};

const readNumber = (key, fallback, low, high) => {
  const n = Number.parseInt(read(key), 10);
  return Number.isFinite(n) && n >= low && n <= high ? n : fallback;
};

// ── Chart before or after the controls ─────────────────────────────────────

const DASHBOARD_LAYOUT_KEY = 'dashboardLayout';

export const DASHBOARD_LAYOUTS = {
  ORDER_FIRST: 'order-first',
  ORDER_LAST: 'order-last',
};

export const getDashboardLayout = () => read(DASHBOARD_LAYOUT_KEY) || DASHBOARD_LAYOUTS.ORDER_FIRST;

export const dashboardLayoutSignal = signal(getDashboardLayout());

export const setDashboardLayout = layout => {
  if (layout === null || layout === undefined) return false;
  if (!write(DASHBOARD_LAYOUT_KEY, layout)) return false;
  dashboardLayoutSignal.value = layout;
  return true;
};

// ── Readings: which ones, in what order ────────────────────────────────────

const DASHBOARD_METRICS_KEY = 'dashboardMetrics';

const DEFAULT_METRIC_ORDER = ['pressure', 'flow', 'temp', 'weight'];
const DEFAULT_METRIC_ORDER_MOBILE = ['pressure', 'temp', 'weight'];

// Matches narrow portrait phones (max-width) as well as phones rotated into
// landscape, where width grows past the portrait breakpoint but height stays small.
const isMobileViewport = () =>
  !!globalThis.window?.matchMedia(
    '(max-width: 768px), (max-height: 768px) and (orientation: landscape)',
  ).matches;

export const getMetricOrder = () =>
  readList(
    DASHBOARD_METRICS_KEY,
    isMobileViewport() ? DEFAULT_METRIC_ORDER_MOBILE : DEFAULT_METRIC_ORDER,
  );

export const metricOrderSignal = signal(getMetricOrder());

export const setMetricOrder = ids => {
  if (!Array.isArray(ids)) return false;
  if (!write(DASHBOARD_METRICS_KEY, JSON.stringify(ids))) return false;
  metricOrderSignal.value = ids;
  return true;
};

// ── Tiles: which ones, in what order ───────────────────────────────────────

const DASHBOARD_PANELS_KEY = 'dashboardPanels';

// The ids are those of the earlier panels; utils/panelDefinitions.js says which tile each one is.
const DEFAULT_PANEL_ORDER = ['mode', 'action', 'metrics', 'watertank', 'favorites', 'profile'];

export const getPanelOrder = () => readList(DASHBOARD_PANELS_KEY, DEFAULT_PANEL_ORDER);

export const panelOrderSignal = signal(getPanelOrder());

export const setPanelOrder = ids => {
  if (!Array.isArray(ids)) return false;
  if (!write(DASHBOARD_PANELS_KEY, JSON.stringify(ids))) return false;
  panelOrderSignal.value = ids;
  return true;
};

// ── Recent shots ───────────────────────────────────────────────────────────

const DASHBOARD_SHOW_RECENT_SHOTS_KEY = 'dashboardShowRecentShots';

export const getShowRecentShots = () => read(DASHBOARD_SHOW_RECENT_SHOTS_KEY) === 'true';

export const showRecentShotsSignal = signal(getShowRecentShots());

export const setShowRecentShots = value => {
  if (!write(DASHBOARD_SHOW_RECENT_SHOTS_KEY, String(value))) return false;
  showRecentShotsSignal.value = value;
  return true;
};

const DASHBOARD_RECENT_SHOT_COUNT_KEY = 'dashboardRecentShotCount';

export const RECENT_SHOT_COUNT = { MIN: 1, MAX: 8, DEFAULT: 4 };

export const getRecentShotCount = () =>
  readNumber(
    DASHBOARD_RECENT_SHOT_COUNT_KEY,
    RECENT_SHOT_COUNT.DEFAULT,
    RECENT_SHOT_COUNT.MIN,
    RECENT_SHOT_COUNT.MAX,
  );

export const recentShotCountSignal = signal(getRecentShotCount());

export const setRecentShotCount = n => {
  if (!Number.isInteger(n) || n < RECENT_SHOT_COUNT.MIN || n > RECENT_SHOT_COUNT.MAX) return false;
  if (!write(DASHBOARD_RECENT_SHOT_COUNT_KEY, String(n))) return false;
  recentShotCountSignal.value = n;
  return true;
};

// The three facts of a recent shot's row.
const DASHBOARD_SHOT_METRIC_SLOTS_KEY = 'dashboardShotMetricSlots';
const DEFAULT_SHOT_METRIC_SLOTS = ['duration', 'weight', 'maxPressure'];

export const getShotMetricSlots = () =>
  readList(DASHBOARD_SHOT_METRIC_SLOTS_KEY, DEFAULT_SHOT_METRIC_SLOTS);

export const shotMetricSlotsSignal = signal(getShotMetricSlots());

export const setShotMetricSlots = slots => {
  if (!Array.isArray(slots) || slots.length !== 3) return false;
  if (!write(DASHBOARD_SHOT_METRIC_SLOTS_KEY, JSON.stringify(slots))) return false;
  shotMetricSlotsSignal.value = slots;
  return true;
};

// ── Profile curve height ───────────────────────────────────────────────────

const DASHBOARD_PROFILE_CHART_HEIGHT_KEY = 'dashboardProfileChartHeight';

export const PROFILE_CHART_HEIGHT = { MIN: 64, MAX: 256, STEP: 8, DEFAULT: 128 };

export const getProfileChartHeight = () =>
  readNumber(
    DASHBOARD_PROFILE_CHART_HEIGHT_KEY,
    PROFILE_CHART_HEIGHT.DEFAULT,
    PROFILE_CHART_HEIGHT.MIN,
    PROFILE_CHART_HEIGHT.MAX,
  );

export const profileChartHeightSignal = signal(getProfileChartHeight());

export const setProfileChartHeight = n => {
  if (!Number.isInteger(n) || n < PROFILE_CHART_HEIGHT.MIN || n > PROFILE_CHART_HEIGHT.MAX) {
    return false;
  }
  if (!write(DASHBOARD_PROFILE_CHART_HEIGHT_KEY, String(n))) return false;
  profileChartHeightSignal.value = n;
  return true;
};

// ── Clock 24h mirror ───────────────────────────────────────────────────────

export const clock24hSignal = signal(false);

export const setClock24h = value => {
  clock24hSignal.value = !!value;
};

// ── Dashboard view (Simple / Advanced / Customize) ─────────────────────────

const DASHBOARD_MODE_KEY = 'dashboardMode';

export const DASHBOARD_MODES = {
  SIMPLE: 'simple',
  ADVANCED: 'advanced',
  CUSTOM: 'custom',
};

// Simple and Advanced are fixed views: they take these values whatever Customize has stored.
const VIEW_PRESET = {
  recentShotCount: RECENT_SHOT_COUNT.DEFAULT,
  profileChartHeight: PROFILE_CHART_HEIGHT.DEFAULT,
  shotMetricSlots: DEFAULT_SHOT_METRIC_SLOTS,
};

// Binds each preset key to its signal and its stored-customization getter.
const PRESET_BINDINGS = [
  { key: 'recentShotCount', signal: recentShotCountSignal, get: getRecentShotCount },
  { key: 'profileChartHeight', signal: profileChartHeightSignal, get: getProfileChartHeight },
  { key: 'shotMetricSlots', signal: shotMetricSlotsSignal, get: getShotMetricSlots },
];

export const getDashboardMode = () => {
  try {
    const storage = store();
    if (!storage) return DASHBOARD_MODES.SIMPLE;
    const stored = storage.getItem(DASHBOARD_MODE_KEY);
    if (Object.values(DASHBOARD_MODES).includes(stored)) return stored;
    // No view stored yet: keep existing customizations on Customize; new users start on Simple.
    const hasCustomization = Object.keys(storage).some(
      k => k.startsWith('dashboard') && k !== DASHBOARD_MODE_KEY,
    );
    return hasCustomization ? DASHBOARD_MODES.CUSTOM : DASHBOARD_MODES.SIMPLE;
  } catch {
    return DASHBOARD_MODES.SIMPLE;
  }
};

export const dashboardModeSignal = signal(getDashboardMode());

// Points the preset signals at the fixed values (Simple, Advanced) or back at the stored
// customization (Customize). Stored keys are never overwritten, so switching to a fixed view and
// back restores the customization.
const applyDashboardSettings = mode => {
  const custom = mode === DASHBOARD_MODES.CUSTOM;
  for (const binding of PRESET_BINDINGS) {
    const value = custom ? binding.get() : VIEW_PRESET[binding.key];
    binding.signal.value = Array.isArray(value) ? [...value] : value;
  }
};

export const setDashboardMode = mode => {
  if (!Object.values(DASHBOARD_MODES).includes(mode)) return false;
  // If persisting fails the view still applies for this session.
  write(DASHBOARD_MODE_KEY, mode);
  dashboardModeSignal.value = mode;
  applyDashboardSettings(mode);
  return true;
};

// A fixed view may be active from a previous session: apply it on load.
applyDashboardSettings(dashboardModeSignal.value);
