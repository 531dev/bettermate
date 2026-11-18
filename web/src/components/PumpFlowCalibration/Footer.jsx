import { Button } from '../Button.jsx';
import { Loader } from '../Loader.jsx';
import { PHASE } from './constants.js';

// A calibration run is a secondary action of its tile: the page's one primary Button is Save.
export default function Footer({ phase, saving, saved, connected, onClose, onStart, onApply }) {
  return (
    <div className='flex flex-wrap justify-end gap-2'>
      {phase === PHASE.IDLE && (
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={onStart}
            disabled={!connected}
            title={connected ? undefined : 'Not connected to the machine'}
          >
            Start calibration
          </Button>
        </>
      )}
      {(phase === PHASE.RUNNING || phase === PHASE.ANALYZING) && (
        <Button disabled>
          <Loader size={18} />
          {phase === PHASE.RUNNING ? 'Running shot' : 'Analyzing'}
        </Button>
      )}
      {phase === PHASE.DONE && !saved && (
        <>
          <Button onClick={onClose}>Discard</Button>
          <Button onClick={onApply} disabled={saving}>
            {saving && <Loader size={18} />}
            {saving ? 'Saving' : 'Save to machine'}
          </Button>
        </>
      )}
      {phase === PHASE.DONE && saved && <Button onClick={onClose}>Done</Button>}
      {phase === PHASE.ERROR && (
        <>
          <Button onClick={onClose}>Back</Button>
          <Button onClick={onStart}>Retry</Button>
        </>
      )}
    </div>
  );
}
