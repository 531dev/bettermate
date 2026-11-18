import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

// A warning or a fault always leads with its glyph: amber and the orange of heat are neighbours,
// and the glyph is what tells them apart (Chip card, Accessibility).
export const TONE_GLYPH = { warning: 'triangle-alert', danger: 'circle-alert' };

/**
 * A status word in a small tinted box: one or two words, set in uppercase mono by the recipe.
 * The word carries the meaning. One status Chip per tile, at the right of its head.
 *   tone  'success' ready or connected, 'heat' heating, 'primary' a process running,
 *         'warning' attention before the next shot (leads with triangle-alert), 'danger' a fault
 *         (leads with circle-alert), 'ink' the item in use; none for a fact (Pro, 30.2 s)
 *   dot   true for a live state; a CSS color for a chart legend entry. A warning or danger Chip
 *         shows its glyph instead.
 */
export function Chip({ tone, dot, className, children, ...rest }) {
  const glyph = TONE_GLYPH[tone];
  return (
    <span {...rest} className={cx('bm-chip', tone && `bm-chip--${tone}`, className)}>
      {glyph ? (
        <Icon name={glyph} size={14} />
      ) : (
        dot && (
          <i
            className='bm-chip__dot'
            style={typeof dot === 'string' ? { background: dot } : undefined}
          />
        )
      )}
      {children}
    </span>
  );
}
