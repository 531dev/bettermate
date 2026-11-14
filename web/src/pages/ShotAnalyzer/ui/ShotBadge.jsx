import { cx } from '../../../components/cx.js';
import './tool.css';

/**
 * Which shot of a comparison something belongs to. Shot 1 is a solid ink disc and its lines are
 * solid; shot 2 is a dashed ring and its lines are dashed; any further shot of a statistics
 * overlay is a muted ring.
 *   number  1, 2, 3 ...
 */
export function ShotBadge({ number = 1, className, ...rest }) {
  const index = Number(number) || 1;
  return (
    <span
      {...rest}
      className={cx('an-shot', index === 2 && 'an-shot--2', index > 2 && 'an-shot--n', className)}
      aria-label={rest['aria-label'] ?? `Shot ${index}`}
    >
      {index}
    </span>
  );
}
