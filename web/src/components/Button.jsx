import { cx } from './cx.js';

/**
 * A pill button for everything that is not the page's main action. Labels are one or two words,
 * a verb first; the recipe sets them in uppercase mono.
 *   variant   'primary' the one commit on a form (never beside an ActionBanner),
 *             'ink' the main action of a list or tool, 'outline' where the ground is surface-2,
 *             'ghost' a link-like action, 'danger' delete and reset only;
 *             none is a secondary action inside a tile
 *   size      'sm' 36px for dense desktop rows, 'lg' 56px for a pinned action; default 44px
 *   iconOnly  a round button holding one Icon; give it an aria-label
 *   block     full width
 *   href      renders a link
 */
export function Button({
  variant,
  size,
  iconOnly = false,
  block = false,
  href,
  type = 'button',
  className,
  children,
  ...rest
}) {
  const classes = cx(
    'bm-btn',
    variant && `bm-btn--${variant}`,
    size && `bm-btn--${size}`,
    iconOnly && 'bm-btn--icon',
    block && 'bm-btn--block',
    className,
  );

  return href ? (
    <a {...rest} href={href} className={classes}>
      {children}
    </a>
  ) : (
    <button {...rest} type={type} className={classes}>
      {children}
    </button>
  );
}
