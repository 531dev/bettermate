import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom';
import { cx } from './cx.js';
import { usePresence } from './motion.js';

/**
 * A panel anchored to a control, for content that is not a list of actions: a filter, a column
 * picker, a date range. It wears the menu's recipe, so it enters and leaves the way a menu does,
 * renders in a portal, stays on screen, and closes on Escape or a press outside.
 *   open, onClose
 *   anchor       a ref to the control that opened it; focus returns there on Escape
 *   placement    'bottom-start' (default), 'bottom-end', 'top-start' ...
 *   label        names the panel for screen readers
 *   role         'dialog' (default) or 'listbox', 'menu' ...
 *   matchWidth   at least as wide as the anchor
 *   width        a CSS width for the panel
 * A press inside any element marked `data-popover-keep` (another portal, such as a nested menu)
 * does not close it.
 */
export function Popover({
  open,
  onClose,
  anchor,
  placement = 'bottom-start',
  label,
  role = 'dialog',
  matchWidth = false,
  width,
  className,
  children,
  ...rest
}) {
  const { mounted, shown } = usePresence(open);
  const [position, setPosition] = useState(null);
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!mounted) return undefined;
    const anchorElement = anchor?.current;
    if (!anchorElement || !panel.current) return undefined;

    const stopUpdating = autoUpdate(anchorElement, panel.current, () => {
      // The observers can fire once more as the panel is removed.
      if (!anchor.current || !panel.current) return;
      computePosition(anchor.current, panel.current, {
        placement,
        strategy: 'fixed',
        middleware: [
          offset(6),
          flip({ padding: 12 }),
          shift({ padding: 12 }),
          size({
            padding: 12,
            apply({ availableHeight, rects, elements }) {
              elements.floating.style.maxHeight = `${Math.max(160, availableHeight)}px`;
              if (matchWidth) elements.floating.style.minWidth = `${rects.reference.width}px`;
            },
          }),
        ],
      }).then(({ x, y }) => setPosition({ left: `${x}px`, top: `${y}px` }));
    });
    const onPress = event => {
      const target = event.target;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-popover-keep], .bm-menu')) return;
      close.current?.();
    };
    const onKey = event => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      close.current?.();
      anchor.current?.focus?.();
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey);
    return () => {
      stopUpdating();
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey);
      setPosition(null);
    };
  }, [anchor, matchWidth, mounted, placement]);

  if (!mounted) return null;
  return createPortal(
    <div
      {...rest}
      ref={panel}
      role={role}
      aria-label={label}
      tabIndex={-1}
      className={cx('bm-menu bm-popover', shown && 'is-open', className)}
      style={{ ...(position || { visibility: 'hidden' }), width }}
    >
      {children}
    </div>,
    document.body,
  );
}
