import { Button } from '../../components/Button.jsx';
import { Chip } from '../../components/Chip.jsx';
import { PinnedAction } from '../../components/PinnedAction.jsx';
import { Spinner } from '../../components/Spinner.jsx';
import { Tile } from '../../components/Tile.jsx';

/**
 * What the form is waiting for, in one line above Save. A problem is a notice; unsaved and saved
 * are a word in a Chip. Nothing shows while the form matches the machine.
 *   invalid  how many fields the last save rejected
 *   state    'failed', 'saved' or 'restarting' after a save; 'unanswered' after a save with a
 *            restart that got no answer; 'unloaded' when settings never arrived
 *   dirty    the form differs from what the machine holds
 */
function SaveStatus({ invalid, state, dirty }) {
  if (state === 'unloaded') {
    return (
      <p role='alert' className='bm-notice bm-notice--danger self-stretch'>
        The settings did not load. Reload the page before you save.
      </p>
    );
  }
  if (invalid > 0) {
    return (
      <p role='alert' className='bm-notice bm-notice--danger self-stretch'>
        {invalid === 1 ? 'One field needs another value.' : `${invalid} fields need another value.`}
      </p>
    );
  }
  if (state === 'failed') {
    return (
      <p role='alert' className='bm-notice bm-notice--danger self-stretch'>
        The settings were not saved. Check the connection to the machine and save again.
      </p>
    );
  }
  if (state === 'unanswered') {
    return (
      <p role='alert' className='bm-notice bm-notice--warning self-stretch'>
        The machine did not answer. It restarts as soon as it has saved, so check the settings once
        it is back.
      </p>
    );
  }
  if (dirty) return <Chip tone='warning'>Unsaved changes</Chip>;
  if (state === 'restarting') return <Chip tone='success'>Saved, restarting</Chip>;
  if (state === 'saved') return <Chip tone='success'>Saved</Chip>;
  return null;
}

/**
 * The page's one primary Button, pinned at the bottom: it submits the settings form from wherever
 * it sits.
 */
export function PinnedSave({ form, submitting, disabled, invalid, state, dirty }) {
  return (
    <PinnedAction
      type='submit'
      form={form}
      disabled={submitting || disabled}
      status={<SaveStatus invalid={invalid} state={state} dirty={dirty} />}
    >
      {submitting && <Spinner size={4} />}
      Save
    </PinnedAction>
  );
}

/** Saving with a restart, for the settings that only apply after one. */
export function RestartTile({ submitting, disabled, onRestart }) {
  return (
    <Tile title='Restart'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <p className='bm-help'>Wi-Fi, time zone and plugin changes need a restart.</p>
        <Button className='shrink-0' disabled={submitting || disabled} onClick={onRestart}>
          Save & restart
        </Button>
      </div>
    </Tile>
  );
}
