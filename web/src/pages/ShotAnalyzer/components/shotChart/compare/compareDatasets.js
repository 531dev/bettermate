import {
  DASH_DERIVED,
  DASH_TARGET,
  LINE_WIDTH,
  PRESSURE_LINE_WIDTH,
  lineStyle,
} from '../../../ui/chartTokens.js';
import { COMPARE_STYLE_LINE_PATTERN } from './compareConstants';
import { shouldShowTargetsForEntry } from './compareModel';

export function getCompareShotLegendItems({ compareEntries, showCompareShotLegend }) {
  if (!showCompareShotLegend) return [];
  return compareEntries.map((entry, index) => ({
    label: entry.label,
    shotNumber: index + 1,
  }));
}

// Shot 2 of a comparison: a long dash for what was measured, dash-dot for its targets, and
// wider-set dots for a derived series that shares the overlay with the reading it comes from.
const DASH_SHOT_2 = [10, 5];
const DASH_SHOT_2_TARGET = [2, 4, 10, 4];
const DASH_SHOT_2_DERIVED = [2, 8];

/**
 * How one shot of an overlay draws. Every shot keeps the series token at full strength: in the
 * analyzer shot 1 is solid and shot 2 is dashed, which is also how their badges are drawn; in a
 * statistics overlay every shot is solid and the bundle is the reading.
 */
function getShotStyle(index, compareStyle) {
  const isSecondShot = compareStyle === COMPARE_STYLE_LINE_PATTERN && index > 0;
  return {
    dash: isSecondShot ? DASH_SHOT_2 : [],
    targetDash: isSecondShot ? DASH_SHOT_2_TARGET : DASH_TARGET,
    derivedDash: isSecondShot ? DASH_SHOT_2_DERIVED : DASH_DERIVED,
  };
}

// A measured series of one shot: its token, 2.5px for pressure and 2px otherwise.
function measuredLine(color, shotStyle, { pressure = false, derived = false } = {}) {
  return {
    ...lineStyle(color, {
      width: pressure ? PRESSURE_LINE_WIDTH : LINE_WIDTH,
      dash: derived ? shotStyle.derivedDash : shotStyle.dash,
    }),
    tension: 0.2,
    pointHitRadius: 12,
  };
}

// The target of a series: the same token, dashed, drawn under the measured lines.
function targetLine(color, shotStyle, entry) {
  return {
    ...lineStyle(color, { width: LINE_WIDTH, dash: shotStyle.targetDash }),
    tension: 0,
    order: entry.isReference ? -10 : -20,
    pointHitRadius: 10,
  };
}

function getDetailChartAxisScaleMode(seriesKey) {
  if (seriesKey === 'weight') return 'weight';
  if (seriesKey === 'weightFlow') return 'weightFlow';
  return undefined;
}

function buildMainPressureDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
}) {
  return [
    visibility.pressure && model.series.pressure.length > 0
      ? {
          label: `${entry.label} Pressure`,
          compareTooltipBaseLabel: 'Pressure',
          data: model.series.pressure,
          yAxisID: 'yMain',
          ...measuredLine(colors.pressure, shotStyle, { pressure: true }),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetPressure && showTargets && model.series.targetPressure.length > 0
      ? {
          label: `${entry.label} Target Pressure`,
          compareTooltipBaseLabel: 'Target P',
          data: model.series.targetPressure,
          yAxisID: 'yMain',
          ...targetLine(colors.pressure, shotStyle, entry),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainFlowDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
}) {
  return [
    visibility.flow && model.series.flow.length > 0
      ? {
          label: `${entry.label} Pump Flow`,
          compareTooltipBaseLabel: 'Pump Flow',
          data: model.series.flow,
          yAxisID: 'yMain',
          ...measuredLine(colors.flow, shotStyle),
          ...compareDatasetMeta,
        }
      : null,
    visibility.targetFlow && showTargets && model.series.targetFlow.length > 0
      ? {
          label: `${entry.label} Target Pump Flow`,
          compareTooltipBaseLabel: 'Target F',
          data: model.series.targetFlow,
          yAxisID: 'yMain',
          ...targetLine(colors.flow, shotStyle, entry),
          ...compareDatasetMeta,
        }
      : null,
    visibility.puckFlow && model.series.puckFlow.length > 0
      ? {
          label: `${entry.label} Puck Flow`,
          compareTooltipBaseLabel: 'Puck Flow',
          data: model.series.puckFlow,
          yAxisID: 'yMain',
          ...measuredLine(colors.puckFlow, shotStyle, { derived: true }),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainWeightDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  compareDatasetMeta,
  showWeightInMainChart,
  showWeightFlowInMainChart,
}) {
  return [
    showWeightInMainChart && visibility.weight && model.series.weight.length > 0
      ? {
          label: `${entry.label} Weight`,
          compareTooltipBaseLabel: 'Weight',
          data: model.series.weight,
          axisScaleMode: 'weight',
          yAxisID: 'yWeight',
          ...measuredLine(colors.weight, shotStyle),
          ...compareDatasetMeta,
        }
      : null,
    showWeightFlowInMainChart && visibility.weightFlow && model.series.weightFlow.length > 0
      ? {
          label: `${entry.label} Weight Flow`,
          compareTooltipBaseLabel: 'Weight Flow',
          data: model.series.weightFlow,
          axisScaleMode: 'weightFlow',
          yAxisID: 'yMain',
          ...measuredLine(colors.weightFlow, shotStyle, { derived: true }),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainPuckResistanceDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  compareDatasetMeta,
}) {
  return [
    visibility.puckResistance && model.series.puckResistance.length > 0
      ? {
          label: `${entry.label} Puck Resistance`,
          compareTooltipBaseLabel: 'Puck Resistance',
          data: model.series.puckResistance,
          yAxisID: 'yPuckResistance',
          ...measuredLine(colors.puckResistance, shotStyle),
          ...compareDatasetMeta,
        }
      : null,
    visibility.liquidResistance && model.series.liquidResistance.length > 0
      ? {
          label: `${entry.label} Liquid Resistance`,
          compareTooltipBaseLabel: 'Liquid Resistance',
          data: model.series.liquidResistance,
          yAxisID: 'yLiquidResistance',
          ...measuredLine(colors.liquidResistance, shotStyle, { derived: true }),
          ...compareDatasetMeta,
        }
      : null,
  ];
}

function buildMainChartDatasetSpecs({
  entry,
  model,
  visibility,
  colors,
  shotStyle,
  showTargets,
  compareDatasetMeta,
  showWeightInMainChart,
  showWeightFlowInMainChart,
}) {
  return [
    ...buildMainPressureDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
    }),
    ...buildMainFlowDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
    }),
    ...buildMainPuckResistanceDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      compareDatasetMeta,
    }),
    ...buildMainWeightDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      compareDatasetMeta,
      showWeightInMainChart,
      showWeightFlowInMainChart,
    }),
  ].filter(Boolean);
}

function buildDetailChartDatasetSpecs({
  chart,
  entry,
  actualSeries,
  targetSeries,
  baseColor,
  shotStyle,
  compareDatasetMeta,
  visibility,
  showTargets,
}) {
  return [
    visibility[chart.visibleKey] && actualSeries.length > 0
      ? {
          label: `${entry.label} ${chart.title}`,
          compareTooltipBaseLabel: chart.tooltipBaseLabel,
          data: actualSeries,
          axisScaleMode: getDetailChartAxisScaleMode(chart.seriesKey),
          ...measuredLine(baseColor, shotStyle, { pressure: chart.seriesKey === 'pressure' }),
          ...compareDatasetMeta,
        }
      : null,
    showTargets && targetSeries.length > 0
      ? {
          label: `${entry.label} ${chart.title} Target`,
          compareTooltipBaseLabel: chart.targetTooltipBaseLabel,
          data: targetSeries,
          ...targetLine(baseColor, shotStyle, entry),
          ...compareDatasetMeta,
        }
      : null,
  ].filter(Boolean);
}

export function buildMainChartDatasets({
  compareModels,
  colors,
  visibility,
  targetDisplayMode,
  compareStyle,
  showWeightInMainChart = true,
  showWeightFlowInMainChart = true,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, compareStyle);
    const showTargets = shouldShowTargetsForEntry({
      entry,
      targetDisplayMode,
    });
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
      compareTooltipGetHoverWaterValuesAtX: model.getHoverWaterValuesAtX,
    };
    return buildMainChartDatasetSpecs({
      entry,
      model,
      visibility,
      colors,
      shotStyle,
      showTargets,
      compareDatasetMeta,
      showWeightInMainChart,
      showWeightFlowInMainChart,
    });
  });
}

export function buildDetailChartDatasets({
  chart,
  compareModels,
  colors,
  includePumpFlowWaterTooltip = false,
  targetDisplayMode,
  visibility,
  compareStyle,
}) {
  return compareModels.flatMap(({ entry, model }, index) => {
    const shotStyle = getShotStyle(index, compareStyle);
    const actualSeries = model.series[chart.seriesKey] || [];
    const targetSeries = chart.targetSeriesKey ? model.series[chart.targetSeriesKey] || [] : [];
    const baseColor = colors[chart.axisColorKey];
    const showTargets =
      chart.targetSeriesKey &&
      chart.targetVisibleKey &&
      shouldShowTargetsForEntry({
        entry,
        targetDisplayMode,
      });
    const compareDatasetMeta = {
      compareTooltipShotLabel: entry.label,
      compareTooltipShotOrder: index,
      compareTooltipGetHoverWaterValuesAtX:
        includePumpFlowWaterTooltip && chart.tooltipBaseLabel === 'Pump Flow'
          ? model.getHoverWaterValuesAtX
          : null,
    };
    return buildDetailChartDatasetSpecs({
      chart,
      entry,
      actualSeries,
      targetSeries,
      baseColor,
      shotStyle,
      compareDatasetMeta,
      visibility: { ...visibility, [chart.visibleKey]: true },
      showTargets,
    });
  });
}
