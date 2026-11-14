import { forwardRef } from 'preact/compat';
import { cx } from '../../../components/cx.js';
import { Icon } from '../../../components/Icon.jsx';
import './tool.css';

/**
 * A round ghost button holding one glyph, for dense toolbars and rows where the 44px pill of
 * Button would crowd the data. It takes the next tone on hover and turns ink while pressed.
 *   icon      the glyph's name
 *   label     its name for screen readers, also shown as the native hint
 *   size      'sm' for 28px inside a row; default 36px. A finger always gets 44px.
 *   pressed   true or false for a toggle (ink while on); leave it out for an action
 *   href      renders a link
 * Children replace the glyph, for a Spinner or a ShotBadge.
 */
export const IconButton = forwardRef(function IconButton(
  { icon, label, size, pressed, href, iconSize = 18, className, children, ...rest },
  ref,
) {
  const shared = {
    ...rest,
    ref,
    className: cx('an-iconbtn', size === 'sm' && 'an-iconbtn--sm', className),
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
