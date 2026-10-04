import PropTypes from 'prop-types';
import { ModeTab } from '../ModeTab.jsx';
import { MODES } from '../utils.js';

export function ModeCard({ mode, showGrindTab, changeMode, compact = false, locked = false }) {
  return (
    <div className='bg-base-200 @container flex w-full shrink-0 gap-1 rounded-full p-1'>
      {MODES.filter(m => m.id !== 4 || showGrindTab).map(m => (
        <ModeTab
          key={m.id}
          mode={m}
          active={mode === m.id}
          onClick={() => changeMode(m.id)}
          rotation={m.iconRotation}
          compact={compact}
          disabled={locked}
        />
      ))}
    </div>
  );
}

ModeCard.propTypes = {
  mode: PropTypes.number.isRequired,
  showGrindTab: PropTypes.bool.isRequired,
  changeMode: PropTypes.func.isRequired,
  compact: PropTypes.bool,
  locked: PropTypes.bool,
};
