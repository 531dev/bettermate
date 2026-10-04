import { formatMetricValue } from '../../utils/analyzerUtils';

const metricRows = [
  {
    key: 'duration',
    label: 'Duration',
    unit: 's',
    color: 'var(--statistics-summary-duration)',
    icon: 'clock',
    getValue: total => total?.duration,
  },
  {
    key: 'w',
    label: 'Weight',
    unit: 'g',
    color: 'var(--analyzer-weight-text)',
    icon: 'scale',
    getValue: total => total?.weight,
  },
  {
    key: 'tt',
    label: 'Target Temperature',
    unit: '\u2103',
    color: 'var(--analyzer-target-temp-text)',
    icon: 'sliders-horizontal',
    getValue: total => total?.tt?.avg,
  },
  {
    key: 't',
    label: 'Avg. Temperature',
    unit: '\u2103',
    color: 'var(--analyzer-temp-text)',
    icon: 'thermometer',
    getValue: total => total?.t?.avg,
  },
  {
    key: 'pPeak',
    label: 'Peak Pressure',
    unit: 'bar',
    color: 'var(--analyzer-pressure-text)',
    icon: 'gauge',
    getValue: total => total?.p?.max,
  },
  {
    key: 'f',
    label: 'Avg. Pump Flow',
    unit: 'ml/s',
    color: 'var(--analyzer-flow-text)',
    icon: 'droplet',
    getValue: total => total?.f?.avg,
  },
  {
    key: 'water',
    label: 'Pumped Water',
    unit: 'ml',
    color: 'var(--statistics-summary-water)',
    icon: 'droplet',
    getValue: total => total?.water,
  },
];

function SummaryMetric({ label, unit, value }) {
  return (
    <div className='min-w-0 flex-1 text-center'>
      <div className='flex items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
        <span className='truncate font-mono text-base leading-none font-normal tabular-nums lg:text-sm xl:text-base'>
          {formatMetricValue(value)}
        </span>
        <span className='text-xs text-[var(--ink-muted)] lg:text-[0.68rem] xl:text-xs'>{unit}</span>
      </div>
      <div className='mt-0.5 truncate text-center text-xs leading-tight font-medium text-[var(--ink-muted)]'>
        {label}
      </div>
    </div>
  );
}

export function ShotSummaryMetricsRow({ total, className = '' }) {
  return (
    <div className={className || 'mt-4 flex gap-2 lg:mt-3.5 lg:gap-1.5 xl:mt-4 xl:gap-2'}>
      <SummaryMetric label='Duration' unit='s' value={total?.duration} />
      <SummaryMetric label='Weight' unit='g' value={total?.weight} />
      <SummaryMetric label='Temperature' unit='°C' value={total?.tt?.avg} />
    </div>
  );
}

export function MetricValueGrid({ total, excludeKeys = [], flat }) {
  const items = metricRows
    .filter(row => !excludeKeys.includes(row.key))
    .map(row => ({
      ...row,
      value: row.getValue(total),
    }))
    .filter(row => Number.isFinite(Number(row.value)));

  if (items.length === 0) return null;

  const itemClass = flat
    ? 'flex min-w-0 flex-col items-center justify-center text-center'
    : 'app-card-surface flex min-h-[3.4rem] min-w-0 flex-col items-center justify-center rounded-xl p-2 text-center lg:min-h-[3rem] lg:p-1.5 xl:min-h-[3.4rem] xl:p-2';

  return (
    <div className='grid grid-cols-2 gap-3'>
      {items.map(row => (
        <div key={row.key} className={itemClass}>
          <div className='analyzer-icon-metric analyzer-icon-metric--without-icon'>
            <div className='analyzer-icon-metric__content'>
              <div className='flex max-w-full items-baseline justify-center gap-1.5 lg:gap-1 xl:gap-1.5'>
                <span className='analyzer-icon-metric__value truncate font-mono text-base leading-none font-normal tabular-nums lg:text-sm xl:text-base'>
                  {formatMetricValue(row.value, row.digits)}
                </span>
                <span className='text-xs text-[var(--ink-muted)] lg:text-[0.68rem] xl:text-xs'>
                  {row.unit}
                </span>
              </div>
              <div className='mt-0.5 max-w-full truncate text-center text-xs leading-tight font-medium text-[var(--ink-muted)]'>
                {row.label}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
