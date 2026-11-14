import { cx } from '../../../components/cx.js';

/**
 * The pin glyph, which the icon set of `design/iconPaths.js` does not carry: same 24 unit grid,
 * 1.6 stroke, round caps and joins, in currentColor. Pinned is said by the control around it
 * (`IconButton pressed`), never by a colour of the glyph.
 */
export function PinIcon({ size = 18, className }) {
  return (
    <svg
      viewBox='0 0 24 24'
      width={size}
      height={size}
      fill='none'
      stroke='currentColor'
      stroke-width='1.6'
      stroke-linecap='round'
      stroke-linejoin='round'
      data-icon='pin'
      className={cx('bm-icon', className)}
      aria-hidden='true'
    >
      <path d='M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z' />
    </svg>
  );
}
