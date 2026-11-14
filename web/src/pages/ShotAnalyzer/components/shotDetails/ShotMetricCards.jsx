import { Stat } from '../../../../components/StatTile.jsx';
import { Cell, Tile } from '../../../../components/Tile.jsx';

const metricRows = [
  { key: 'duration', label: 'Duration', unit: 's', getValue: total => total?.duration },
  { key: 'w', label: 'Weight', unit: 'g', getValue: total => total?.weight },
  { key: 'tt', label: 'Target temperature', unit: '°C', getValue: total => total?.tt?.avg },
  { key: 't', label: 'Avg. temperature', unit: '°C', getValue: total => total?.t?.avg },
  { key: 'pPeak', label: 'Peak pressure', unit: 'bar', getValue: total => total?.p?.max },
  { key: 'f', label: 'Avg. pump flow', unit: 'ml/s', getValue: total => total?.f?.avg },
  { key: 'water', label: 'Pumped water', unit: 'ml', getValue: total => total?.water },
];

/** A reading with one decimal, or nothing when the shot has no such value: a Stat then shows a dash. */
function formatReading(value, digits = 1) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : null;
}

function getMetricItems(total, excludeKeys) {
  return metricRows
    .filter(row => !excludeKeys.includes(row.key))
    .map(row => ({ ...row, value: formatReading(row.getValue(total)) }))
    .filter(row => row.value !== null);
}

/** The three readings that sum a shot up: how long, how much, how hot. */
export function ShotSummaryMetricsRow({ total }) {
  return (
    <div className='flex flex-wrap justify-between gap-x-3 gap-y-2'>
      <Stat size='sm' label='Duration' value={formatReading(total?.duration)} unit='s' />
      <Stat size='sm' label='Weight' value={formatReading(total?.weight)} unit='g' />
      <Stat size='sm' label='Temperature' value={formatReading(total?.tt?.avg)} unit='°C' />
    </div>
  );
}

/**
 * The readings of a shot, two to a row.
 *   flat  the readings sit on the ground of whatever holds them instead of in cells
 */
export function MetricValueGrid({ total, excludeKeys = [], flat = false }) {
  const items = getMetricItems(total, excludeKeys);
  if (items.length === 0) return null;

  return (
    <div className={flat ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-2'}>
      {items.map(row => {
        const stat = (
          <Stat
            key={row.key}
            size='sm'
            label={row.label}
            value={row.value}
            unit={row.unit}
            className='flex-1 justify-between'
          />
        );
        return flat ? (
          stat
        ) : (
          <Cell key={row.key} className='px-3 xl:px-4'>
            {stat}
          </Cell>
        );
      })}
    </div>
  );
}

/** The readings the summary leaves out, in their own tile. Nothing when the shot has none. */
export function ShotMetricsTile({ total, className }) {
  const excludeKeys = ['duration', 'w', 'tt'];
  if (getMetricItems(total, excludeKeys).length === 0) return null;

  return (
    <Tile eyebrow='Shot metrics' className={className}>
      <MetricValueGrid total={total} excludeKeys={excludeKeys} />
    </Tile>
  );
}
