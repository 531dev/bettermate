import { Button } from '../../components/Button.jsx';
import { cx } from '../../components/cx.js';
import { Tile } from '../../components/Tile.jsx';

/**
 * What an imported settings file did to the form. The values only reach the machine on Save, so
 * until then they can be discarded.
 *   notice  { error, name, message } or { name, count, ignored }
 */
export function ImportNotice({ notice, onDismiss, onDiscard }) {
  return (
    <Tile title={notice.error ? 'Import failed' : 'Settings imported'}>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        <div
          role='alert'
          className={cx('bm-notice flex-1 flex-col gap-1', notice.error && 'bm-notice--danger')}
        >
          {notice.error ? (
            <span>
              Could not import {notice.name}: {notice.message}
            </span>
          ) : (
            <>
              <span>
                Loaded {notice.count} {notice.count === 1 ? 'setting' : 'settings'} from{' '}
                {notice.name}. All other settings are kept. Save to apply.
              </span>
              {notice.ignored.length > 0 && (
                <span className='bm-help'>
                  Ignored unknown entries: {notice.ignored.join(', ')}
                </span>
              )}
            </>
          )}
        </div>
        <Button className='shrink-0' onClick={notice.error ? onDismiss : onDiscard}>
          {notice.error ? 'Dismiss' : 'Discard'}
        </Button>
      </div>
    </Tile>
  );
}
