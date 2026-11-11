import { cx } from './cx.js';

/**
 * A status word in a small tinted box: one or two words, set in uppercase mono by the recipe.
 * The word carries the meaning. One status Chip per tile, at the right of its head.
 *   tone  'success' ready or connected, 'heat' heating, 'primary' a process running,
 *         'warning' attention before the next shot, 'danger' a fault, 'ink' the item in use;
 *         none for a fact (Pro, 30.2 s)
 *   dot   true for a live state; a CSS color for a chart legend entry
 */
export function Chip({ tone, dot, className, children, ...rest }) {
  return (
    <span {...rest} className={cx('bm-chip', tone && `bm-chip--${tone}`, className)}>
      {dot && (
        <i
          className='bm-chip__dot'
          style={typeof dot === 'string' ? { background: dot } : undefined}
        />
      )}
      {children}
    </span>
  );
}
