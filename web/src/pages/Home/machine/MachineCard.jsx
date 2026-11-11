import PropTypes from 'prop-types';
import { WarningIcon } from '../../../components/WarningIcon.jsx';
import { WARNING_LEVEL } from '../../../utils/warnings.js';
import { MachineDial } from './MachineDial.jsx';

const TONE_DOT = {
  idle: 'var(--ink-muted)',
  ready: 'var(--success)',
  heat: 'var(--heat)',
  active: 'var(--primary-text)',
  warning: 'var(--warning)',
};

export function MachineCard({ ds, view, warnings = [], children }) {
  return (
    <section
      aria-label='Machine status'
      className='bm-group relative items-center gap-0 pb-3 text-center @2xl:pb-5'
    >
      {children}
      <h1 className='max-w-full px-14 text-[19px] leading-[26px] font-normal'>{view.title}</h1>
      <p
        role='status'
        className='flex items-center gap-2 px-14 text-[15px] leading-[22px] text-[var(--ink-muted)]'
      >
        <span
          aria-hidden='true'
          className='h-2 w-2 rounded-full'
          style={{ background: TONE_DOT[view.tone] }}
        />
        {view.status}
      </p>
      {warnings.length > 0 && (
        <ul aria-label='Active warnings' className='mt-1 flex flex-wrap justify-center gap-x-3'>
          {warnings.map(w => (
            <li
              key={w.key}
              className={`flex items-center gap-1 text-sm leading-6 ${
                w.level === WARNING_LEVEL.ERROR ? 'text-[var(--danger)]' : 'text-[var(--warning)]'
              }`}
            >
              <WarningIcon icon={w.icon} />
              {w.label}
            </li>
          ))}
        </ul>
      )}
      <MachineDial
        ds={ds}
        dial={view.dial}
        className='mt-3 @2xl:w-[clamp(240px,36dvh,340px)] [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:w-[172px]'
      />
    </section>
  );
}

MachineCard.propTypes = {
  ds: PropTypes.object.isRequired,
  view: PropTypes.object.isRequired,
  warnings: PropTypes.array,
  children: PropTypes.node,
};
