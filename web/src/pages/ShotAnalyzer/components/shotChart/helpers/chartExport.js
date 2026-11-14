import { LEGEND_DASHED_LABELS, LEGEND_ORDER, VISIBILITY_KEY_BY_LABEL } from '../constants';
import { getShotChartDisplayLabel } from '../labelVisuals';

export function getVisibleLegendItemsForExport({
  legendColorByLabel,
  visibility,
  hasWeightData,
  hasWeightFlowData,
}) {
  // Exported legends should reflect the same visibility rules as the live chart,
  // including data-dependent series such as weight and weight flow.
  return LEGEND_ORDER.reduce((items, label) => {
    if (label === 'Weight' && !hasWeightData) return items;
    if (label === 'Weight Flow' && !hasWeightFlowData) return items;

    const key = VISIBILITY_KEY_BY_LABEL[label];
    if (key && !visibility[key]) return items;

    items.push({
      label: getShotChartDisplayLabel(label),
      color: legendColorByLabel[label],
      style: LEGEND_DASHED_LABELS.has(label) ? 'dashed' : 'dot',
    });
    return items;
  }, []);
}

function stripExportFileExtension(value) {
  return String(value || '')
    .trim()
    .replace(/\.[^./\\]{1,8}$/, '');
}

function sanitizeExportFilenameSegment(value) {
  return stripExportFileExtension(value)
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function resolveShotExportStem(shotData, fallbackStem) {
  const profileValue =
    typeof shotData?.profile === 'string'
      ? shotData.profile
      : shotData?.profile?.label || shotData?.profile?.name || '';
  // Prefer the storage/name fields first so exported files stay stable even when
  // display labels contain punctuation or are not unique.
  return (
    sanitizeExportFilenameSegment(
      shotData?.name || shotData?.storageKey || shotData?.id || profileValue || fallbackStem,
    ) || fallbackStem
  );
}

export function buildReplayExportFilename(shotData, includeLegend, exportFormat = 'mp4') {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-replay');
  const extension = exportFormat === 'webm' ? 'webm' : 'mp4';
  return `${stem}${includeLegend ? '-with-legend' : ''}-replay.${extension}`;
}

export function buildReplayImageFilename(shotData, includeLegend) {
  const stem = resolveShotExportStem(shotData, 'shot-analyzer-chart');
  return `${stem}${includeLegend ? '-with-legend' : ''}.png`;
}
