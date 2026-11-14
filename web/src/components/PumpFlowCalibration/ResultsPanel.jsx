import { Stat } from '../StatTile.jsx';
import { Cell } from '../Tile.jsx';

export default function ResultsPanel({ results }) {
  // `previousCoeffs` is what the run started from: after a save the machine's own are the new ones.
  const { oneBar, nineBar, newCoeffs, previousCoeffs } = results;
  return (
    <>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <ResultCell title='1 bar' a={oneBar} />
        <ResultCell title='9 bar' a={nineBar} />
      </div>
      <Cell>
        <Stat label='Coefficients' value={newCoeffs} size='sm'>
          <span className='bm-data'>Was {previousCoeffs || '—'}</span>
        </Stat>
      </Cell>
    </>
  );
}

function ResultCell({ title, a }) {
  return (
    <Cell>
      <span className='bm-eyebrow'>{title}</span>
      <Fact label='Actual flow' value={`${a.actualFlow.toFixed(3)} ml/s`} />
      <Fact label='Estimated flow' value={`${a.estimatedFlow.toFixed(3)} ml/s`} />
      <Fact label='Factor' value={a.factor.toFixed(4)} />
    </Cell>
  );
}

function Fact({ label, value }) {
  return (
    <div className='bm-data flex justify-between gap-3'>
      <span>{label}</span>
      <span className='text-(--ink)'>{value}</span>
    </div>
  );
}
