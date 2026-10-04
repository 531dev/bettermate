export default function ResultsPanel({ results, currentCoeffs }) {
  const { oneBar, nineBar, newCoeffs } = results;
  return (
    <div className='mt-4 space-y-3'>
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        <ResultCard title='1 bar' a={oneBar} />
        <ResultCard title='9 bar' a={nineBar} />
      </div>
      <div className='border-primary bg-primary/10 rounded-md border p-3'>
        <div className='text-xs text-[var(--ink-muted)] uppercase'>Coefficients</div>
        <div className='mt-1 flex items-baseline gap-3'>
          <span className='font-mono text-sm text-[var(--ink-muted)]'>{currentCoeffs || '—'}</span>
          <span className='text-[var(--ink-muted)]'>→</span>
          <span className='text-primary font-mono text-2xl'>{newCoeffs}</span>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ title, a }) {
  return (
    <div className='rounded-md bg-[var(--surface-2)] p-3'>
      <div className='text-xs text-[var(--ink-muted)] uppercase'>{title}</div>
      <div className='mt-1 space-y-1 font-mono text-xs'>
        <Row label='actual flow' value={`${a.actualFlow.toFixed(3)} ml/s`} />
        <Row label='estimated flow' value={`${a.estimatedFlow.toFixed(3)} ml/s`} />
        <Row label='factor' value={a.factor.toFixed(4)} />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className='flex justify-between'>
      <span className='text-[var(--ink-muted)]'>{label}</span>
      <span>{value}</span>
    </div>
  );
}
