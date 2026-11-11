import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

/** The rows of a list inside a tile, divided by hairlines. */
export function List({ className, children, ...rest }) {
  return (
    <div {...rest} className={cx('bm-list', className)}>
      {children}
    </div>
  );
}

/**
 * One line of a list: an icon disc, a title, a line of mono facts and one thing at the end.
 *   href | onClick  the whole row is the target, as a link or a button
 *   icon            the glyph in the disc
 *   current         the item in use: its disc turns ink
 *   title, meta     meta is facts joined by middle dots: '30.2 s · 36.1 g · 10.0 bar'
 *   end             a time, a Chip or a chevron
 *   action          a control of its own at the end, such as a Menu: the row's target then stops
 *                   before it, because a link cannot hold a button
 */
export function ListRow({
  href,
  onClick,
  icon,
  current = false,
  title,
  meta,
  end,
  action,
  className,
  ...rest
}) {
  const Target = href ? 'a' : onClick ? 'button' : 'div';
  const target = { href, onClick, type: Target === 'button' ? 'button' : undefined };
  const content = (
    <>
      {icon && (
        <span className='bm-item__icon'>
          <Icon name={icon} size={20} />
        </span>
      )}
      <span className='bm-item__body'>
        <span className='bm-item__title block'>{title}</span>
        {meta && <span className='bm-item__meta block'>{meta}</span>}
      </span>
      {end != null && <span className='bm-item__end'>{end}</span>}
    </>
  );
  const state = {
    className: cx('bm-item', className),
    'aria-current': current ? 'true' : undefined,
  };

  if (action) {
    return (
      <div {...rest} {...state}>
        <Target {...target} className='bm-item__main'>
          {content}
        </Target>
        {action}
      </div>
    );
  }
  return (
    <Target {...rest} {...target} {...state}>
      {content}
    </Target>
  );
}
