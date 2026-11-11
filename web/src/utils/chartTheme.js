import { Chart } from 'chart.js';

// Whole-number axis with at most a handful of evenly spaced ticks.
export function niceAxis(low, high, steps = [1, 2, 5, 10, 20, 50]) {
  const step = steps.find(s => (high - low) / s <= 4) ?? 100;
  return { min: Math.floor(low / step) * step, max: Math.ceil(high / step) * step, step };
}

// Phase markers are annotations, which the shared theme below cannot reach once a chart is built.
export function phaseMarkerColors() {
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  return { line: read('--line-strong'), text: read('--surface-1'), background: read('--ink') };
}

// Resolve concrete colors for Canvas; CSS variable expressions cannot be passed to Chart.js drawing code.
export function applyChartTheme(chart) {
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  const fontFamily = '"Jost", system-ui, sans-serif';
  // Anything a chart leaves unset falls back to these.
  Chart.defaults.color = read('--ink-muted');
  Chart.defaults.borderColor = read('--chart-grid');
  for (const dataset of chart.data.datasets) {
    const label = String(dataset.label || '').toLowerCase();
    const token = label.includes('temp')
      ? '--series-temperature'
      : label.includes('pressure')
        ? '--series-pressure'
        : label.includes('weight')
          ? '--series-weight'
          : label.includes('flow')
            ? '--series-flow'
            : null;
    if (token) dataset.borderColor = read(token);
  }
  // The raw options: nested writes through chart.options, a resolver proxy, do not reach the drawing.
  const options = chart.config.options;
  for (const scale of Object.values(options.scales || {})) {
    scale.ticks = {
      ...scale.ticks,
      color: read('--ink-muted'),
      font: { ...scale.ticks?.font, family: fontFamily },
    };
    scale.grid = { ...scale.grid, color: read('--chart-grid') };
    scale.border = { ...scale.border, color: read('--chart-grid') };
    if (scale.title) scale.title.color = read('--ink-muted');
  }
  const plugins = options.plugins || {};
  if (plugins.legend?.labels) {
    plugins.legend.labels.color = read('--ink-muted');
    plugins.legend.labels.font = { ...plugins.legend.labels.font, family: fontFamily };
  }
  if (plugins.title) plugins.title.color = read('--ink');
  if (plugins.tooltip) {
    Object.assign(plugins.tooltip, {
      backgroundColor: read('--surface-2'),
      titleColor: read('--ink'),
      bodyColor: read('--ink'),
      borderColor: read('--line'),
      borderWidth: 1,
      bodyFont: { family: fontFamily },
      titleFont: { family: fontFamily },
    });
  }
}
