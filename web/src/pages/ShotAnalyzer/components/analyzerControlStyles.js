/**
 * Transitional shim. The analyzer's controls now come from the recipes (Button, IconButton,
 * Menu, `an-iconbtn`, `an-press`); these helpers only keep unmigrated callers rendering and go
 * away with their last import.
 */
import '../ui/tool.css';

const joinClasses = (...classes) => classes.filter(Boolean).join(' ');

export const ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS = '';
export const ANALYZER_ACTION_ICON_CLASS = '';
export const ANALYZER_ACTION_ICON_STYLE = undefined;
export const ANALYZER_ACTION_ICON_BUTTON_CLASS = '';
export const ANALYZER_ACTION_GROUP_CLASSES = 'flex items-center gap-1';

export const joinAnalyzerClasses = (...classes) => joinClasses(...classes);

export function getAnalyzerIconButtonClasses({ className = '' } = {}) {
  return joinClasses('an-iconbtn', className);
}

export function getAnalyzerTextButtonClasses({ className = '' } = {}) {
  return joinClasses('an-press inline-flex items-center', className);
}

export function getAnalyzerSurfaceTriggerClasses({ className = '' } = {}) {
  return joinClasses('an-press', className);
}
