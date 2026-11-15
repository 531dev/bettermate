import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from './cx.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

const AUTO_FALLBACK = 20;

/**
 * How many ticks fit the row, following it as it resizes. Off when `enabled` is false.
 * The tick's width (--seg-w) and the gap come from the .bm-segbar recipe.
 */
function useFittedCount(ref, enabled) {
  const [count, setCount] = useState(AUTO_FALLBACK);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return undefined;
    const style = getComputedStyle(el);
    const tick = parseFloat(style.getPropertyValue('--seg-w')) || 4;
    const gap = parseFloat(style.columnGap) || 0;
    const fit = width => setCount(Math.max(1, Math.floor((width + gap) / (tick + gap))));
    fit(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => fit(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, enabled]);
  return count;
}

/**
 * A quantity as a row of discrete segments: lit in a tone, unlit in track.
 * Every segment is the Dial's tick, one size across the app, so a wider row holds more of them.
 *   value   0 to 1, the lit share of the scale
 *   target  0 to 1, a longer ink tick, as the Dial's notch; only for a reading with a set point
 *   total   a fixed count, for a scale whose steps mean something (a rating of 5) or a fill track;
 *           left out, the row holds as many segments as fit
 *   tone    'heat', 'primary', 'flow' or 'weight'; none is ink
 *   fill    segments stretch to share the row's width; only for a thin track that maps a position,
 *           such as a scrubber or the progress inside an ActionBanner
 *   label   names the bar when no numeral beside it carries the value
 */
export function SegmentBar({
  value,
  target,
  total: fixedTotal,
  tone,
  fill = false,
  label,
  as: Tag = 'div',
  className,
}) {
  const ref = useRef(null);
  const fitted = useFittedCount(ref, fixedTotal == null);
  const total = fixedTotal ?? fitted;
  const on = Number.isFinite(value) ? clamp(Math.round(value * total), 0, total) : 0;
  const mark =
    Number.isFinite(target) && target >= 0 ? clamp(Math.round(target * total), 0, total - 1) : -1;

  return (
    <Tag
      ref={ref}
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
