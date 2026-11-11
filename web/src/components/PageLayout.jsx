import { cx } from './cx.js';

/**
 * A page as one column of sections, space-2 apart on a phone and space-3 on desktop.
 *   variant  'wide' fills the content area; 'narrow' holds a form to a readable width
 */
export default function PageLayout({ variant = 'wide', children, className }) {
  return (
    <div
      className={cx(
        'flex w-full flex-col gap-2 lg:gap-3',
        variant === 'narrow' && 'mx-auto max-w-4xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
