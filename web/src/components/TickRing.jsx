import { cx } from './cx.js';

// The round display's ring as design/reference/components/bundle.js draws it: a 480 box centred
// on 240, angles clockwise from +x with y down. A tick runs from radius 212 to 234, and the
// target notch reaches in to 204.
const CENTRE = 240;
const INNER = 212;
const OUTER = 234;
const NOTCH = 204;
const ARCS = {
  left: { start: 110, sweep: 140, n: 36 }, // temperature: bottom left up to top left
  right: { start: 70, sweep: -140, n: 36 }, // pressure: bottom right up to top right
  full: { start: 120, sweep: 300, n: 76 }, // one quantity, with a 60 degree gap at the bottom
};

const point = (degrees, radius) => {
  const angle = (degrees * Math.PI) / 180;
  return [
    (CENTRE + radius * Math.cos(angle)).toFixed(1),
    (CENTRE + radius * Math.sin(angle)).toFixed(1),
  ];
};

// Every tick's outer end and its two possible inner ends, worked out once.
const TICKS = {};
for (const [name, { start, sweep, n }] of Object.entries(ARCS)) {
  TICKS[name] = Array.from({ length: n }, (_, i) => {
    const degrees = start + (sweep * i) / (n - 1);
    return {
      inner: point(degrees, INNER),
      notch: point(degrees, NOTCH),
      outer: point(degrees, OUTER),
    };
  });
}

export const litCount = (fraction, n) => Math.max(0, Math.min(n, Math.round(fraction * n)));
export const notchIndex = (fraction, n) =>
  fraction < 0 ? -1 : Math.max(0, Math.min(n - 1, Math.round(fraction * (n - 1))));

function Arc({ name, arc }) {
  const [value, target, tone = 'ink'] = arc;
  const ticks = TICKS[name];
  const lit = litCount(Number.isFinite(value) ? value : 0, ticks.length);
  const notch = notchIndex(Number.isFinite(target) ? target : -1, ticks.length);

  return (
    <g>
      {ticks.map((tick, i) => {
        const from = i === notch ? tick.notch : tick.inner;
        return (
          <line
            key={i}
            className={cx('bmf-tick', i < lit && tone, i === notch && 'notch')}
            x1={from[0]}
            y1={from[1]}
            x2={tick.outer[0]}
            y2={tick.outer[1]}
          />
        );
      })}
    </g>
  );
}

/**
 * The ring of ticks around the Dial: lit ticks are the value, a longer ink tick is the target.
 * Pass `left` and `right` for the split ring (boiler and pump), or `full` for one quantity.
 * Each arc is `[value, target, tone]`:
 *   value, target  fractions of the fixed scale (0 to 160 °C, 0 to 16 bar, or progress);
 *                  a target of -1 or null draws no notch
 *   tone           'heat' temperature, 'primary' pressure, 'ink' progress, 'faint' standby
 */
export function TickRing({ left, right, full, ...rest }) {
  return (
    <svg viewBox='0 0 480 480' aria-hidden='true' {...rest}>
      {left && <Arc name='left' arc={left} />}
      {right && <Arc name='right' arc={right} />}
      {full && <Arc name='full' arc={full} />}
    </svg>
  );
}
