import { Button } from '../../components/Button.jsx';
import { Chip } from '../../components/Chip.jsx';
import { PinnedAction } from '../../components/PinnedAction.jsx';
import { Loader } from '../../components/Loader.jsx';
import { Tile } from '../../components/Tile.jsx';
import { Notice } from '../../components/Notice.jsx';

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
      <Notice live tone='danger' title='The settings did not load' className='self-stretch'>
        Reload the page before you save.
      </Notice>
    );
  }
  if (invalid > 0) {
    return (
      <Notice
        live
        tone='danger'
        title={
          invalid === 1 ? 'One field needs another value' : `${invalid} fields need another value`
        }
        className='self-stretch'
      >
        Each one says what it takes.
      </Notice>
    );
  }
  if (state === 'failed') {
    return (
      <Notice live tone='danger' title='Could not save' className='self-stretch'>
        Check the connection to the machine and save again.
      </Notice>
    );
  }
  if (state === 'unanswered') {
    return (
      <Notice live tone='warning' title='The machine did not answer' className='self-stretch'>
        It restarts as soon as it has saved, so check the settings once it is back.
      </Notice>
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
      {submitting && <Loader size={18} />}
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
