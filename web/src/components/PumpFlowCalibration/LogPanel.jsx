import { Cell } from '../Tile.jsx';

// The calibration's running log, in mono. Each tone has its word mark as well as its color.
const LOG_TONE_COLOR = {
  err: 'var(--danger)',
  ok: 'var(--success)',
  warn: 'var(--warning)',
};

const LOG_TONE_PREFIX = { err: '✗', ok: '✓', warn: '!' };

export default function LogPanel({ logs }) {
  return (
    <Cell className='bm-data max-h-48 gap-0 overflow-auto'>
      {logs.map(l => (
        <div key={l.key} style={{ color: LOG_TONE_COLOR[l.tone] }}>
          {LOG_TONE_PREFIX[l.tone] || '›'} {l.msg}
        </div>
      ))}
    </Cell>
  );
}
