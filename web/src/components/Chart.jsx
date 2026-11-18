import { useEffect, useRef } from 'preact/hooks';
import { Chart, LineController, LineElement, LinearScale, PointElement } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { applyChartTheme, chartFont, endLabels, seriesColor } from '../utils/chartTheme.js';
import { Chip } from './Chip.jsx';
import { cx } from './cx.js';

// Everything these charts draw with, so a page registers nothing to use one.
Chart.register(LineController, LineElement, PointElement, LinearScale, annotationPlugin);

/** A sample of a line as the chart draws it: its colour, weight, dash and caps. */
function LineKey({ dataset }) {
  const dash = dataset.borderDash?.length ? dataset.borderDash.join(' ') : undefined;
  return (
    <svg className='bm-chart__key' viewBox='0 0 20 6' aria-hidden='true'>
      <line
        x1='1'
        y1='3'
        x2='19'
        y2='3'
        stroke={seriesColor(dataset.series)}
        stroke-width={dataset.borderWidth ?? 2}
        stroke-dasharray={dash}
        stroke-linecap={dataset.borderCapStyle || 'round'}
      />
    </svg>
  );
}

/**
 * The legend: a neutral Chip for each series with a sample of its line. A target has none.
 * Inside a ChartComponent it shows only on a chart wider than 480px; the end labels name the
 * lines below that.
 */
export function ChartLegend({ datasets, className }) {
  const named = datasets.filter(dataset => dataset.label && dataset.kind !== 'target');
  return (
    <div className={cx('bm-chartbox__legend', className)}>
      {named.map(dataset => (
        <Chip key={dataset.label}>
          <LineKey dataset={dataset} />
          {dataset.label}
        </Chip>
      ))}
    </div>
  );
}

/**
 * A line chart: the legend, then a canvas that fills what is left of the box.
 *   data            the Chart.js config, built with the helpers of utils/chartTheme.js. A new
 *                   object replaces what the chart shows; nothing animates.
 *   className       the box; give it a height, or cap the canvas with `chartClassName`
 *   plotClassName   the canvas's own box, to give the plot a height the legend cannot take from
 *   plotStyle       the same as a style: a height in px that a setting holds
 *   chartClassName  the canvas
 *   legend          false to leave the Chips out and place a ChartLegend elsewhere
 *   label           the chart's own name, said before what it shows: the series, the span of
 *                   time and the final values, kept current as it grows
 *   chartRef        receives the Chart, for a live chart that appends to its own data and updates
 */
export function ChartComponent({
  data,
  className,
  plotClassName,
  plotStyle,
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
    const created = new Chart(canvas.current, { ...shown.current, plugins: [endLabels] });
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

  return (
    <div className={cx('bm-chartbox flex min-w-0 flex-col gap-3', className)} style={style}>
      {legend && <ChartLegend datasets={data.data.datasets} />}
      <div
        className={cx('relative min-h-0 w-full min-w-0 flex-1', plotClassName)}
        style={plotStyle}
      >
        <canvas ref={canvas} className={chartClassName} role='img' data-chart-name={label} />
      </div>
    </div>
  );
}
