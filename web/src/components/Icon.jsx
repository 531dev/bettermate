import { iconPaths } from '../design/iconPaths.js';
import { cx } from './cx.js';

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
      <path d={iconPaths[name] || iconPaths.info} />
    </svg>
  );
}
