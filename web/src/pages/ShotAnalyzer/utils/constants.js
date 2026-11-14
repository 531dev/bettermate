export const ANALYZER_DB_KEYS = {
  SHOTS: 'gaggimate_shots',
  PROFILES: 'gaggimate_profiles',
  PRESETS: 'gaggimate_column_presets',
  USER_STANDARD: 'gaggimate_user_standard_cols',
  SINGLE_CHART_VISIBILITY: 'gaggimate_single_chart_visibility',
  COMPARE_TARGET_DISPLAY_MODE: 'gaggimate_compare_target_display_mode',
  COMPARE_ANNOTATIONS_ENABLED: 'gaggimate_compare_annotations_enabled',
  COMPARE_CHART_VISIBILITY: 'gaggimate_compare_chart_visibility',
  LIBRARY_SHOTS_SOURCE_FILTER: 'gaggimate_library_shots_source_filter',
  LIBRARY_PROFILES_SOURCE_FILTER: 'gaggimate_library_profiles_source_filter',
  PINNED_PROFILES: 'gaggimate_pinned_profiles',
  PINNED_SHOTS_BY_PROFILE: 'gaggimate_pinned_shots_by_profile',
};

export const MAX_PINNED_PROFILES = 10;
export const MAX_PINNED_SHOTS_PER_PROFILE = 3;
export const PINNED_NO_PROFILE_BUCKET = '__no_profile__';

export const COMPARE_TARGET_DISPLAY_MODES = {
  NONE: 'none',
  PER_SHOT: 'perShot',
  MAIN_SHOT_ONLY: 'mainShotOnly',
};

export const MAX_AUTO_DETECTED_DOSE_GRAMS = 30;

export const TIMESTAMP_SECONDS_THRESHOLD = 10_000_000_000;

export const groups = {
  basics: 'Basic Metrics',
  pressure: 'Pressure (bar)',
  target_pressure: 'Target Pressure (bar)',
  flow: 'Pump Flow (ml/s)',
  target_flow: 'Target Pump Flow (ml/s)',
  puckflow: 'Puck Flow (ml/s)',
  puckresistance: 'Puck Resistance (s·√bar/mL)',
  liquidresistance: 'Liquid Resistance (bar·s/mL)',
  temp: 'Temperature (℃)',
  target_temp: 'Target Temp (℃)',
  weight: 'Weight (g)',
  weightflow: 'Weight Flow (g/s)',
  system: 'System Info',
};

// Transitional: callers that still import these read plain tokens. Warnings are `warning`
// notices and Chips, a stop is a fact in ink, and a source is told by its glyph and word.
export const utilityColors = {
  stopRed: 'var(--analyzer-stop)',
  warningOrange: 'var(--warning)',
};

export const analyzerUiColors = {
  warningOrange: 'var(--warning)',
  warningOrangeStrong: 'var(--warning)',
  sourceBadgeGmBg: 'var(--surface-2)',
  sourceBadgeGmBorder: 'var(--line)',
  sourceBadgeGmText: 'var(--ink-muted)',
  sourceBadgeWebBg: 'var(--surface-2)',
  sourceBadgeWebBorder: 'var(--line)',
  sourceBadgeWebText: 'var(--ink)',
  brewByTimeLabelBg: 'var(--surface-2)',
  brewByTimeLabelBorder: 'var(--line)',
  brewByTimeLabelText: 'var(--ink-muted)',
  brewByWeightLabelBg: 'var(--surface-2)',
  brewByWeightLabelBorder: 'var(--line)',
  brewByWeightLabelText: 'var(--ink-muted)',
  notesTasteBitter: 'var(--ink)',
  notesTasteBalanced: 'var(--ink)',
  notesTasteSour: 'var(--ink)',
  phaseLine: 'var(--analyzer-phase)',
  stopLabel: 'var(--analyzer-stop)',
};

export const getNotesTasteStyle = () => null;

// The mark colour of each column group: a series token, or neutral ink for facts.
export const groupColors = {
  basics: { anchor: 'var(--ink-muted)' },
  pressure: { anchor: 'var(--analyzer-pressure)' },
  target_pressure: { anchor: 'var(--analyzer-pressure)' },
  flow: { anchor: 'var(--analyzer-flow)' },
  target_flow: { anchor: 'var(--analyzer-flow)' },
  puckflow: { anchor: 'var(--analyzer-puck-flow)' },
  puckresistance: { anchor: 'var(--analyzer-puck-resistance)' },
  liquidresistance: { anchor: 'var(--analyzer-liquid-resistance)' },
  temp: { anchor: 'var(--analyzer-temperature)' },
  target_temp: { anchor: 'var(--analyzer-temperature)' },
  weight: { anchor: 'var(--analyzer-weight)' },
  weightflow: { anchor: 'var(--analyzer-weight-flow)' },
  system: { anchor: 'var(--ink-muted)' },
};
