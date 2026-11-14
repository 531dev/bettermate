import { useState } from 'preact/hooks';
import { Chip } from '../../../components/Chip.jsx';
import { Icon } from '../../../components/Icon.jsx';
import { Stat } from '../../../components/StatTile.jsx';
import { Cell, Tile } from '../../../components/Tile.jsx';
import { fmt, fmtDelta, MISSING } from '../utils/format';

const PHASE_METRIC_ROWS = [
  { key: 'p', label: 'Pressure', unit: 'bar' },
  { key: 'f', label: 'Pump flow', unit: 'ml/s' },
  { key: 'pf', label: 'Puck flow', unit: 'ml/s' },
  { key: 't', label: 'Temperature', unit: '°C' },
  { key: 'w', label: 'Weight', unit: 'g' },
];

function TargetDeltaCell({ entry, unit }) {
  if (!entry) return <td className='text-right'>{MISSING}</td>;
  return (
    <td className='text-right whitespace-nowrap'>
      {fmt(entry.target)} {unit} ({fmtDelta(entry.delta)})
    </td>
  );
}

// A reading of the phase with its target and the distance to it, when the profile sets one.
function PhaseReading({ label, value, unit, delta }) {
  return (
    <Cell>
      <Stat size='sm' label={label} value={fmt(value)} unit={unit}>
        {delta && (
          <span className='bm-data'>
            target {fmt(delta.target)} {unit}, {fmtDelta(delta.delta)} {unit}
          </span>
        )}
      </Stat>
    </Cell>
  );
}

function PhaseSection({ phase, hideExitReasons = false }) {
  const [open, setOpen] = useState(phase.isTotal || false);
  const td = phase.targetDeltas || {};
  const exitReasons = Object.entries(phase.exitReasonDistribution ?? {}).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <Tile data-statistics-phase={phase.isTotal ? 'total' : phase.phaseName}>
      <button
        type='button'
        className='flex w-full cursor-pointer items-center justify-between gap-3 text-left'
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className='flex min-w-0 flex-wrap items-baseline gap-x-3'>
          <span className='bm-sub'>{phase.phaseName}</span>
          <span className='bm-data'>
            {phase.shotCount} {phase.shotCount === 1 ? 'entry' : 'entries'}
          </span>
        </span>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          className='text-(--ink-muted)'
        />
      </button>

      {open && (
        <>
          <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
            <PhaseReading label='Duration' value={phase.avgDuration} unit='s' delta={td.duration} />
            <PhaseReading
              label='Pumped water'
              value={td.water ? td.water.actual : phase.avgWater}
              unit='ml'
              delta={td.water}
            />
          </div>

          <div className='an-scroll overflow-x-auto'>
            <table className='bm-table'>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className='text-right' title='Time-weighted average'>
                    Average
                  </th>
                  <th className='text-right'>Min</th>
                  <th className='text-right'>Max</th>
                  <th className='text-right' title='Average target value and deviation'>
                    Target (delta)
                  </th>
                </tr>
              </thead>
              <tbody>
                {PHASE_METRIC_ROWS.map(row => {
                  const m = phase.metrics[row.key];
                  if (!m) return null;
                  return (
                    <tr key={row.key}>
                      <td className='whitespace-nowrap'>
                        <span className='an-label'>{row.label}</span>{' '}
                        <span className='text-(--ink-muted)'>{row.unit}</span>
                      </td>
                      <td className='text-right'>{fmt(m.avg)}</td>
                      <td className='text-right'>{fmt(m.min)}</td>
                      <td className='text-right'>{fmt(m.max)}</td>
                      <TargetDeltaCell entry={td[row.key]} unit={row.unit} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!hideExitReasons && exitReasons.length > 0 && (
            <div className='flex flex-col gap-2'>
              <span className='bm-eyebrow'>Exit reasons</span>
              <div className='flex flex-wrap gap-1.5'>
                {exitReasons.map(([reason, count]) => (
                  <Chip key={reason}>
                    {reason} · {count}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Tile>
  );
}

export function PhaseStatistics({ phaseStats, showTitle = true, hideExitReasons = false }) {
  if (!phaseStats || phaseStats.length === 0) return null;

  // Separate regular phases from total row
  const phases = phaseStats.filter(p => !p.isTotal);
  const totalRow = phaseStats.find(p => p.isTotal);

  return (
    <div className='flex flex-col gap-2 lg:gap-3'>
      {showTitle && <h2 className='bm-sub px-1'>Per-phase statistics</h2>}
      {phases.map(phase => (
        <PhaseSection key={phase.phaseName} phase={phase} hideExitReasons={hideExitReasons} />
      ))}
      {totalRow && <PhaseSection key='total' phase={totalRow} hideExitReasons={hideExitReasons} />}
    </div>
  );
}
