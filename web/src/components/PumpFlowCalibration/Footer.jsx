import { Spinner } from '../Spinner.jsx';
import { PrimaryButton, SecondaryButton } from './Buttons.jsx';
import { PHASE } from './constants.js';

export default function Footer({ phase, saving, saved, connected, onClose, onStart, onApply }) {
  return (
    <div className='flex flex-wrap justify-end gap-2'>
      {phase === PHASE.IDLE && (
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton
            onClick={onStart}
            disabled={!connected}
            title={connected ? undefined : 'Not connected to the machine'}
          >
            Start calibration
          </PrimaryButton>
        </>
      )}
      {(phase === PHASE.RUNNING || phase === PHASE.ANALYZING) && (
        <PrimaryButton disabled>
          <Spinner size={4} />
          {phase === PHASE.RUNNING ? 'Running shot' : 'Analyzing'}
        </PrimaryButton>
      )}
      {phase === PHASE.DONE && !saved && (
        <>
          <SecondaryButton onClick={onClose}>Discard</SecondaryButton>
          <PrimaryButton onClick={onApply} disabled={saving}>
            {saving && <Spinner size={4} />}
            {saving ? 'Saving' : 'Save to machine'}
          </PrimaryButton>
        </>
      )}
      {phase === PHASE.DONE && saved && <PrimaryButton onClick={onClose}>Done</PrimaryButton>}
      {phase === PHASE.ERROR && (
        <>
          <SecondaryButton onClick={onClose}>Back</SecondaryButton>
          <PrimaryButton onClick={onStart}>Retry</PrimaryButton>
        </>
      )}
    </div>
  );
}
