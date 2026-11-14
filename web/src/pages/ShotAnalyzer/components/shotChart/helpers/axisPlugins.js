import { canvasFont } from '../../../ui/chartTokens.js';
import { drawRoundedRect, getChartLabelScale, getChartTheme } from './canvasDrawing';

const AXIS_UNIT_TOP_PADDING = 24;

const AXIS_UNIT_RIGHT_PADDING = 22;

const AXIS_UNIT_X_GAP = 16;

const PHASE_LABEL_TOP_INSET = 4;

const PHASE_NUMBER_TOP_OFFSET = 12;

// Ticks and everything written beside them are Geist Mono 11px.
const LABEL_FONT_SIZE = 11;

export function getAxisUnitReservedPadding(pluginOptions = {}) {
  const yLabels = Array.isArray(pluginOptions.yLabels) ? pluginOptions.yLabels : [];
  const reserveXLabelSpace = pluginOptions.reserveXLabelSpace !== false;
  return {
    top: yLabels.length > 0 ? AXIS_UNIT_TOP_PADDING : 0,
    right: pluginOptions.xLabel && reserveXLabelSpace ? AXIS_UNIT_RIGHT_PADDING : 0,
    bottom: 0,
    left: 0,
  };
}

function getAxisUnitSideX({ side, chart, scale }) {
  if (side === 'center') return (chart.chartArea.left + chart.chartArea.right) / 2;
  if (side === 'right')
    return Math.min(chart.width - 2, (scale.right ?? chart.chartArea.right) - 2);
  return Math.max(2, (scale.left ?? chart.chartArea.left) + 2);
}

function getAxisUnitSideAlign(side) {
  if (side === 'center') return 'center';
  if (side === 'right') return 'right';
  return 'left';
}

function drawAxisUnitLabel(ctx, theme, { x, y, text, align = 'left', fontSize }) {
  if (!text) return;

  ctx.save();
  ctx.fillStyle = theme.inkMuted;
  ctx.font = canvasFont(theme, fontSize);
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// The unit of each axis, written above it in the tick style, and the unit of the time axis.
export const axisUnitLabelPlugin = {
  id: 'axisUnitLabels',
  afterDraw(chart, _args, pluginOptions = {}) {
    const theme = getChartTheme(chart);
    if (!theme || !chart?.chartArea || !chart?.scales) return;

    const { top } = chart.chartArea;
    const yLabels = Array.isArray(pluginOptions.yLabels) ? pluginOptions.yLabels : [];
    const fontSize = LABEL_FONT_SIZE * getChartLabelScale(chart);

    yLabels.forEach(({ scaleId, label, side = 'left', yOffset }, index) => {
      const scale = chart.scales[scaleId];
      if (!scale || scale.display === false) return;

      drawAxisUnitLabel(chart.ctx, theme, {
        x: getAxisUnitSideX({ side, chart, scale }),
        y: Math.max(2, top - 22) + (yOffset == null ? index * 14 : yOffset),
        text: label,
        align: getAxisUnitSideAlign(side),
        fontSize,
      });
    });

    const xScale = chart.scales[pluginOptions.xScaleId || 'x'];
    if (xScale && pluginOptions.xLabel) {
      const placeInside = pluginOptions.xLabelPlacement === 'inside';
      const yOffset = Number(pluginOptions.xLabelYOffset) || 0;
      drawAxisUnitLabel(chart.ctx, theme, {
        x: Math.min(chart.width - (placeInside ? 8 : 2), xScale.right + AXIS_UNIT_X_GAP),
        y: Math.max(xScale.top + 2, xScale.bottom - 13 + yOffset),
        text: pluginOptions.xLabel,
        align: 'left',
        fontSize,
      });
    }
  },
};

// The number or name of each phase at the top of its band, as a neutral chip: a surface-2 pill
// with a hairline, so it reads on a shaded band and on a plain one.
export const phaseLabelOverlayPlugin = {
  id: 'phaseLabelOverlay',
  afterDraw(chart, _args, pluginOptions = {}) {
    const theme = getChartTheme(chart);
    if (!theme || !chart?.chartArea || !chart?.scales?.x) return;

    const labels = Array.isArray(pluginOptions.labels) ? pluginOptions.labels : [];
    if (labels.length === 0) return;

    const ctx = chart.ctx;
    const top = chart.chartArea.top + PHASE_LABEL_TOP_INSET;
    const labelScale = getChartLabelScale(chart);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    labels.forEach(labelMeta => {
      if (!labelMeta?.display) return;

      const text = String(labelMeta.label || '');
      if (!text) return;

      const x = chart.scales.x.getPixelForValue(labelMeta.xValue);
      if (!Number.isFinite(x)) return;

      const isPhaseNumber = Boolean(labelMeta.usePhaseNumbers);
      ctx.font = canvasFont(theme, LABEL_FONT_SIZE * labelScale, {
        weight: isPhaseNumber ? 600 : 400,
      });
      const textWidth = ctx.measureText(text).width;
      const width = isPhaseNumber
        ? Math.max(20 * labelScale, textWidth + 12 * labelScale)
        : textWidth + 12 * labelScale;
      const height = 18 * labelScale;
      const centerY = isPhaseNumber
        ? chart.chartArea.top + PHASE_NUMBER_TOP_OFFSET
        : top + width / 2;

      ctx.save();
      ctx.translate(x, centerY);
      if (!isPhaseNumber) ctx.rotate(-Math.PI / 2);

      ctx.beginPath();
      drawRoundedRect(ctx, {
        x: -width / 2,
        y: -height / 2,
        width,
        height,
        radius: height / 2,
      });
      ctx.fillStyle = theme.surface2;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = theme.line;
      ctx.stroke();

      ctx.fillStyle = theme.inkMuted;
      ctx.fillText(text, 0, 0.5);
      ctx.restore();
    });

    ctx.restore();
  },
};
