import { useId } from 'preact/hooks';
import { cx } from './cx.js';

/**
 * A tile: surface-1, radius-xl, padded space-5. It holds at most one title or eyebrow, one reading
 * or list, and one control group. A tile never holds a tile; nest with Cell.
 *   title    the tile's title (subheading)
 *   eyebrow  a mono label in place of a title
 *   end      what sits at the right of the head: one status Chip or one link
 *   tone     'heat' only while its boiler is heating, 'primary' only for the selected profile
 * A titled tile is a region named by its title, unless it is given a name of its own.
 */
export function Tile({
  as: Tag = 'section',
  title,
  eyebrow,
  end,
  tone,
  className,
  children,
  ...rest
}) {
  const titleId = useId();
  const named = rest['aria-label'] || rest['aria-labelledby'];
  return (
    <Tag
      aria-labelledby={title && !named ? titleId : undefined}
      {...rest}
      className={cx('bm-tile', tone && `bm-tile--${tone}`, className)}
    >
      {(title || eyebrow || end) && (
        <TileHead title={title} titleId={titleId} eyebrow={eyebrow} end={end} />
      )}
      {children}
    </Tag>
  );
}

/** The head row of a tile, for when a Tile's own `title`, `eyebrow` and `end` are not enough. */
export function TileHead({ title, titleId, eyebrow, end, children }) {
  return (
    <div className='bm-tile__head'>
      {title ? (
        <h2 className='bm-sub' id={titleId}>
          {title}
        </h2>
      ) : (
        <span className='bm-eyebrow'>{eyebrow}</span>
      )}
      {children}
      {end}
    </div>
  );
}

/** A cell: surface-2, radius-lg. Several small readings or controls inside one tile sit in cells. */
export function Cell({ as: Tag = 'div', className, children, ...rest }) {
  return (
    <Tag {...rest} className={cx('bm-cell', className)}>
      {children}
    </Tag>
  );
}
