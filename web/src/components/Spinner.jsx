import { cx } from './cx.js';

// Twelve ticks 30 degrees apart, from radius 7 to 10 of a 24 box. The first three are the comet.
const tick = i => {
  const angle = (i * Math.PI) / 6;
  const [x, y] = [Math.sin(angle), -Math.cos(angle)];
  const at = radius => `${(12 + radius * x).toFixed(2)} ${(12 + radius * y).toFixed(2)}`;
  return `M${at(7)}L${at(10)}`;
};
const RING = Array.from({ length: 12 }, (_, i) => tick(i)).join('');
const COMET = [0, 1, 2].map(tick).join('');
const SIZES = { 4: 16, 8: 24, 12: 28, 16: 40 };

/**
 * Busy, as the round display shows it: three lit ticks stepping round a ring, in currentColor.
 *   size  4, 8, 12 or 16: 16, 24, 28 or 40px
 */
export function Spinner({ size = 8, className }) {
  const px = SIZES[size] || SIZES[8];
  return (
    <svg
      className={cx('bm-spinner', className)}
      viewBox='0 0 24 24'
      width={px}
      height={px}
      role='status'
      aria-label='Loading'
    >
      <path d={RING} />
      <path className='bm-spinner__comet' d={COMET} />
    </svg>
  );
}
