const WARNING_HELP_COPY = {
  delayReview:
    'Review the stop reason for this phase. The algorithm was only able to identify it after several intermediate calculations.',
  highScaleDelay:
    'The configured or inferred scale delay is unusually high. Review the scale-delay setting before relying on predictive weight stops.',
  scaleLost:
    'Shown when the scale briefly loses connection during the brew. In this case, weight is ignored for stop detection for that brew, even if the scale reconnects later.',
  slowSampling:
    'Excessive delay while writing samples. Possible causes include a slow SD card or high OS/system load.',
};

function getDelayReviewLabel(results) {
  return results?.delayReviewPhaseNumber
    ? `Review phase ${results.delayReviewPhaseNumber}`
    : 'Phase review advised';
}

/**
 * What the analysis has to say about the shot as a whole, as chips above the table.
 * `tone` is 'warning' for something that puts the numbers in doubt; a hint has none.
 */
export function buildAnalysisWarningBadges(results) {
  const badges = [];

  if (results?.hasSlowSampleInterval) {
    const rawMaxIntervalMs = results.maxSampleIntervalMs;
    const maxIntervalMs = rawMaxIntervalMs == null ? null : Number(rawMaxIntervalMs);
    const intervalSuffix =
      Number.isFinite(maxIntervalMs) && maxIntervalMs > 0
        ? ` (${Math.round(maxIntervalMs)} ms)`
        : '';
    badges.push({
      key: 'slow-sampling',
      label: `Slow sampling${intervalSuffix}`,
      tone: 'warning',
      details: WARNING_HELP_COPY.slowSampling,
    });
  }

  if (results?.globalScaleLost) {
    badges.push({
      key: 'scale-lost',
      label: 'Scale lost',
      tone: 'warning',
      details: WARNING_HELP_COPY.scaleLost,
    });
  }

  if (results?.highScaleDelay) {
    const delaySuffix = results.highScaleDelayMs ? ` (${results.highScaleDelayMs} ms)` : '';
    badges.push({
      key: 'high-scale-delay',
      label: `High scale delay${delaySuffix}`,
      tone: 'warning',
      details: WARNING_HELP_COPY.highScaleDelay,
    });
  }

  if (results?.delayReviewHint) {
    badges.push({
      key: 'delay-review',
      label: getDelayReviewLabel(results),
      details: results.delayReviewMessage || WARNING_HELP_COPY.delayReview,
    });
  }

  return badges;
}

function stripTrailingParentheticalSuffix(value) {
  const label = String(value || '');
  const suffixStart = label.lastIndexOf(' (');
  if (suffixStart < 0 || !label.endsWith(')')) return label;
  return label.slice(0, suffixStart);
}

function getAnalysisHeaderBaseLabel(col) {
  if (col.id === 'duration') return 'Time';
  if (col.id === 'water') return 'Pumped water (phase)';
  if (col.id === 'weight') return 'Weight (total)';
  if (col.group === 'flow') return 'Pump flow';
  if (col.group === 'target_flow') return 'Target pump flow';
  if (col.group === 'puckflow') return 'Puck flow';
  if (col.group === 'temp') return 'Temperature';
  if (col.group === 'target_temp') return 'Target temperature';
  return stripTrailingParentheticalSuffix(col.label);
}

export function getAnalysisHeaderLabel(col) {
  const suffixByType = {
    se: ' S/E',
    mm: ' min/max',
    avg: ' avg',
  };

  return `${getAnalysisHeaderBaseLabel(col)}${suffixByType[col.type] || ''}`;
}

export function getMaxComparePhaseCount(compareMode, compareEntries) {
  if (!compareMode) return 0;
  return Math.max(...compareEntries.map(entry => entry?.results?.phases?.length || 0), 0);
}

export function hasAnalysisProfilePhaseStops(results) {
  return Boolean(results?.phases?.some(phase => phase.exit?.reason));
}
