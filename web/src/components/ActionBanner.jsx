import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { SegmentBar } from './SegmentBar.jsx';

/**
 * The one cobalt thing on a view: what you can do next, with the action's glyph in a disc.
 * One per page, directly under the Dial tile.
 *   label     two words, a verb first: 'Start shot', 'Wake up', 'Start grinding'
 *   sub       the consequence: 'Stops at 36 g', 'Ready in about 4 min'
 *   icon      'play', 'power', 'stop'
 *   stop      a process is running: the ground turns ink and the label says to stop
 *   progress  0 to 1 while it runs, drawn as 24 segments inside the banner
 *   stretch   on the desktop grid, fill the row and set the label at the bottom left
 */
export function ActionBanner({
  label,
  sub,
  icon = 'play',
  stop = false,
  progress,
  stretch = false,
  className,
  ...rest
}) {
  return (
    <button
      type='button'
      {...rest}
      className={cx('bm-cta', stop && 'bm-cta--stop', stretch && 'bm-cta--stretch', className)}
    >
      <span className='bm-cta__text'>
        <span className='bm-cta__label'>{label}</span>
        {sub && <span className='bm-cta__sub'>{sub}</span>}
        {progress != null && <SegmentBar as='span' value={progress} total={24} />}
      </span>
      <span className='bm-cta__disc'>
        <Icon name={icon} />
      </span>
    </button>
  );
}
