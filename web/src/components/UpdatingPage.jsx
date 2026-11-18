import { ota, updateVersion } from '../utils/machineState.js';
import { SegmentBar } from './SegmentBar.jsx';
import { Tile } from './Tile.jsx';
import { Wordmark } from './Wordmark.jsx';

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
