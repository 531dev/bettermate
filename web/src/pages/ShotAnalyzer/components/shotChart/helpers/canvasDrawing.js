import { iconPaths } from '../../../../../design/iconPaths.js';

export function getChartLabelScale(chart) {
  const width = Number(chart?.width) || 0;
  if (width > 0 && width < 420) return 0.82;
  if (width > 0 && width < 640) return 0.9;
  return 1;
}

/**
 * The colours and fonts a chart was built with (`options.plugins.theme`), for the plugins that
 * draw on its canvas. A plugin never reads the document: the chart is rebuilt on a theme change.
 */
export function getChartTheme(chart) {
  return chart?.config?.options?.plugins?.theme?.tokens || null;
}

/** A glyph of the stroke set on a canvas: 1.6 wide on its 24 unit grid, round caps and joins. */
export function drawPixelIcon(ctx, { iconDef, x, y, size, color }) {
  const pathData = iconPaths[iconDef];
  if (!pathData) return;

  const width = 24;
  const height = 24;
  const scale = size / Math.max(width, height);

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
