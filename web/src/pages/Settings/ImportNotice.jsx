import { Button } from '../../components/Button.jsx';
import { Notice } from '../../components/Notice.jsx';

/**
 * What an imported settings file did to the form. The values only reach the machine on Save, so
 * until then they can be discarded.
 *   notice  { error, name, message } or { name, count, ignored }
 */
export function ImportNotice({ notice, onDismiss, onDiscard }) {
  if (notice.error) {
    return (
      <Notice
        live
        page
        tone='danger'
        title={`Could not import ${notice.name}`}
        onDismiss={onDismiss}
      >
        {notice.message}
      </Notice>
    );
  }
  return (
    <Notice
      live
      page
      tone='info'
      title={`Loaded ${notice.count} ${notice.count === 1 ? 'setting' : 'settings'}`}
      actions={
        <Button variant='outline' onClick={onDiscard}>
          Discard
        </Button>
      }
    >
      From {notice.name}. All other settings are kept. Save to apply.
      {notice.ignored.length > 0 && ` Ignored unknown entries: ${notice.ignored.join(', ')}.`}
    </Notice>
  );
}
