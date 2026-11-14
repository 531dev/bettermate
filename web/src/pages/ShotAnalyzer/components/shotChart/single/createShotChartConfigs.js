/**
 * createShotChartConfigs.js
 *
 * Builds the Chart.js config objects for the main and temperature charts from
 * the normalized ShotChart model.
 *
 * The Charts rules of the design apply to both: lines only (2.5px for pressure, 2px for the
 * rest), no fill, no points, horizontal grid lines in chart-grid, ticks in Geist Mono 11px,
 * no animation. Series that share a hue differ by their dash.
 */

import { gridStyle, lineStyle, tickStyle } from '../../../ui/chartTokens.js';
import { WATER_DRAWN_PHASE_LABEL, WATER_DRAWN_TOTAL_LABEL } from '../constants';
import { shouldRenderTooltipLabel, sortTooltipItems } from '../ShotChartExternalTooltip';
import {
  axisUnitLabelPlugin,
  createChartPointElementConfig,
  formatResponsiveXAxisTick,
  formatUniqueAxisTick,
  getAxisUnitReservedPadding,
  getSeriesLineSpec,
  phaseBackgroundOverlayPlugin,
  phaseLabelOverlayPlugin,
  replayRevealPlugin,
  stopIconOverlayPlugin,
} from '../helpers';

const MAIN_CHART_MARKER_TOP_PADDING = 48;
const RIGHT_AXIS_UNIT_ROW_GAP = 14;

// A drawn series: its token colour, the width and dash its label asks for, a gentle curve.
function seriesDataset({ label, data, color, yAxisID, hidden, tension = 0.2 }) {
  return {
    label,
    data,
    yAxisID,
    hidden,
    tension,
    ...lineStyle(color, getSeriesLineSpec(label)),
  };
}

// A dataset that only feeds the tooltip (or carries a legend entry): it never draws.
function silentDataset({ label, data, color, yAxisID, hidden }) {
  return {
    label,
    data,
    yAxisID,
    hidden,
    borderColor: color,
    backgroundColor: color,
    borderWidth: 0,
    showLine: false,
    fill: false,
    pointRadius: 0,
    pointHoverRadius: 0,
    pointHitRadius: 12,
  };
}

export function createShotChartConfigs({
  model,
  colors,
  visibility,
  hasWeightData,
  hasWeightFlowData,
  updateExternalTooltip,
  showStopBadges = true,
}) {
  const showWeightSeries = Boolean(hasWeightData && model.hasWeight);
  const showPuckResistanceAxis = Boolean(
    visibility.puckResistance && model.series.puckResistance.length > 0,
  );
  const showLiquidResistanceAxis = Boolean(
    visibility.liquidResistance && model.series.liquidResistance.length > 0,
  );
  const ticks = tickStyle(colors);
  const theme = { tokens: colors };
  const mainAxisUnitLabels = [
    { scaleId: 'yMain', label: 'bar / ml/s' },
    { scaleId: 'yMain', label: 'Phase', side: 'center', yOffset: 0 },
  ];
  const showWeightAxis = Boolean(showWeightSeries && visibility.weight);
  const rightAxisUnitLabels = [];
  if (showWeightAxis) {
    rightAxisUnitLabels.push({
      scaleId: 'yWeight',
      label: 'g',
      side: 'right',
    });
  }
  if (showPuckResistanceAxis) {
    rightAxisUnitLabels.push({
      scaleId: 'yPuckResistance',
      label: 's·√bar/mL',
      side: 'right',
    });
  }
  if (showLiquidResistanceAxis) {
    rightAxisUnitLabels.push({
      scaleId: 'yLiquidResistance',
      label: 'bar·s/mL',
      side: 'right',
    });
  }
  rightAxisUnitLabels.forEach((axisLabel, index) => {
    mainAxisUnitLabels.push({ ...axisLabel, yOffset: index * RIGHT_AXIS_UNIT_ROW_GAP });
  });
  const tempAxisUnitLabels = [{ scaleId: 'yTemp', label: '°C', side: 'left' }];
  const mainAxisUnitPadding = getAxisUnitReservedPadding({ yLabels: mainAxisUnitLabels });
  mainAxisUnitPadding.top = Math.max(
    mainAxisUnitPadding.top,
    MAIN_CHART_MARKER_TOP_PADDING +
      Math.max(0, rightAxisUnitLabels.length - 1) * RIGHT_AXIS_UNIT_ROW_GAP,
  );
  const tempAxisUnitPadding = getAxisUnitReservedPadding({
    yLabels: tempAxisUnitLabels,
    xLabel: 's',
    reserveXLabelSpace: false,
  });

  // A right-hand axis: ticks only, no grid of its own.
  const rightAxis = ({ display, max, offset = true }) => ({
    type: 'linear',
    display,
    position: 'right',
    offset,
    beginAtZero: true,
    min: 0,
    max,
    ticks: { ...ticks, display, callback: formatUniqueAxisTick },
    grid: gridStyle(colors, false),
    border: { display: false },
  });

  // The main chart carries all primary series plus a few silent datasets that exist only
  // for tooltip composition and replay/export consistency.
  const mainDatasets = [
    silentDataset({
      label: 'Phases',
      data: [],
      color: colors.phaseLine,
      yAxisID: 'yMain',
      hidden: !visibility.phaseNames,
    }),
    silentDataset({
      label: 'Stops',
      data: [],
      color: colors.stopLabel,
      yAxisID: 'yMain',
      hidden: !visibility.stops,
    }),
    // Temperature is drawn on its own chart below; here it only answers the tooltip.
    silentDataset({
      label: 'Temp',
      data: model.series.temp,
      color: colors.temp,
      yAxisID: 'yTempOverlay',
      hidden: !visibility.temp,
    }),
    silentDataset({
      label: 'Target T',
      data: model.series.targetTemp,
      color: colors.tempTarget,
      yAxisID: 'yTempOverlay',
      hidden: !visibility.targetTemp,
    }),
    seriesDataset({
      label: 'Pressure',
      data: model.series.pressure,
      color: colors.pressure,
      yAxisID: 'yMain',
      hidden: !visibility.pressure,
    }),
    seriesDataset({
      label: 'Target P',
      data: model.series.targetPressure,
      color: colors.pressure,
      yAxisID: 'yMain',
      tension: 0,
      hidden: !visibility.targetPressure,
    }),
    seriesDataset({
      label: 'Pump Flow',
      data: model.series.flow,
      color: colors.flow,
      yAxisID: 'yMain',
      hidden: !visibility.flow,
    }),
    seriesDataset({
      label: 'Target F',
      data: model.series.targetFlow,
      color: colors.flow,
      yAxisID: 'yMain',
      tension: 0,
      hidden: !visibility.targetFlow,
    }),
    seriesDataset({
      label: 'Puck Flow',
      data: model.series.puckFlow,
      color: colors.puckFlow,
      yAxisID: 'yMain',
      hidden: !visibility.puckFlow,
    }),
    seriesDataset({
      label: 'Puck Resistance',
      data: model.series.puckResistance,
      color: colors.puckResistance,
      yAxisID: 'yPuckResistance',
      hidden: !visibility.puckResistance,
    }),
    seriesDataset({
      label: 'Liquid Resistance',
      data: model.series.liquidResistance,
      color: colors.liquidResistance,
      yAxisID: 'yLiquidResistance',
      hidden: !visibility.liquidResistance,
    }),
    seriesDataset({
      label: 'Weight',
      data: model.series.weight,
      color: colors.weight,
      yAxisID: 'yWeight',
      hidden: !showWeightSeries || !visibility.weight,
    }),
    seriesDataset({
      label: 'Weight Flow',
      data: model.series.weightFlow,
      color: colors.weightFlow,
      yAxisID: 'yMain',
      hidden: !hasWeightFlowData || !visibility.weightFlow,
    }),
    silentDataset({
      label: WATER_DRAWN_PHASE_LABEL,
      data: model.waterTooltipPhaseSeries,
      color: colors.water,
      yAxisID: 'yWaterOverlay',
    }),
    silentDataset({
      label: WATER_DRAWN_TOTAL_LABEL,
      data: model.waterTooltipTotalSeries,
      color: colors.water,
      yAxisID: 'yWaterOverlay',
    }),
  ];

  // The temperature chart remains intentionally small: it mirrors the shared x-axis
  // while keeping its own left/right temperature scales.
  const tempDatasets = [
    seriesDataset({
      label: 'Temp',
      data: model.series.temp,
      color: colors.temp,
      yAxisID: 'yTemp',
      hidden: !visibility.temp,
    }),
    seriesDataset({
      label: 'Target T',
      data: model.series.targetTemp,
      color: colors.tempTarget,
      yAxisID: 'yTempRight',
      tension: 0,
      hidden: !visibility.targetTemp,
    }),
  ];

  return {
    mainConfig: {
      type: 'line',
      data: { datasets: mainDatasets },
      plugins: [
        phaseBackgroundOverlayPlugin,
        // The shared HTML hover connector draws one guide across both charts.
        replayRevealPlugin,
        axisUnitLabelPlugin,
        phaseLabelOverlayPlugin,
        stopIconOverlayPlugin,
      ],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        // The shared hover surface selects points by timestamp, including sparse PR data.
        events: [],
        layout: {
          autoPadding: false,
          padding: mainAxisUnitPadding,
        },
        elements: {
          point: createChartPointElementConfig(),
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          theme,
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
            caretSize: 0,
            caretPadding: 0,
            // The external tooltip owns all rendering. The built-in tooltip still
            // provides item ordering/filtering so both paths share one data model.
            filter: context => shouldRenderTooltipLabel(context.dataset.label),
            itemSort: sortTooltipItems,
            callbacks: {
              title: tooltipItems => {
                const xValue = tooltipItems?.[0]?.parsed?.x;
                return Number.isFinite(xValue) ? `${xValue.toFixed(2)} s` : '';
              },
            },
            external: updateExternalTooltip,
          },
          annotation: {
            clip: false,
            annotations: model.phaseAnnotations,
          },
          phaseBackgroundOverlay: {
            ranges: model.phaseBackgroundRanges,
          },
          axisUnitLabels: {
            yLabels: mainAxisUnitLabels,
          },
          phaseLabelOverlay: {
            labels: model.phaseLabelOverlays,
          },
          stopIconOverlay: {
            stops: showStopBadges ? model.stopIconOverlays : [],
          },
        },
        scales: {
          y: {
            display: false,
            grid: { display: false },
            ticks: { display: false },
          },
          x: {
            type: 'linear',
            display: false,
            max: model.maxTime,
            ticks: { display: false },
            grid: { display: false },
          },
          yMain: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: model.mainAxisMax,
            ticks: { ...ticks, display: true, callback: formatUniqueAxisTick },
            grid: gridStyle(colors),
            border: { display: false },
          },
          yTempOverlay: {
            type: 'linear',
            display: false,
            // Keep temperature series on the main chart only as hover/tooltip proxies.
            // A hidden overlay axis prevents them from distorting the pressure/flow scale.
            min: model.tempAxisMin,
            max: model.tempAxisMax,
            grid: { display: false },
            ticks: { display: false },
          },
          yWaterOverlay: {
            type: 'linear',
            display: false,
            beginAtZero: true,
            // Water values are never drawn directly; this axis only exists so their
            // silent datasets remain valid Chart.js datasets.
            grid: { display: false },
            ticks: { display: false },
          },
          yWeight: rightAxis({ display: showWeightAxis, max: model.weightAxisMax, offset: false }),
          yPuckResistance: rightAxis({
            display: showPuckResistanceAxis,
            max: model.puckResistanceAxisMax,
          }),
          yLiquidResistance: rightAxis({
            display: showLiquidResistanceAxis,
            max: model.liquidResistanceAxisMax,
          }),
        },
      },
    },
    tempConfig: {
      type: 'line',
      data: { datasets: tempDatasets },
      plugins: [phaseBackgroundOverlayPlugin, replayRevealPlugin, axisUnitLabelPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        events: [],
        layout: {
          autoPadding: false,
          padding: tempAxisUnitPadding,
        },
        elements: {
          point: createChartPointElementConfig(),
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          theme,
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
          },
          annotation: {
            annotations: model.tempPhaseAnnotations,
          },
          phaseBackgroundOverlay: {
            ranges: model.phaseBackgroundRanges,
          },
          axisUnitLabels: {
            yLabels: tempAxisUnitLabels,
            xLabel: 's',
            xLabelPlacement: 'inside',
            xLabelYOffset: 0,
          },
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            max: model.maxTime,
            ticks: {
              ...ticks,
              display: true,
              autoSkip: false,
              callback: formatResponsiveXAxisTick,
              padding: 4,
              align: 'inner',
              includeBounds: true,
              maxRotation: 0,
              minRotation: 0,
            },
            grid: gridStyle(colors, false),
            border: {
              display: true,
              color: colors.grid,
            },
          },
          yTemp: {
            type: 'linear',
            position: 'left',
            min: model.tempAxisMin,
            max: model.tempAxisMax,
            ticks: { ...ticks, display: true, callback: formatUniqueAxisTick },
            grid: gridStyle(colors),
            border: { display: false },
          },
          // Mirrors the weight axis of the main chart so both chart areas keep one width;
          // it draws nothing.
          yTempRight: {
            type: 'linear',
            display: showWeightAxis,
            position: 'right',
            min: model.tempAxisMin,
            max: model.tempAxisMax,
            grid: gridStyle(colors, false),
            border: { display: false },
            ticks: {
              ...ticks,
              display: showWeightAxis,
              color: colors.surface1,
              callback: formatUniqueAxisTick,
            },
          },
        },
      },
    },
  };
}
