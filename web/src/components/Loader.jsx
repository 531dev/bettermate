import { cx } from './cx.js';

// Twelve ticks 30 degrees apart, from radius 6.5 to 10 of a 24 box, the first at twelve o'clock.
// The first three are lit and step round (bm.css `bm-loader__lit`), as the display's busy comet.
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = ((i * 30 - 90) * Math.PI) / 180;
  const at = r => [(12 + r * Math.cos(a)).toFixed(2), (12 + r * Math.sin(a)).toFixed(2)];
  const [[x1, y1], [x2, y2]] = [at(6.5), at(10)];
  return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
});

/**
 * The machine is working on something asked of it: three lit ticks stepping round a small ring
 * in currentColor. Always beside words that say what is happening; the SVG itself is hidden from
 * assistive technology, so set `aria-busy` on the control or region that is working.
 *   size  14 in a field's message, 18 or 20 in a Button, a Notice or a row, 24 in the
 *         ActionBanner's disc, 40 alone in a Dialog
 */
export function Loader({ size = 20, className }) {
  return (
    <svg
      className={cx('bm-loader', className)}
      viewBox='0 0 24 24'
      width={size}
      height={size}
      fill='none'
      aria-hidden='true'
    >
      {TICKS}
      <g className='bm-loader__lit'>{TICKS.slice(0, 3)}</g>
    </svg>
  );
}
