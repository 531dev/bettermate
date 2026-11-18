import { useEffect, useState } from 'preact/hooks';
import {
  connection,
  dismissUpdateResult,
  fault,
  lastSeen,
  ota,
  retryConnection,
} from '../utils/machineState.js';
import { clock } from '../utils/time.js';
import { Button } from './Button.jsx';
import { Notice } from './Notice.jsx';

// Connecting is shown only once it has taken this long, so a page that connects at once does not
// flash a Notice.
const CONNECTING_AFTER_MS = 1000;

function useLate(active, ms) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) {
      setLate(false);
      return undefined;
    }
    const timer = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(timer);
  }, [active, ms]);
  return active && late;
}

/**
 * The one Notice about the machine as a whole, first on every page: a fault that blocks brewing,
 * offline, connecting, or how the last update went. Only the most severe shows (Product states,
 * When several are true); the rest wait in their Chips.
 */
export function MachineNotice({ className }) {
  const link = connection.value;
  const problem = fault.value;
  const update = ota.value;
  const connecting = useLate(link === 'connecting', CONNECTING_AFTER_MS);

  if (problem) {
    return (
      <Notice
        live
        page
        className={className}
        tone='danger'
        title={problem.title}
        actions={
          problem.link && (
            <Button variant='outline' href={problem.link.href}>
              {problem.link.label}
            </Button>
          )
        }
      >
        {problem.text}
      </Notice>
    );
  }
  if (link === 'offline') {
    const seen = lastSeen.value;
    return (
      <Notice
        live
        page
        tone='danger'
        className={className}
        title='The machine is offline'
        actions={
          <Button variant='outline' onClick={retryConnection}>
            Try again
          </Button>
        }
      >
        {seen ? `Last seen ${clock(seen)}. ` : ''}Check that it is switched on and on Wi-Fi.
      </Notice>
    );
  }
  if (connecting) {
    return (
      <Notice live page loading className={className} title='Connecting to the machine'>
        This takes a few seconds after it wakes.
      </Notice>
    );
  }
  if (update.failed) {
    return (
      <Notice
        live
        page
        className={className}
        tone='danger'
        title='The update failed'
        onDismiss={dismissUpdateResult}
      >
        The previous version is still running. Check the connection and install it again.
      </Notice>
    );
  }
  if (update.updatedTo && !update.restarting && link === 'online') {
    return (
      <Notice
        live
        page
        className={className}
        tone='success'
        title={`Updated to ${update.updatedTo}`}
        onDismiss={dismissUpdateResult}
      >
        The machine restarted and is running it.
      </Notice>
    );
  }
  return null;
}
