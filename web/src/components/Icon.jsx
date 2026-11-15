import { iconPaths } from '../design/iconPaths.js';
import { cx } from './cx.js';

// Glyphs the app needs that the design's set does not carry yet, drawn to the same rules. A name
// the set has always wins, so one added to `design/icons.json` later replaces its entry here.
const appPaths = {
  pin: 'M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z',
};

/**
 * One glyph of the stroke set: a 24 unit grid, 1.6 stroke, round caps and joins, in currentColor.
 * `size` alone sets its size: 24 on a page, 18 to 22 inside a small Button or the mode bar.
 * Give it a `title` when it stands without a word beside it; otherwise it is hidden from readers.
 */
export function Icon({ name, size = 24, className, spin = false, title, style, ...props }) {
  return (
    <svg
      {...props}
      viewBox='0 0 24 24'
      width={size}
      height={size}
      fill='none'
      stroke='currentColor'
      stroke-width='1.6'
      stroke-linecap='round'
      stroke-linejoin='round'
      data-icon={name}
      className={cx('bm-icon', spin && 'animate-spin', className)}
      style={{ ...style, width: size, height: size, minWidth: size }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <path d={iconPaths[name] || appPaths[name] || iconPaths.info} />
    </svg>
  );
}
