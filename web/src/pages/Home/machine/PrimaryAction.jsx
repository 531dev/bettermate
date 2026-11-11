import PropTypes from 'prop-types';
import { Icon } from '../../../components/Icon.jsx';

export function PrimaryAction({ action }) {
  if (!action) return null;

  if (action.kind === 'status') {
    return (
      <div className='bm-cta bm-cta--status'>
        <span className='min-w-0'>
          <span className='bm-cta__title'>{action.title}</span>
          {action.sub && <span className='bm-cta__sub'>{action.sub}</span>}
        </span>
      </div>
    );
  }

  return (
    <button
      type='button'
      className={`bm-cta ${action.running ? 'bm-cta--running' : ''}`}
      onClick={action.onClick}
      aria-label={action.title}
    >
      <span className='min-w-0'>
        <span className='bm-cta__title'>{action.title}</span>
        {action.sub && <span className='bm-cta__sub'>{action.sub}</span>}
      </span>
      <span className='bm-disc'>
        <Icon name={action.icon} />
      </span>
      {action.running && (
        <span className='bm-cta__progress' style={{ width: `${action.progress}%` }} />
      )}
    </button>
  );
}

PrimaryAction.propTypes = {
  action: PropTypes.shape({
    kind: PropTypes.oneOf(['button', 'status']).isRequired,
    title: PropTypes.string.isRequired,
    sub: PropTypes.string,
    icon: PropTypes.string,
    running: PropTypes.bool,
    progress: PropTypes.number,
    onClick: PropTypes.func,
  }),
};
