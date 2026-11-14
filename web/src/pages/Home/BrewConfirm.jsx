import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { cx } from '../../components/cx.js';
import { Sheet } from '../../components/Sheet.jsx';
import { WarningIcon } from '../../components/WarningIcon.jsx';
import { ApiServiceContext, machine } from '../../services/ApiService.js';
import { activeWarnings, parseWarningStates, warningTone } from '../../utils/warnings.js';

const NOTICE = { warning: 'bm-notice--warning', danger: 'bm-notice--danger' };

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
    const confirmId = apiService.on('evt:brew:confirm', m =>
      setWarnings(activeWarnings(parseWarningStates(m.warn))),
    );
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
    <Sheet open={!!warnings} onClose={back} title='Start the shot anyway?'>
      <p className='bm-help'>The machine has something to tell you first.</p>
      <ul className='flex flex-col gap-2'>
        {shown.current.map(w => (
          <li key={w.key} className={cx('bm-notice', NOTICE[warningTone(w.level)])}>
            <WarningIcon icon={w.icon} size={18} />
            <span>{w.label}</span>
          </li>
        ))}
      </ul>
      <div className='flex justify-end gap-2'>
        <Button onClick={back} data-autofocus>
          Back
        </Button>
        <Button variant='primary' onClick={startAnyway}>
          Start anyway
        </Button>
      </div>
    </Sheet>
  );
}
