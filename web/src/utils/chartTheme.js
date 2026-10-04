// Resolve concrete colors for Canvas; CSS variable expressions cannot be passed to Chart.js drawing code.
export function applyChartTheme(chart) {
  const css = getComputedStyle(document.documentElement);
  const read = name => css.getPropertyValue(name).trim();
  const mono = '"JetBrains Mono", ui-monospace, monospace';
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
  for (const scale of Object.values(chart.options.scales || {})) {
    scale.ticks = {
      ...scale.ticks,
      color: read('--ink-muted'),
      font: { ...scale.ticks?.font, family: mono },
    };
    scale.grid = { ...scale.grid, color: read('--chart-grid') };
    scale.border = { ...scale.border, color: read('--chart-grid') };
    if (scale.title) scale.title.color = read('--ink-muted');
  }
  const plugins = chart.options.plugins || {};
  if (plugins.legend?.labels) {
    plugins.legend.labels.color = read('--ink-muted');
    plugins.legend.labels.font = { ...plugins.legend.labels.font, family: mono };
  }
  if (plugins.title) plugins.title.color = read('--ink');
  if (plugins.tooltip) {
    Object.assign(plugins.tooltip, {
      backgroundColor: read('--surface-2'),
      titleColor: read('--ink'),
      bodyColor: read('--ink'),
      borderColor: read('--line'),
      borderWidth: 1,
      bodyFont: { family: mono },
      titleFont: { family: mono },
    });
  }
}
