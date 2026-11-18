import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { usePresence } from './motion.js';

const ITEM = '[role^="menuitem"]:not([disabled]):not([aria-disabled="true"])';
const items = menu => [...menu.querySelectorAll(ITEM)];

/**
 * A button that opens a short menu of actions, such as the one at the end of a list row.
 * The menu renders in a portal, stays on screen, and closes on a choice, Escape or a press
 * outside. Opening moves focus to the first item; Up and Down move, Home and End jump, a letter
 * jumps to the next item that starts with it, Tab closes and moves on. Two to six actions,
 * the destructive one last under a MenuSeparator; a destructive item opens a Dialog.
 *   label      the button's name for screen readers
 *   icon       the button's glyph (default 'more-horizontal')
 *   placement  where the menu opens: 'bottom-end' (default), 'bottom-start', 'top-end' ...
 *   size, variant, className  the button's, as for Button
 * Its children are MenuItems.
 */
export function Menu({
  label = 'More',
  icon = 'more-horizontal',
  placement = 'bottom-end',
  size,
  variant,
  className,
  children,
}) {
  const [open, setOpen] = useState(false);
  const { mounted, shown } = usePresence(open);
  const [position, setPosition] = useState(null);
  const button = useRef(null);
  const menu = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!mounted) return undefined;
    const stopUpdating = autoUpdate(button.current, menu.current, () => {
      // The observers can fire once more as the menu is removed.
      if (!button.current || !menu.current) return;
      computePosition(button.current, menu.current, {
        placement,
        strategy: 'fixed',
        middleware: [offset(6), flip(), shift({ padding: 12 })],
      }).then(({ x, y }) => setPosition({ left: `${x}px`, top: `${y}px` }));
    });
    const onPress = event => {
      if (!menu.current?.contains(event.target) && !button.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPress);
    return () => {
      stopUpdating();
      document.removeEventListener('pointerdown', onPress);
      setPosition(null);
    };
  }, [mounted, placement]);

  // Opening by keyboard or pointer moves focus into the menu, so the arrow keys work at once.
  useEffect(() => {
    if (shown) items(menu.current)[0]?.focus();
  }, [shown]);

  const closeAndReturn = () => {
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = event => {
    const all = items(menu.current);
    const at = all.indexOf(document.activeElement);
    let move = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 }[event.key];
    if (move === undefined && event.key.length === 1 && /\S/.test(event.key)) {
      const letter = event.key.toLowerCase();
      const order = [...all.slice(at + 1), ...all.slice(0, at + 1)];
      const next = order.find(item => item.textContent.trim().toLowerCase().startsWith(letter));
      if (next) move = all.indexOf(next);
    }
    if (move !== undefined) {
      event.preventDefault();
      all[(move + all.length) % all.length]?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndReturn();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={button}
        type='button'
        className={cx(
          'bm-btn bm-btn--icon',
          size && `bm-btn--${size}`,
          variant && `bm-btn--${variant}`,
          className,
        )}
        aria-label={label}
        aria-haspopup='menu'
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(value => !value)}
      >
        <Icon name={icon} size={size === 'sm' ? 22 : 24} />
      </button>
      {mounted &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role='menu'
            aria-label={label}
            className={cx('bm-menu', shown && 'is-open')}
            style={position || { visibility: 'hidden' }}
            onKeyDown={onKeyDown}
            // A choice closes the menu; an item that must keep it open stops the click itself.
            onClick={event => event.target.closest(ITEM) && closeAndReturn()}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * One action of a Menu: an optional glyph and a verb, sentence case, at most 24 characters.
 *   icon     the glyph before the words
 *   danger   delete and reset only; it opens a Dialog, never acts at once
 *   checked  a choice that is on: `menuitemradio` with a check at the right
 *   hint     a short value at the right, in `data`
 *   href     renders a link
 */
export function MenuItem({
  icon,
  danger = false,
  checked,
  hint,
  href,
  className,
  children,
  ...rest
}) {
  const Tag = href ? 'a' : 'button';
  const choice = checked !== undefined;
  return (
    <Tag
      {...rest}
      href={href}
      type={href ? undefined : 'button'}
      role={choice ? 'menuitemradio' : 'menuitem'}
      aria-checked={choice ? String(!!checked) : undefined}
      className={cx('bm-menu__item', danger && 'bm-menu__item--danger', className)}
    >
      {icon && <Icon name={icon} size={20} />}
      <span className='bm-menu__label'>{children}</span>
      {hint && <span className='bm-menu__hint'>{hint}</span>}
      {checked && <Icon name='check' size={20} />}
    </Tag>
  );
}

/** The hairline that sets the destructive item apart, last in the Menu. */
export function MenuSeparator() {
  return <div role='separator' className='bm-menu__sep' />;
}
