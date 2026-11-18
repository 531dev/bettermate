import { cx } from './cx.js';
import { Icon } from './Icon.jsx';
import { Loader } from './Loader.jsx';

const GLYPH = { info: 'info', success: 'check', warning: 'triangle-alert', danger: 'circle-alert' };

/**
 * A message that stays until its cause is gone: the machine is offline, a fault blocks brewing,
 * an update is ready. One per cause, the most severe first.
 *   tone     none (work in progress), 'info', 'success', 'warning' or 'danger'. Only the glyph
 *            takes the tone's colour; the words stay ink and ink-muted.
 *   title    what is true, at most 40 characters, no full stop
 *   children the text: what it means, then what to do
 *   actions  one or two outline Buttons, the likely fix first
 *   page     across a page, above the first tile (tile-sized); otherwise a cell-sized block
 *   loading  a Loader in place of the glyph, for the neutral tone ("Connecting to the machine")
 *   live     it appeared while the page was open: a danger Notice interrupts (`role="alert"`),
 *            any other is `role="status"`. One there from the start is plain content.
 *   onDismiss  a warning only: a quiet close button; the warning stays in the top bar's list
 */
export function Notice({
  tone,
  title,
  actions,
  page = false,
  loading = false,
  live = false,
  onDismiss,
  className,
  children,
  ...rest
}) {
  const glyph = GLYPH[tone] || 'info';
  return (
    <div
      role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}
      {...rest}
      className={cx(
        'bm-notice',
        page && 'bm-notice--page',
        tone && `bm-notice--${tone}`,
        className,
      )}
    >
      <span className='bm-notice__icon' aria-hidden='true'>
        {loading ? <Loader size={20} /> : <Icon name={glyph} size={20} />}
      </span>
      <div className='bm-notice__body'>
        {title && <span className='bm-notice__title'>{title}</span>}
        {children && <div className='bm-notice__text'>{children}</div>}
        {actions && <div className='bm-notice__actions'>{actions}</div>}
      </div>
      {onDismiss && (
        <button
          type='button'
          aria-label='Dismiss'
          className='bm-btn bm-btn--icon bm-btn--quiet bm-notice__close'
          onClick={onDismiss}
        >
          <Icon name='x' size={20} />
        </button>
      )}
    </div>
  );
}
