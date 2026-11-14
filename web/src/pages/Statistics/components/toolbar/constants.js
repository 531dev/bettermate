// Constants for StatisticsToolbar: source, mode and date-basis options.
export const SOURCE_OPTIONS = [
  { value: 'gaggimate', label: 'Machine' },
  { value: 'browser', label: 'Browser' },
  { value: 'both', label: 'Both' },
];

export const MODE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'profile', label: 'By profile' },
  { value: 'shots', label: 'By shots' },
];

export const DATE_BASIS_OPTIONS = [
  { value: 'shot', label: 'Shot' },
  { value: 'auto', label: 'Auto' },
  { value: 'upload', label: 'Upload' },
];

// Marks a panel the toolbar opened in a portal, so a press inside it is not a press outside the
// toolbar.
export const TOOLBAR_FLOATING_PANEL_ATTR = 'data-statistics-toolbar-floating-panel';

export const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
export const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
