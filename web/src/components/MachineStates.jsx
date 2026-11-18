import { useEffect, useState } from 'preact/hooks';
import {
  connection,
  dismissUpdateResult,
  fault,
  lastSeen,
  ota,
  retryConnection,
  updateVersion,
} from '../utils/machineState.js';
import { clock } from '../utils/time.js';
import { Button } from './Button.jsx';
import { Notice } from './Notice.jsx';
import { SegmentBar } from './SegmentBar.jsx';
import { Tile } from './Tile.jsx';
import { Wordmark } from './Wordmark.jsx';

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

const PHASE_WORDS = {
  1: 'Installing the display firmware',
  2: 'Installing the display files',
  3: 'Installing the controller firmware',
};

/**
 * Firmware is being installed: one tile takes the window, with the version, a segment bar and
 * its percentage, and "Keep the machine on." No navigation, no mode bar, no way to cancel.
 */
export function UpdatingPage() {
  const { phase, progress, restarting } = ota.value;
  const version = updateVersion.value;
  const share = restarting ? 1 : Math.max(0, Math.min(100, progress || 0)) / 100;
  const words = restarting ? 'Restarting' : (PHASE_WORDS[phase] ?? 'Installing');
  return (
    <main id='main' className='flex min-h-dvh flex-col items-center justify-center gap-6 p-4'>
      <Wordmark />
      <Tile className='w-full max-w-sm' aria-labelledby='updating-title'>
        <span className='bm-eyebrow'>{version ? `Version ${version}` : 'Update'}</span>
        <h1 className='bm-heading' id='updating-title'>
          Updating
        </h1>
        <div className='bm-stat__row' aria-hidden='true'>
          <span className='bm-stat__value'>{Math.round(share * 100)}</span>
          <span className='bm-stat__unit'>%</span>
        </div>
        <SegmentBar value={share} label={`${words}, ${Math.round(share * 100)} percent`} as='div' />
        <p className='bm-help'>{words}. Keep the machine on.</p>
      </Tile>
    </main>
  );
}
