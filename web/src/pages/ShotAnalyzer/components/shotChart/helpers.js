/**
 * Stable public entry point for low-level ShotChart helpers.
 * Implementations are grouped by responsibility under ./helpers/.
 */

export {
  getAxisUnitReservedPadding,
  axisUnitLabelPlugin,
  phaseLabelOverlayPlugin,
} from './helpers/axisPlugins';

export {
  hoverGuidePlugin,
  phaseBackgroundOverlayPlugin,
  stopIconOverlayPlugin,
} from './helpers/overlayPlugins';

export { replayRevealPlugin, buildShotChartReplayModel } from './helpers/chartReplay';

export {
  getShotChartColors,
  getLegendColorByLabel,
  getSeriesLineSpec,
  SERIES_CSS_COLOR_BY_LABEL,
} from './helpers/chartTheme';

export {
  getPercentileValue,
  getSpikeResistantSeriesMax,
  formatUniqueAxisTick,
  formatResponsiveXAxisTick,
} from './helpers/chartScale';

export {
  getVisibleLegendItemsForExport,
  buildReplayExportFilename,
  buildReplayImageFilename,
} from './helpers/chartExport';

export {
  createChartPointElementConfig,
  computeExternalTooltipPosition,
} from './helpers/chartInteraction';

export {
  getPhaseName,
  toNumberOrNull,
  safeMax,
  safeMin,
  findLastSampleIndexAtOrBeforeX,
} from './helpers/chartData';
