import { useEffect, useId, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { Button } from './Button.jsx';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { usePresence } from './motion.js';

/**
 * A dialog over a scrim: at the bottom of a phone, centred from 600px. It enters with a 16px rise
 * and leaves faster, per the motion rules. While it is open the page behind it is inert, Escape and
 * the scrim close it, and focus returns to where it was.
 *   open, onClose
 *   title        the sheet's heading; a close button sits beside it
 *   dismissable  false while the sheet must stay, such as during an upload
 * Mark the control that should take focus with `data-autofocus`.
 */
export function Sheet({ open, onClose, title, dismissable = true, className, children }) {
  const { mounted, shown } = usePresence(open);
  const sheet = useRef(null);
  const close = useRef(null);
  close.current = dismissable ? onClose : null;
  const titleId = useId();

  useEffect(() => {
    if (!mounted) return undefined;
    const opener = document.activeElement;
    const page = document.getElementById('app');
    page?.setAttribute('inert', '');
    (sheet.current.querySelector('[data-autofocus]') || sheet.current).focus();
    const onKey = event => {
      if (event.key === 'Escape') close.current?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      page?.removeAttribute('inert');
      opener?.focus?.();
    };
  }, [mounted]);

  if (!mounted) return null;
  return createPortal(
    <>
      <div className={cx('bm-scrim', shown && 'is-open')} onClick={() => close.current?.()} />
      <div
        ref={sheet}
        role='dialog'
        aria-modal='true'
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cx('bm-sheet outline-none', shown && 'is-open', className)}
      >
        {title && (
          <div className='bm-tile__head'>
            <h2 className='bm-sub' id={titleId}>
              {title}
            </h2>
            {dismissable && (
              <Button iconOnly size='sm' aria-label='Close' onClick={onClose}>
                <Icon name='x' size={18} />
              </Button>
            )}
          </div>
        )}
        {children}
      </div>
    </>,
    document.body,
  );
}
