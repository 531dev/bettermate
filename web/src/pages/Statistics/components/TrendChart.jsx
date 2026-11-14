/* global globalThis */

import { useEffect, useRef, useState } from 'preact/hooks';
import Chart from 'chart.js/auto';
import { Select } from '../../../components/Field.jsx';
import { Tile } from '../../../components/Tile.jsx';
import {
  gridStyle,
  lineStyle,
  LINE_WIDTH,
  PRESSURE_LINE_WIDTH,
  readChartTokens,
  tickStyle,
  useThemeVersion,
} from '../../ShotAnalyzer/ui/chartTokens.js';
import {
  aggregateTrendsByGranularity,
  formatTrendBucketTickLabel,
  formatTrendBucketTooltipTitle,
} from '../utils/trendBuckets';

// Chart-level trend aggregation stays local to this component so users can switch
// metric and bucket size without rerunning StatisticsService.
// `series` names the chart token the line takes (ui/chartTokens.js).
const TREND_METRICS = [
  { key: 'duration', label: 'Duration (s)', series: 'duration' },
  { key: 'weight', label: 'Weight (g)', series: 'weight' },
  { key: 'water', label: 'Pumped water (ml)', series: 'water' },
  { key: 'shotCount', label: 'Shots', series: 'ink' },
  { key: 'avgPressure', label: 'Pressure (bar)', series: 'pressure' },
  { key: 'avgFlow', label: 'Pump flow (ml/s)', series: 'flow' },
  { key: 'avgTemp', label: 'Temperature (\u00b0C)', series: 'temperature' },
  { key: 'avgPuckFlow', label: 'Puck flow (ml/s)', series: 'puckFlow' },
];

const GRANULARITY_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function getGranularityLabel(granularity) {
  return GRANULARITY_OPTIONS.find(option => option.value === granularity)?.label || 'Month';
}

function getAdaptiveMaxTicks(containerWidth) {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 8;
  if (containerWidth < 360) return 4;
  if (containerWidth < 520) return 6;
  if (containerWidth < 760) return 8;
  return 10;
}

function formatTrendMetricValue(value, metricKey) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '';
  return metricKey === 'shotCount' ? String(Math.round(numericValue)) : numericValue.toFixed(1);
}

function formatUniqueTrendMetricTick(value, index, ticks, metricKey) {
  const label = formatTrendMetricValue(value, metricKey);
  if (!label || index === 0 || !Array.isArray(ticks)) return label;

  const previousLabel = formatTrendMetricValue(ticks[index - 1]?.value, metricKey);
  return label === previousLabel ? '' : label;
}

export function TrendChart({ trends }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);
  const [selectedMetric, setSelectedMetric] = useState('shotCount');
  const [selectedGranularity, setSelectedGranularity] = useState('day');
  const [containerWidth, setContainerWidth] = useState(0);
  const themeVersion = useThemeVersion();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => {
      const nextWidth = element.getBoundingClientRect().width;
      setContainerWidth(prev => (Math.abs(prev - nextWidth) < 1 ? prev : nextWidth));
    };

    updateWidth();

    // Only the tick density adapts to width; the selected bucket size remains user-controlled.
    if (typeof ResizeObserver === 'undefined') {
      globalThis.window?.addEventListener('resize', updateWidth);
      return () => globalThis.window?.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.destroy();
      chartInstance.current = null;
    }

    if (!trends || trends.length === 0 || !canvasRef.current) return;

    const metricDef = TREND_METRICS.find(m => m.key === selectedMetric) || TREND_METRICS[0];
    const tokens = readChartTokens();
    const metricLabel =
      metricDef.key === 'shotCount'
        ? `Shots / ${getGranularityLabel(selectedGranularity).toLowerCase()}`
        : metricDef.label;
    const data = aggregateTrendsByGranularity(trends, metricDef.key, selectedGranularity);
    const maxTicksLimit = getAdaptiveMaxTicks(containerWidth);
    const tooltipFont = { family: tokens.fontMono, size: 11, weight: 400 };

    try {
      chartInstance.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          datasets: [
            {
              label: metricLabel,
              data,
              tension: 0,
              ...lineStyle(tokens[metricDef.series], {
                width: metricDef.series === 'pressure' ? PRESSURE_LINE_WIDTH : LINE_WIDTH,
              }),
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: tokens.surface2,
              borderColor: tokens.line,
              borderWidth: 1,
              cornerRadius: 8,
              padding: 8,
              displayColors: false,
              titleColor: tokens.ink,
              bodyColor: tokens.inkMuted,
              titleFont: { ...tooltipFont, weight: 500 },
              bodyFont: tooltipFont,
              callbacks: {
                title: ctx => {
                  const raw = ctx[0]?.raw;
                  return formatTrendBucketTooltipTitle(raw, selectedGranularity);
                },
                label: ctx =>
                  `${metricLabel}: ${formatTrendMetricValue(ctx.parsed.y, metricDef.key)}`,
                afterBody: ctx => {
                  if (metricDef.key === 'shotCount') return [];
                  const raw = ctx?.[0]?.raw;
                  if (!raw || !Number.isFinite(raw.shotCount)) return [];
                  return [`Shots: ${raw.shotCount}`];
                },
              },
            },
          },
          scales: {
            x: {
              type: 'linear',
              border: { display: false },
              ticks: {
                ...tickStyle(tokens),
                // the first and last dates stay inside the plot, clear of the y axis numbers
                align: 'inner',
                // Two ticks inside one bucket would carry the same date: the second stays blank.
                callback: (value, index, ticks) => {
                  const labelOf = tickValue =>
                    formatTrendBucketTickLabel(Number(tickValue), selectedGranularity, {
                      containerWidth,
                    });
                  const label = labelOf(value);
                  return index > 0 && labelOf(ticks[index - 1]?.value) === label ? '' : label;
                },
                maxTicksLimit,
              },
              grid: gridStyle(tokens, false),
            },
            y: {
              min: metricDef.key === 'shotCount' ? 0 : undefined,
              border: { display: false },
              ticks: {
                ...tickStyle(tokens),
                maxTicksLimit: 4,
                padding: 8,
                callback: (value, index, ticks) =>
                  formatUniqueTrendMetricTick(value, index, ticks, metricDef.key),
              },
              grid: gridStyle(tokens),
            },
          },
        },
      });
    } catch {
      // Chart creation can fail transiently during rapid metric/granularity switches.
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [trends, selectedMetric, selectedGranularity, containerWidth, themeVersion]);

  if (!trends || trends.length === 0) return null;

  const bucketCount = aggregateTrendsByGranularity(
    trends,
    selectedMetric,
    selectedGranularity,
  ).length;

  return (
    <Tile data-statistics-trend>
      <div className='bm-tile__head flex-wrap'>
        <span className='bm-eyebrow'>Trend</span>
        <div className='flex min-w-0 items-center gap-2'>
          <Select
            className='an-input--sm'
            value={selectedMetric}
            onChange={e => setSelectedMetric(e.target.value)}
            aria-label='Trend metric'
            title='Trend metric'
          >
            {TREND_METRICS.map(m => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select
            className='an-input--sm'
            value={selectedGranularity}
            onChange={e => setSelectedGranularity(e.target.value)}
            aria-label='Trend bucket size'
            title='Trend bucket size'
          >
            {GRANULARITY_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {/* A line needs two buckets: one bucket is a single value, and a chart draws no points. */}
      {bucketCount < 2 && (
        <p className='bm-help' data-statistics-trend-single>
          All shots fall into one {getGranularityLabel(selectedGranularity).toLowerCase()}. A trend
          needs at least two.
        </p>
      )}
      <div
        ref={containerRef}
        className={bucketCount < 2 ? 'hidden' : 'relative h-52 w-full'}
        data-chart='statistics-trend'
      >
        <canvas ref={canvasRef} />
      </div>
    </Tile>
  );
}
