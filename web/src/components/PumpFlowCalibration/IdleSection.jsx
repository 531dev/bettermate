import { Cell } from '../Tile.jsx';

export default function IdleSection({ currentCoeffs }) {
  return (
    <>
      <p className='bm-help'>
        Place a scale with a cup under the steam wand. Close the steam valve just enough for the
        machine to reach the target pressure during each <em>Build</em> phase.
      </p>
      <p role='alert' className='bm-notice bm-notice--warning'>
        <span>
          During the shot, adjust the valve so the pressure reaches 1 bar, then 9 bar. Keep it
          steady during the <em>Measure</em> phases (10 s each).
        </span>
      </p>
      <Cell>
        <span className='bm-eyebrow'>Current coefficients</span>
        <span className='bm-data text-(--ink)'>{currentCoeffs || '—'}</span>
      </Cell>
    </>
  );
}
