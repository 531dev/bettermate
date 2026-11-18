import { useEffect, useId, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { Button } from './Button.jsx';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { usePresence } from './motion.js';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex="0"]';

/**
 * A question that must be answered before anything else: centred from 600px, a sheet at the bottom
 * of a phone. While it is open the page behind is inert; Escape and a press on the scrim give the
 * safe answer (`onClose`), and focus returns to the control that opened it.
 *   open, onClose
 *   title     the question or task with the object's name, at most 40 characters
 *   body      the consequence, one or two sentences (described by it)
 *   actions   its Buttons in row order, the commit last; a sheet stacks them with the commit first
 *   alert     a destructive question: role="alertdialog"
 *   close     a close button beside the title, for a Dialog that is a task rather than a question
 *   dismissable  false while it must stay (an upload): Escape and the scrim do nothing
 * Mark the control that should take focus with `data-autofocus`; otherwise the first one does.
 * For a deletion that is the safe answer.
 */
export function Dialog({
  open,
  onClose,
  title,
  body,
  actions,
  alert = false,
  close = false,
  dismissable = true,
  className,
  children,
}) {
  const { mounted, shown } = usePresence(open);
  const sheet = useMediaQuery('(max-width: 599px)');
  const box = useRef(null);
  const safe = useRef(null);
  safe.current = dismissable ? onClose : null;
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    if (!mounted) return undefined;
    const opener = document.activeElement;
    const page = document.getElementById('app');
    page?.setAttribute('inert', '');
    const first =
      box.current.querySelector('[data-autofocus]') || box.current.querySelector(FOCUSABLE);
    (first || box.current).focus();
    const onKey = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        safe.current?.();
        return;
      }
      // Tab stays inside.
      if (event.key !== 'Tab' || !box.current) return;
      const all = [...box.current.querySelectorAll(FOCUSABLE)];
      if (!all.length) return;
      const [head, tail] = [all[0], all[all.length - 1]];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      page?.removeAttribute('inert');
      opener?.focus?.();
    };
  }, [mounted]);

  if (!mounted) return null;
  const buttons = actions && [].concat(actions).filter(Boolean);
  return createPortal(
    <>
      <div className={cx('bm-scrim', shown && 'is-open')} onClick={() => safe.current?.()} />
      <div
        ref={box}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal='true'
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={body ? bodyId : undefined}
        tabIndex={-1}
        className={cx(
          'bm-dialog outline-none',
          sheet && 'bm-dialog--sheet',
          shown && 'is-open',
          className,
        )}
      >
        {title && (
          <div className='bm-dialog__head'>
            <h2 className='bm-dialog__title' id={titleId}>
              {title}
            </h2>
            {close && dismissable && (
              <Button iconOnly variant='quiet' aria-label='Close' onClick={onClose}>
                <Icon name='x' size={20} />
              </Button>
            )}
          </div>
        )}
        {body && (
          <p className='bm-dialog__body' id={bodyId}>
            {body}
          </p>
        )}
        {children}
        {buttons?.length > 0 && (
          <div className={cx('bm-dialog__actions', sheet && 'bm-dialog__actions--stack')}>
            {sheet ? [...buttons].reverse() : buttons}
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

/**
 * Confirm what cannot be undone: "Delete First?" with KEEP first and the danger verb last. KEEP,
 * Escape and the scrim all keep. Focus starts on KEEP.
 *   confirmLabel  the verb and its object: 'Delete profile'
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  keepLabel = 'Keep',
}) {
  return (
    <Dialog
      alert
      open={open}
      onClose={onClose}
      title={title}
      body={body}
      actions={[
        <Button key='keep' onClick={onClose} data-autofocus>
          {keepLabel}
        </Button>,
        <Button
          key='confirm'
          variant='danger'
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>,
      ]}
    />
  );
}
