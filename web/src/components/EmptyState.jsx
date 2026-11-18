import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

/**
 * What a tile shows when it has nothing to list yet. It sits inside the tile that would hold the
 * content, which keeps its title, size and place. Not for loading: a reading on its way is `—`.
 *   icon     the glyph that names the missing thing: 'coffee' shots, 'list' profiles, 'scale'
 *   title    the plain fact, at most 28 characters: 'No shots yet', 'No profiles match “decaf”'
 *   children one sentence, at most 80 characters, about what happens next
 *   action   at most one default or ink Button, only when it can make something appear
 *   level    the title's heading level, one below the tile's (default 3)
 */
export function EmptyState({ icon = 'list', title, action, level = 3, className, children }) {
  const Heading = `h${level}`;
  return (
    <div className={cx('bm-empty', className)}>
      <span className='bm-empty__icon' aria-hidden='true'>
        <Icon name={icon} size={24} />
      </span>
      <Heading className='bm-empty__title'>{title}</Heading>
      {children && <p className='bm-empty__text'>{children}</p>}
      {action}
    </div>
  );
}
