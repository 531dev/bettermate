import { Chip } from '../../../components/Chip.jsx';
import { Dial } from '../../../components/Dial.jsx';
import { StageTrack } from '../../../components/StageTrack.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { warningTone } from '../../../utils/warnings.js';
import { FlushButton } from '../FlushButton.jsx';

/**
 * The machine at a glance: its mode and profile, one status Chip, the Dial, and under it the
 * phases of a running shot or the row of warnings and Flush.
 *   view      describeMachine()
 *   warnings  the active warnings worth naming here
 *   stages    the running shot's phases for a StageTrack, or null
 */
export function DialTile({ ds, view, warnings, stages, className }) {
  const { dial, chip } = view;
  // Stays mounted while held, so a hold-to-flush can still see its release.
  const showFlush = ds.isBrewing && (ds.isFlushing || (!ds.isActive && !ds.isFinished));
  // A reading in grams or seconds carries its unit raised beside it; a temperature has its degree sign.
  const centre = dial.unit ? (
    <>
      <span className='bm-eyebrow'>{dial.label}</span>
      <span className='flex items-start gap-1'>
        <span className='bm-dial__value'>{dial.value ?? '—'}</span>
        <span className='bm-stat__unit'>{dial.unit}</span>
      </span>
      {dial.line && <span className='bm-dial__plan'>{dial.line}</span>}
    </>
  ) : undefined;

  return (
    <Tile
      aria-label='Machine'
      eyebrow={view.title}
      end={
        chip && (
          <Chip role='status' tone={chip.tone} dot={chip.dot}>
            {chip.label}
          </Chip>
        )
      }
      tone={view.heating ? 'heat' : undefined}
      className={className}
    >
      <Dial
        {...view.ring}
        role='group'
        aria-label='Live readings'
        eyebrow={dial.label}
        value={dial.value}
        plan={dial.line}
        className='lg:my-auto lg:w-[min(100%,300px)]'
      >
        {centre}
      </Dial>
      {stages && <StageTrack stages={stages} aria-label='Shot phases' role='group' />}
      {(warnings.length > 0 || showFlush) && (
        <div className='flex flex-wrap items-center gap-2'>
          {warnings.length > 0 && (
            <ul aria-label='Warnings' className='flex min-w-0 flex-wrap gap-1.5'>
              {warnings.map(w => (
                <li key={w.key}>
                  <Chip tone={warningTone(w.level)}>{w.label}</Chip>
                </li>
              ))}
            </ul>
          )}
          {showFlush && (
            <span className='ml-auto'>
              <FlushButton
                isFlushing={ds.isFlushing}
                startFlush={ds.startFlush}
                stopFlush={ds.stopFlush}
              />
            </span>
          )}
        </div>
      )}
    </Tile>
  );
}
