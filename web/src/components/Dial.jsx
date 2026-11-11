import { useEffect, useRef, useState } from 'preact/hooks';
import { cx } from './cx.js';
import { prefersReducedMotion, tokenMs } from './motion.js';
import { TickRing } from './TickRing.jsx';

// The ticks catch up once, over duration-slow, when the first reading arrives after the page
// loads. From then on a tick recolours in duration-fast (bm.css) and the reading snaps.
function useCatchUp(ready) {
  const [share, setShare] = useState(0);
  const started = useRef(false);
  const frame = useRef(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const duration = prefersReducedMotion() ? 0 : tokenMs('--duration-slow', 320);
    const from = performance.now();
    const step = now => {
      const t = duration ? Math.min(1, (now - from) / duration) : 1;
      setShare(1 - (1 - t) ** 3);
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    step(from);
  }, [ready]);

  return share;
}

/**
 * The machine's round display inside a tile: the tick ring, with one reading in the middle.
 *   left, right | full    the ring's arcs, as for TickRing. Leave a value null until the first
 *                         reading: the ring then waits unlit.
 *   eyebrow, value, plan  the centre: a mono label, the one reading, and one line of small text.
 *                         A missing value shows as a dash.
 *   children              replace the centre when a state needs other markup
 * It is 264px wide and shrinks with its tile; the centre text does not scale. On desktop widen it
 * with `lg:w-[min(100%,300px)]`.
 */
export function Dial({ left, right, full, eyebrow, value, plan, className, children, ...rest }) {
  const share = useCatchUp([left, right, full].some(arc => arc && Number.isFinite(arc[0])));
  const lit = arc => arc && [arc[0] * share, arc[1], arc[2]];

  return (
    <div {...rest} className={cx('bm-dial', className)}>
      <TickRing left={lit(left)} right={lit(right)} full={lit(full)} />
      <div className='bm-dial__center'>
        {children ?? (
          <>
            {eyebrow && <span className='bm-eyebrow'>{eyebrow}</span>}
            <span className='bm-dial__value'>{value ?? '—'}</span>
            {plan && <span className='bm-dial__plan'>{plan}</span>}
          </>
        )}
      </div>
    </div>
  );
}
