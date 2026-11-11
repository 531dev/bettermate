import { iconPaths } from '../../../../../design/iconPaths.js';

export const CHART_LABEL_FONT_FAMILY = '"Jost", system-ui, sans-serif';

export function getChartLabelScale(chart) {
  const width = Number(chart?.width) || 0;
  if (width > 0 && width < 420) return 0.82;
  if (width > 0 && width < 640) return 0.9;
  return 1;
}

export function drawPixelIcon(ctx, { iconDef, x, y, size, color }) {
  const pathData = iconPaths[iconDef];
  if (!pathData) return;

  const width = 24;
  const height = 24;
  const scale = size / Math.max(width, height);

  // The glyphs are strokes on a 24 unit grid: 1.6 wide, round caps and joins.
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.translate(x - (width * scale) / 2, y - (height * scale) / 2);
  ctx.scale(scale, scale);
  ctx.stroke(new Path2D(pathData));
  ctx.restore();
}

export function drawRoundedRect(ctx, { x, y, width, height, radius }) {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const right = x + width;
  const bottom = y + height;
  ctx.moveTo(x + radius, y);
  ctx.lineTo(right - radius, y);
  ctx.quadraticCurveTo(right, y, right, y + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(x + radius, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}
