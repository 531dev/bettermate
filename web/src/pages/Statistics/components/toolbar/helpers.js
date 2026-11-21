// Pure helper functions for StatisticsToolbar: label formatting and summaries
import { clock, clockOf } from '../../../../utils/time.js';
import { clock24hSignal } from '../../../../utils/dashboardManager.js';
import { MISSING } from '../../utils/format';
import { DATE_ONLY_PATTERN, DATE_TIME_PATTERN, TOOLBAR_FLOATING_PANEL_ATTR } from './constants';

const pad2 = value => String(value).padStart(2, '0');

export function formatToolbarDateTimeDisplay(value) {
  if (!value) return '';
  const valueText = String(value);
  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(valueText);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}.${month}.${year}`;
  }
  const match = DATE_TIME_PATTERN.exec(valueText);
  if (match) {
    const [, year, month, day, hour, minute] = match;
    return `${day}.${month}.${year}, ${clockOf(`${hour}:${minute}`)}`;
  }
  const parsed = new Date(value);
  const time = parsed.getTime();
  if (!Number.isFinite(time)) return value;
  try {
    return parsed.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: !clock24hSignal.value,
    });
  } catch {
    return value;
  }
}

export function getDateRangeDisplay({
  dateFromLocal,
  dateToLocal,
  dateFromPreviewLocal,
  dateToPreviewLocal,
}) {
  const hasManualDateFilter = Boolean(dateFromLocal || dateToLocal);
  const fromValue = hasManualDateFilter ? dateFromLocal : dateFromPreviewLocal;
  const toValue = hasManualDateFilter ? dateToLocal : dateToPreviewLocal;
  const fromText = formatToolbarDateTimeDisplay(fromValue);
  const toText = formatToolbarDateTimeDisplay(toValue);

  if (hasManualDateFilter) {
    if (fromText && toText) {
      return { label: 'Date range', fromText, toText, isAuto: false };
    }
    if (fromText) {
      return { label: 'From', fromText, toText: '', isAuto: false };
    }
    if (toText) {
      return { label: 'To', fromText: '', toText, isAuto: false };
    }
    return { label: 'Date range', fromText: 'No dates', toText: '', isAuto: false };
  }

  if (fromText || toText) {
    return { label: 'Auto range', fromText: fromText || 'No date', toText, isAuto: true };
  }

  return { label: 'Auto range', fromText: 'No dates', toText: '', isAuto: true };
}

export function formatCountLabel(value, singular, plural) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return `0 ${plural}`;
  return `${numericValue} ${numericValue === 1 ? singular : plural}`;
}

// A moment as the toolbar writes dates: 11.11.2026 and 13:28 (or 1:28 PM), in local time.
function getLocalDateTimeParts(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    date: `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`,
    time: clock(date),
  };
}

// The span of the built statistics. A span inside one day names the day once.
export function formatCollapsedDateRangeText(startValue, endValue) {
  const from = getLocalDateTimeParts(startValue);
  const to = getLocalDateTimeParts(endValue);
  if (!from) return 'No dates';

  const fromText = `${from.date}, ${from.time}`;
  if (!to) return fromText;
  if (to.date === from.date) {
    return to.time === from.time ? fromText : `${fromText} – ${to.time}`;
  }
  return `${fromText} – ${to.date}, ${to.time}`;
}

export function getCandidateSummary({ metadataLoading, candidateCount }) {
  if (metadataLoading) {
    return {
      candidateLabel: `${MISSING} shots`,
      candidateTitle: 'Loading shots',
      resetAriaCount: 'loading candidates',
    };
  }

  if (Number.isFinite(candidateCount)) {
    const candidateLabel = formatCountLabel(candidateCount, 'shot', 'shots');
    return {
      candidateLabel,
      candidateTitle: `${candidateLabel} in this selection`,
      resetAriaCount: `${candidateCount} candidates`,
    };
  }

  return {
    candidateLabel: `${MISSING} shots`,
    candidateTitle: 'The selection cannot be counted yet',
    resetAriaCount: 'unknown candidates',
  };
}

export function getToolbarMessages({ parseErrors, parseWarnings }) {
  const topError = parseErrors[0]?.message || null;
  const topWarning = topError ? null : parseWarnings[0]?.message || null;
  const noticeMessage = topError || topWarning || null;
  const noticeTone = topError ? 'error' : 'warning';
  const moreCount = Math.max(0, (topError ? parseErrors.length : parseWarnings.length) - 1);

  return {
    topError,
    topWarning,
    noticeMessage,
    noticeTone,
    moreCount,
  };
}

export function getDateBasisOptionTitle(value) {
  if (value === 'shot') return 'Use shot timestamp only';
  if (value === 'auto') return 'Use shot timestamp, fallback to upload time';
  return 'Use upload time only';
}

const TOOLBAR_FLOATING_PANEL_SELECTOR = `[${TOOLBAR_FLOATING_PANEL_ATTR}], .bm-sheet, .bm-scrim`;

// A popover or a sheet the toolbar opened renders in a portal: a press inside it belongs to the
// toolbar although it lands outside the toolbar's own element.
export function isToolbarFloatingPanelTarget(target) {
  return target instanceof Element && !!target.closest(TOOLBAR_FLOATING_PANEL_SELECTOR);
}

export function isToolbarFloatingPanelOpen(root) {
  return !!root?.querySelector?.(`[${TOOLBAR_FLOATING_PANEL_ATTR}], .bm-sheet`);
}

const TOOLBAR_CONTROL_SELECTOR =
  'button, a, input, select, textarea, label, [role="switch"], [role="tab"], [tabindex]';

// A press on a control of the toolbar, as opposed to a press on its empty ground. Only controls
// inside `root` count: the page around the toolbar may carry a tabindex of its own.
export function isToolbarControlTarget(target, root) {
  if (!(target instanceof Element)) return false;
  // The control that was pressed may have left the document already (the summary row is replaced
  // by the controls as it is pressed): it was a control all the same.
  if (!target.isConnected) return true;
  const control = target.closest(TOOLBAR_CONTROL_SELECTOR);
  return !!control && control !== root && (!root || root.contains(control));
}
