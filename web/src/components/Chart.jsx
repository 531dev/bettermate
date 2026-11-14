import { useEffect, useRef } from 'preact/hooks';
import { Chart, LineController, LineElement, LinearScale, PointElement } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { applyChartTheme, chartFont, seriesColor } from '../utils/chartTheme.js';
import { Chip } from './Chip.jsx';
import { cx } from './cx.js';

// Everything these charts draw with, so a page registers nothing to use one.
Chart.register(LineController, LineElement, PointElement, LinearScale, annotationPlugin);

// A reading worked out from another one shares the color of its source and draws dotted, so its
// mark in the legend is a short dotted stroke instead of the dot, as in the Analyzer's legend.
const dottedMark = series => ({
  width: 12,
  height: 0,
  borderTop: `2px dotted ${seriesColor(series)}`,
  borderRadius: 0,
  background: 'none',
});

/** The legend: a neutral Chip for each series, its dot in the series color. A target has none. */
export function ChartLegend({ datasets, className }) {
  const named = datasets.filter(dataset => dataset.label && dataset.kind !== 'target');
  return (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {named.map(dataset =>
        dataset.kind === 'estimate' ? (
          <Chip key={dataset.label}>
            <i className='bm-chip__dot' style={dottedMark(dataset.series)} />
            {dataset.label}
          </Chip>
        ) : (
          <Chip key={dataset.label} dot={seriesColor(dataset.series)}>
            {dataset.label}
          </Chip>
        ),
      )}
    </div>
  );
}

/**
 * A line chart: the legend, then a canvas that fills what is left of the box.
 *   data            the Chart.js config, built with the helpers of utils/chartTheme.js. A new
 *                   object replaces what the chart shows; nothing animates.
 *   className       the box; give it a height, or cap the canvas with `chartClassName`
 *   plotClassName   the canvas's own box, to give the plot a height the legend cannot take from
 *   chartClassName  the canvas
 *   legend          false to leave the Chips out and place a ChartLegend elsewhere
 *   label           the canvas's name for screen readers; the series names by default
 *   chartRef        receives the Chart, for a live chart that appends to its own data and updates
 */
export function ChartComponent({
  data,
  className,
  plotClassName,
  chartClassName,
  style,
  legend = true,
  label,
  chartRef,
}) {
  const canvas = useRef();
  const chart = useRef();
  const shown = useRef(data);

  useEffect(() => {
    applyChartTheme(shown.current, canvas.current);
    const created = new Chart(canvas.current, shown.current);
    chart.current = created;

    let alive = true;
    const retheme = () => {
      if (!alive) return;
      applyChartTheme(created.config, created.canvas);
      created.update('none');
    };
    // The colors follow the theme, and the text is laid out again once its font has arrived.
    const observer = new MutationObserver(retheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    if (!document.fonts.check(chartFont())) {
      document.fonts.load(chartFont()).then(retheme, () => {});
    }

    // Chart.js follows its box by itself; iOS home-screen apps miss a rotation without this.
    const resize = () => alive && created.resize();
    const rotate = () => setTimeout(resize, 100);
    window.addEventListener('orientationchange', rotate);
    window.visualViewport?.addEventListener('resize', resize);

    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener('orientationchange', rotate);
      window.visualViewport?.removeEventListener('resize', resize);
      created.destroy();
    };
  }, []);

  useEffect(() => {
    if (!chartRef) return undefined;
    chartRef.current = chart.current;
    return () => {
      chartRef.current = null;
    };
  }, [chartRef]);

  useEffect(() => {
    if (shown.current === data) return;
    shown.current = data;
    applyChartTheme(data, canvas.current);
    chart.current.data = data.data;
    chart.current.options = data.options;
    chart.current.update('none');
  }, [data]);

  const names = data.data.datasets
    .filter(dataset => dataset.label && dataset.kind !== 'target')
    .map(dataset => dataset.label);

  return (
    <div className={cx('flex min-w-0 flex-col gap-3', className)} style={style}>
      {legend && <ChartLegend datasets={data.data.datasets} />}
      <div className={cx('relative min-h-0 w-full min-w-0 flex-1', plotClassName)}>
        <canvas
          ref={canvas}
          className={chartClassName}
          role='img'
          aria-label={label || `${names.join(', ')} over time`}
        />
      </div>
    </div>
  );
}
