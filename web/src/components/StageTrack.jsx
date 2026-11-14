import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

/**
 * The phases of a process as a row of bars: done, running, to come. Three to five steps, each
 * named in one word. It sits under the Dial during a shot and nowhere else on the dashboard.
 *   stages  [{ name, weight?, progress?, state? }]
 *           weight    the step's planned duration, in any unit: it sets the bar's width
 *           progress  0 to 1, the share of the running step that is done
 *           state     'done' or 'now'; none is still to come
 */
export function StageTrack({ stages, className, ...rest }) {
  return (
    <div {...rest} className={cx('bm-stages', className)}>
      {stages.map((stage, i) => {
        const done = stage.state === 'done';
        const share = done ? 1 : Math.max(0, Math.min(1, stage.progress || 0));
        return (
          <div
            key={i}
            className={cx('bm-stages__step', done && 'is-done', stage.state === 'now' && 'is-now')}
            style={stage.weight ? { '--w': stage.weight } : undefined}
          >
            <div className='bm-stages__bar'>
              <i style={{ '--p': `${Math.round(share * 100)}%` }} />
            </div>
            <span className='bm-stages__name'>
              {done && <Icon name='check' size={14} />}
              <span>{stage.name}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
