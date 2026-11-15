import { Button } from './Button.jsx';
import { cx } from './cx.js';

/**
 * The page's one primary Button, pinned at the bottom of a form on a band of the page ground:
 * `control-lg` tall and full width (`bm-pinned`).
 *   status     what the form is waiting for, in a row above the Button: a notice or a Chip.
 *              The row is a live region and takes no room while it is empty.
 *   className  for the band, such as an offset above the mode bar
 * Everything else reaches the Button: `type='submit'`, `form`, `href`, `disabled`, `aria-label`.
 */
export function PinnedAction({ status, className, children, ...button }) {
  const hasStatus = status !== undefined;
  return (
    <div className={cx('bm-pinned', hasStatus && 'flex-col', className)}>
      {hasStatus && (
        <div role='status' className='flex flex-col items-start empty:hidden'>
          {status}
        </div>
      )}
      <Button variant='primary' size='lg' block {...button}>
        {children}
      </Button>
    </div>
  );
}
