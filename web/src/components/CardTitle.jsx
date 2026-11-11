import { cx } from './cx.js';

/** A mono label that heads a group inside a tile. */
export function CardTitle({ children, className }) {
  return <h3 className={cx('bm-eyebrow', className)}>{children}</h3>;
}
