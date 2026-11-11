import { cx } from './cx.js';

/**
 * The head of a page: its one title, an optional line under it, actions at the right, and a row
 * of tabs below.
 *   title, subtitle
 *   actions  buttons for the page: an ink Button for its main action, a Menu for the rest
 *   tabs     a TabBar
 *   noStack  keep title and actions on one row on a phone
 */
export default function PageHeader({ title, subtitle, actions, tabs, className, noStack = false }) {
  return (
    <header className={cx('flex flex-col gap-3 pt-2 lg:pt-5', className)}>
      <div
        className={
          noStack
            ? 'flex items-center justify-between gap-3'
            : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        <div className='min-w-0'>
          <h1 className='bm-title'>{title}</h1>
          {subtitle && <p className='bm-help mt-1'>{subtitle}</p>}
        </div>
        {actions && <div className='flex flex-wrap items-center gap-2 sm:shrink-0'>{actions}</div>}
      </div>
      {tabs}
    </header>
  );
}
