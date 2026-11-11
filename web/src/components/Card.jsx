import { cx } from './cx.js';
import { Tile } from './Tile.jsx';

const BREAKPOINTS = ['', 'sm:', 'md:', 'lg:', 'xl:'];

/**
 * The earlier Card API on the Tile recipe: a tile with an optional title that spans grid columns
 * per breakpoint (`xs`, `sm`, `md`, `lg`, `xl`, each 1 to 12). New code uses Tile.
 */
export default function Card({
  xs,
  sm,
  md,
  lg,
  xl,
  title,
  children,
  className,
  role,
  fullHeight = false,
}) {
  const spans = [xs, sm, md, lg, xl].map(
    (span, i) => span >= 1 && span <= 12 && `${BREAKPOINTS[i]}col-span-${span}`,
  );

  return (
    <Tile
      title={title}
      role={role}
      className={cx('min-h-0', ...spans, fullHeight && 'h-full', className)}
    >
      {fullHeight ? <div className='flex min-h-0 flex-1 flex-col gap-3'>{children}</div> : children}
    </Tile>
  );
}
