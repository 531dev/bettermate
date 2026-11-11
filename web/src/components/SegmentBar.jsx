import { cx } from './cx.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

/**
 * A quantity as a row of discrete segments: lit in a tone, unlit in track.
 *   value   0 to 1, the lit share of the scale
 *   target  0 to 1, a short ink mark above one segment; only for a reading with a set point
 *   total   20 for a level or a reading, 24 inside an ActionBanner
 *   tone    'heat', 'primary', 'flow' or 'weight'; none is ink
 *   fill    segments share the row's width (the default); false keeps them 6px wide
 *   label   names the bar when no numeral beside it carries the value
 */
export function SegmentBar({
  value,
  target,
  total = 20,
  tone,
  fill = true,
  label,
  as: Tag = 'div',
  className,
}) {
  const on = Number.isFinite(value) ? clamp(Math.round(value * total), 0, total) : 0;
  const mark =
    Number.isFinite(target) && target >= 0 ? clamp(Math.round(target * total), 0, total - 1) : -1;

  return (
    <Tag
      className={cx(
        'bm-segbar',
        fill && 'bm-segbar--fill',
        tone && `bm-segbar--${tone}`,
        className,
      )}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={cx(i < on && 'on', i === mark && 'target') || undefined} />
      ))}
    </Tag>
  );
}

/** A count as a grid of dots: `on` of `total` lit, `cols` to a row. */
export function Dots({ on = 0, total, cols = 20, label, className }) {
  return (
    <div
      className={cx('bm-dots', className)}
      style={{ '--cols': cols }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < on ? 'on' : undefined} />
      ))}
    </div>
  );
}
