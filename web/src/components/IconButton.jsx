import { forwardRef } from 'preact/compat';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

/**
 * A round ghost button holding one glyph, for dense toolbars and rows where the 44px pill of
 * Button would crowd the data. Hover and pressed take state-hover; a toggle that is on is ink.
 *   icon      the glyph's name
 *   label     its name for screen readers, also shown as the native hint
 *   size      'sm' for 28px inside a row (a 36px hit area); default 36px. A finger always gets
 *             44px.
 *   pressed   true or false for a toggle (ink while on); leave it out for an action
 *   href      renders a link
 * Children replace the glyph, for a Loader or a badge. A ref reaches the button or the link.
 */
export const IconButton = forwardRef(function IconButton(
  { icon, label, size, pressed, href, iconSize = 18, className, children, ...rest },
  ref,
) {
  const shared = {
    ...rest,
    ref,
    className: cx('bm-iconbtn', size === 'sm' && 'bm-iconbtn--sm', className),
    'aria-label': label,
    title: rest.title ?? label,
  };
  const content = children ?? <Icon name={icon} size={iconSize} />;

  return href ? (
    <a {...shared} href={href}>
      {content}
    </a>
  ) : (
    <button {...shared} type='button' aria-pressed={pressed}>
      {content}
    </button>
  );
});
