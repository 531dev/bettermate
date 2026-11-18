import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Dialog } from '../../components/Dialog.jsx';
import { Notice } from '../../components/Notice.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { settleCommand } from '../../utils/commands.js';
import { activeWarnings, parseWarningStates, warningTone } from '../../utils/warnings.js';

// Asks before a shot whenever the controller asks for it, whichever UI or button started the brew.
// It closes when any UI answers: a cancel event, or the brew actually starting.
export function BrewConfirm() {
  const apiService = useContext(ApiServiceContext);
  const [warnings, setWarnings] = useState(null);
  // The sheet keeps its rows while it leaves.
  const shown = useRef([]);
  if (warnings) shown.current = warnings;
  const processActive = !!machine.value.status.process?.a;

  useEffect(() => {
    const confirmId = apiService.on('evt:brew:confirm', m => {
      // The machine answered the start by asking first.
      settleCommand();
      setWarnings(activeWarnings(parseWarningStates(m.warn)));
    });
    const cancelId = apiService.on('evt:brew:confirm:cancel', () => setWarnings(null));
    return () => {
      apiService.off('evt:brew:confirm', confirmId);
      apiService.off('evt:brew:confirm:cancel', cancelId);
    };
  }, [apiService]);

  useEffect(() => {
    if (processActive) setWarnings(null);
  }, [processActive]);

  const back = () => {
    setWarnings(null);
    apiService.send({ tp: 'req:brew:confirm:cancel' });
  };
  const startAnyway = () => {
    setWarnings(null);
    apiService.send({ tp: 'req:process:activate', ignoreWarnings: true });
  };

  return (
    <Dialog
      open={!!warnings}
      onClose={back}
      title='Start the shot anyway?'
      body='The machine has something to tell you first.'
      actions={[
        <Button key='back' onClick={back} data-autofocus>
          Back
        </Button>,
        <Button key='start' variant='primary' onClick={startAnyway}>
          Start anyway
        </Button>,
      ]}
    >
      <ul className='flex flex-col gap-2'>
        {shown.current.map(w => (
          <li key={w.key}>
            <Notice tone={warningTone(w.level)} title={w.label} />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
