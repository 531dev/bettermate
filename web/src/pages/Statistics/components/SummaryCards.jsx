import { StatTile } from '../../../components/StatTile.jsx';
import { MISSING } from '../utils/format';

// Presentational only: the totals of a statistics run, one reading per tile.
function fmtNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : MISSING;
}

const pad2 = value => String(value).padStart(2, '0');

// A total time as one numeral with its unit: 42 s, 1:38 min, 2:05 h.
function splitDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return { value: '0', unit: 's' };
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) return { value: `${hours}:${pad2(minutes)}`, unit: 'h' };
  if (minutes > 0) return { value: `${minutes}:${pad2(remainingSeconds)}`, unit: 'min' };
  return { value: String(remainingSeconds), unit: 's' };
}

function splitAmount(value, unit, largeUnit) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return { value: MISSING, unit };
  if (Math.abs(numericValue) >= 1000) {
    return { value: (numericValue / 1000).toFixed(2), unit: largeUnit };
  }
  return { value: fmtNumber(numericValue), unit };
}

export function SummaryCards({ summary }) {
  if (!summary) return null;

  const totals = [
    {
      key: 'totalShots',
      label: 'Shots',
      value: Number.isFinite(summary.totalShots) ? String(summary.totalShots) : MISSING,
    },
    { key: 'totalWeight', label: 'Weight', ...splitAmount(summary.totalWeight, 'g', 'kg') },
    { key: 'totalWater', label: 'Pumped water', ...splitAmount(summary.totalWater, 'ml', 'l') },
    { key: 'totalDuration', label: 'Duration', ...splitDuration(summary.totalDuration) },
  ];

  return (
    <div className='grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3' data-statistics-summary>
      {totals.map(total => (
        <StatTile key={total.key} label={total.label} value={total.value} unit={total.unit} />
      ))}
    </div>
  );
}
