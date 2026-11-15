import { cx } from '../../../components/cx.js';
import { Stat } from '../../../components/StatTile.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { fmt, MISSING } from '../utils/format';

// `tone` is the series of the metric, as a segment bar draws it; none is ink.
const METRIC_ROWS = [
  {
    key: 'w',
    label: 'Weight',
    unit: 'g',
    tone: 'weight',
    averageDescription: 'Final shot weight average',
  },
  {
    key: 'duration',
    label: 'Duration',
    unit: 's',
    averageDescription: 'Per-shot duration average',
  },
  {
    key: 'tt',
    label: 'Target temperature',
    unit: '°C',
    tone: 'heat',
    averageDescription: 'Time-weighted average target temperature',
  },
  {
    key: 't',
    label: 'Temperature',
    unit: '°C',
    tone: 'heat',
    averageDescription: 'Time-weighted average temperature',
  },
  {
    key: 'ttDelta',
    label: 'Target temperature Δ',
    unit: '°C',
    tone: 'heat',
    digits: 2,
    averageDescription: 'Per-shot absolute delta between measured and target average temperature',
  },
  {
    key: 'p',
    label: 'Pressure',
    unit: 'bar',
    tone: 'primary',
    averageDescription: 'Time-weighted average pressure',
  },
  {
    key: 'pPeak',
    label: 'Peak pressure',
    unit: 'bar',
    tone: 'primary',
    averageDescription: 'Average of each shot peak pressure',
  },
  {
    key: 'f',
    label: 'Pump flow',
    unit: 'ml/s',
    tone: 'flow',
    averageDescription: 'Time-weighted average flow',
  },
  {
    key: 'water',
    label: 'Pumped water',
    unit: 'ml',
    tone: 'flow',
    averageDescription: 'Per-shot water drawn average',
  },
  {
    key: 'pf',
    label: 'Puck flow',
    unit: 'ml/s',
    tone: 'flow',
    averageDescription: 'Time-weighted average puck flow',
  },
  {
    key: 'pr',
    label: 'Puck resistance',
    unit: 's·√bar/ml',
    averageDescription: 'Time-weighted average puck resistance',
    requiresData: true,
  },
  {
    key: 'lr',
    label: 'Liquid resistance',
    unit: 'bar·s/ml',
    averageDescription: 'Time-weighted average liquid resistance',
    requiresData: true,
  },
];

const RANGE_SEGMENTS = 24;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatMetricValue(value, row) {
  const formatted = fmt(value, row.digits);
  if (formatted === MISSING) return formatted;
  return `${row.avgPrefix || ''}${formatted}`;
}

// Where the average and the band of one standard deviation sit between min and max, in segments.
function getRangeSegments(metric) {
  const min = Number(metric?.min);
  const max = Number(metric?.max);
  const avg = Number(metric?.avg);
  const stdDev = Math.max(0, Number(metric?.stdDev) || 0);
  const range = max - min;

  if (!Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(avg) || range <= 0) {
    return null;
  }

  const toSegment = value =>
    clamp(Math.round(((value - min) / range) * (RANGE_SEGMENTS - 1)), 0, RANGE_SEGMENTS - 1);

  return {
    average: toSegment(avg),
    from: stdDev > 0 ? toSegment(avg - stdDev) : -1,
    to: stdDev > 0 ? toSegment(avg + stdDev) : -1,
  };
}

/**
 * The spread of a metric between its lowest and highest shot: the lit run is one standard
 * deviation either side of the average, and the ink mark above the row is the average.
 */
function MetricRange({ row, metric }) {
  const segments = getRangeSegments(metric);
  const low = fmt(metric.min, row.digits);
  const high = fmt(metric.max, row.digits);

  return (
    <div className='flex flex-col gap-1'>
      <div
        className={cx('bm-segbar st-range', row.tone && `bm-segbar--${row.tone}`)}
        role='img'
        aria-label={`${row.label}: lowest ${low}, highest ${high}, standard deviation ${fmt(metric.stdDev, row.digits)} ${row.unit}`}
      >
        {Array.from({ length: RANGE_SEGMENTS }, (_, index) => (
          <i
            key={index}
            className={
              cx(
                segments && index >= segments.from && index <= segments.to && 'on',
                segments && index === segments.average && 'target',
              ) || undefined
            }
          />
        ))}
      </div>
      <div className='bm-tick flex items-baseline justify-between gap-2'>
        <span>{low}</span>
        <span>± {fmt(metric.stdDev, row.digits)}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function MetricTile({ row, metric }) {
  return (
    <Tile title={undefined} data-statistics-metric={row.key}>
      <Stat
        label={row.label}
        value={formatMetricValue(metric.avg, row)}
        unit={row.unit}
        size='sm'
      />
      <MetricRange row={row} metric={metric} />
      <p className='bm-caption'>{row.averageDescription}</p>
    </Tile>
  );
}

export function MetricsTable({ metrics }) {
  if (!metrics || Object.keys(metrics).length === 0) return null;

  return (
    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:gap-3'>
      {METRIC_ROWS.map(row => {
        const metric = metrics[row.key];
        if (!metric) return null;
        const count = Number(metric.count);
        if (row.requiresData && (Number.isNaN(count) || count <= 0)) return null;
        return <MetricTile key={row.key} row={row} metric={metric} />;
      })}
    </div>
  );
}
