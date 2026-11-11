/**
 * Shared hover styling for Shot Analyzer controls.
 * Keeping the interaction shell centralized helps the table, chart, library,
 * and notes controls feel like one system instead of drifting apart over time.
 */

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

const baseInteractiveClasses =
  'analyzer-touch-control cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30';
const hoverShellClasses = 'hover:bg-base-content/5';

export const ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS = 'h-5 min-h-0';
export const ANALYZER_ACTION_ICON_CLASS = 'text-sm';
export const ANALYZER_ACTION_ICON_STYLE = { width: '14px', height: '14px' };
export const ANALYZER_ACTION_ICON_BUTTON_CLASS = 'h-8 w-8 p-0';
export const ANALYZER_ACTION_GROUP_CLASSES = 'flex items-center gap-1';

const iconToneClasses = {
  neutral: 'text-[var(--ink-muted)] hover:text-primary',
  subtle: 'text-[var(--ink-muted)] hover:text-primary',
  primary: 'text-primary hover:text-primary',
  success: 'text-[var(--ink-muted)] hover:text-[var(--success)]',
  error: 'text-[var(--ink-muted)] hover:text-[var(--danger)]',
};

const textToneClasses = {
  neutral: 'text-[var(--ink-muted)] hover:text-primary',
  primary: 'text-primary hover:text-primary',
  success: 'text-[var(--ink-muted)] hover:text-[var(--success)]',
  error: 'text-[var(--ink-muted)] hover:text-[var(--danger)]',
};

export const joinAnalyzerClasses = (...classes) => joinClasses(...classes);

export function getAnalyzerIconButtonClasses({ tone = 'neutral', className = '' } = {}) {
  return joinClasses(
    'inline-flex items-center justify-center rounded-md',
    baseInteractiveClasses,
    hoverShellClasses,
    iconToneClasses[tone] || iconToneClasses.neutral,
    className,
  );
}

export function getAnalyzerTextButtonClasses({ tone = 'neutral', className = '' } = {}) {
  return joinClasses(
    'inline-flex items-center rounded-md',
    baseInteractiveClasses,
    hoverShellClasses,
    textToneClasses[tone] || textToneClasses.neutral,
    className,
  );
}

export function getAnalyzerSurfaceTriggerClasses({ tone = 'neutral', className = '' } = {}) {
  return joinClasses(
    'analyzer-touch-control cursor-pointer rounded-md transition-colors duration-150',
    hoverShellClasses,
    textToneClasses[tone] || textToneClasses.neutral,
    className,
  );
}
