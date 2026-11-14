import { drawPixelIcon, getChartLabelScale, getChartTheme } from './canvasDrawing';

const STOP_ICON_BADGE_RADIUS = 8.5;

const STOP_ICON_BADGE_DROP_WIDTH_RATIO = 2.26;

const STOP_ICON_BADGE_DROP_HEIGHT_RATIO = 3.24;

const STOP_ICON_BADGE_ICON_Y_OFFSET_RATIO = -0.14;

const STOP_ICON_SIZE = 12;

// The time under the pointer: a hairline through the chart area.
export const hoverGuidePlugin = {
  id: 'hoverGuide',
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (chart?.$suppressHoverGuide) return;
    const theme = getChartTheme(chart);
    if (!theme) return;

    const active = chart.getActiveElements?.() || chart.tooltip?.getActiveElements?.() || [];
    const x = Number.isFinite(chart?.$fixedTooltipPointerX)
      ? chart.$fixedTooltipPointerX
      : active[0]?.element?.x;
    if (!Number.isFinite(x)) return;

    const overflow = Number(pluginOptions?.overflow) || 6;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = theme.inkMuted;
    ctx.lineWidth = 1;
    ctx.moveTo(x, Math.max(0, top - overflow));
    ctx.lineTo(x, Math.min(chart.height, bottom + overflow));
    ctx.stroke();
    ctx.restore();
  },
};

// Every other phase stands on a band one tone above the tile, so phases read without a line
// between them. The band is a flat surface-2, never a tint.
export const phaseBackgroundOverlayPlugin = {
  id: 'phaseBackgroundOverlay',
  beforeDatasetsDraw(chart, _args, pluginOptions = {}) {
    const theme = getChartTheme(chart);
    if (!theme || !chart?.chartArea || !chart?.scales) return;

    const ranges = Array.isArray(pluginOptions.ranges) ? pluginOptions.ranges : [];
    if (ranges.length === 0) return;

    const xScale = chart.scales[pluginOptions.xScaleID || 'x'];
    if (!xScale) return;

    const { left, right, top, bottom } = chart.chartArea;
    const ctx = chart.ctx;

    ctx.save();
    ctx.fillStyle = theme.surface2;
    ranges.forEach(range => {
      if (!range?.visible || !range?.shaded) return;

      const startX = xScale.getPixelForValue(Number(range.startX));
      const endX = xScale.getPixelForValue(Number(range.endX));
      if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;

      const x = Math.max(left, Math.min(startX, endX));
      const width = Math.min(right, Math.max(startX, endX)) - x;
      if (width <= 0) return;

      ctx.fillRect(x, top, width, bottom - top);
    });
    ctx.restore();
  },
};

function shouldDrawStopIcon(stop, shouldFilterByReplayTime, stopRevealX) {
  if (!stop?.visible || !stop?.iconDef) return false;
  return !shouldFilterByReplayTime || Number(stop.xValue) <= stopRevealX;
}

function resolveStopIconLayout(chart, stop, labelScale) {
  const xScale = chart.scales[stop.xScaleID || 'x'];
  const yScale = chart.scales[stop.yScaleID || 'yMain'];
  if (!xScale || !yScale) return null;

  const centerX = xScale.getPixelForValue(Number(stop.xValue));
  const yPixel = yScale.getPixelForValue(Number(stop.yValue));
  if (!Number.isFinite(centerX) || !Number.isFinite(yPixel)) return null;

  const radius = (Number(stop.badgeRadius) || STOP_ICON_BADGE_RADIUS) * labelScale;
  const badgeHeight = radius * STOP_ICON_BADGE_DROP_HEIGHT_RATIO;
  return {
    badgeHeight,
    badgeWidth: radius * STOP_ICON_BADGE_DROP_WIDTH_RATIO,
    centerX,
    centerY: yPixel - badgeHeight / 2,
    labelScale,
  };
}

// A stop is a fact, so its pin is ink with the glyph of what ended the phase in on-ink. Only a
// safety stop takes the warning token.
function drawStopIcon(ctx, theme, stop, layout) {
  const { badgeHeight, badgeWidth, centerX, centerY, labelScale } = layout;
  ctx.save();
  ctx.fillStyle = stop.tone === 'warning' ? theme.warning : theme.stop;
  ctx.beginPath();
  drawStopBadgeDropPath(ctx, {
    centerX,
    centerY,
    width: badgeWidth,
    height: badgeHeight,
  });
  ctx.fill();
  ctx.restore();

  drawPixelIcon(ctx, {
    iconDef: stop.iconDef,
    x: centerX,
    y: centerY + badgeHeight * STOP_ICON_BADGE_ICON_Y_OFFSET_RATIO,
    size: (Number(stop.iconSize) || STOP_ICON_SIZE) * labelScale,
    color: theme.onInk,
  });
}

export const stopIconOverlayPlugin = {
  id: 'stopIconOverlay',
  afterDraw(chart, _args, pluginOptions = {}) {
    const theme = getChartTheme(chart);
    if (!theme || !chart?.chartArea || !chart?.scales) return;

    const stops = Array.isArray(pluginOptions.stops) ? pluginOptions.stops : [];
    if (stops.length === 0) return;

    const labelScale = getChartLabelScale(chart);
    const stopRevealX = Number(chart.$replayStopRevealX);
    const shouldFilterByReplayTime =
      chart.$replayStopRevealEnabled === true && Number.isFinite(stopRevealX);

    for (const stop of [...stops].reverse()) {
      if (!shouldDrawStopIcon(stop, shouldFilterByReplayTime, stopRevealX)) continue;
      const layout = resolveStopIconLayout(chart, stop, labelScale);
      if (layout) drawStopIcon(chart.ctx, theme, stop, layout);
    }
  },
};

function drawStopBadgeDropPath(ctx, { centerX, centerY, width, height }) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const topY = centerY - halfHeight;
  const bottomY = centerY + halfHeight;
  const upperSideY = centerY - halfHeight * 0.24;
  const bellyY = centerY + halfHeight * 0.12;
  const lowerTaperY = centerY + halfHeight * 0.42;
  const tipControlY = centerY + halfHeight * 0.82;

  ctx.moveTo(centerX, topY);
  ctx.bezierCurveTo(
    centerX + halfWidth * 0.62,
    topY,
    centerX + halfWidth,
    centerY - halfHeight * 0.78,
    centerX + halfWidth,
    upperSideY,
  );
  ctx.bezierCurveTo(
    centerX + halfWidth,
    centerY + halfHeight * 0.06,
    centerX + halfWidth * 0.88,
    bellyY,
    centerX + halfWidth * 0.66,
    lowerTaperY,
  );
  ctx.bezierCurveTo(
    centerX + halfWidth * 0.42,
    centerY + halfHeight * 0.68,
    centerX + halfWidth * 0.16,
    tipControlY,
    centerX,
    bottomY,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth * 0.16,
    tipControlY,
    centerX - halfWidth * 0.42,
    centerY + halfHeight * 0.68,
    centerX - halfWidth * 0.66,
    lowerTaperY,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth * 0.88,
    bellyY,
    centerX - halfWidth,
    centerY + halfHeight * 0.06,
    centerX - halfWidth,
    upperSideY,
  );
  ctx.bezierCurveTo(
    centerX - halfWidth,
    centerY - halfHeight * 0.78,
    centerX - halfWidth * 0.62,
    topY,
    centerX,
    topY,
  );
  ctx.closePath();
}
