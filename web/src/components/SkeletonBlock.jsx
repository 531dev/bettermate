import { cx } from './cx.js';

// A still placeholder for content that has not arrived: size it with `className`. Nothing in the
// design shimmers, and a reading that is merely late shows a dash instead of a block.
export function SkeletonBlock({ className, style }) {
  return <div aria-hidden='true' className={cx('bm-skeleton', className)} style={style} />;
}
