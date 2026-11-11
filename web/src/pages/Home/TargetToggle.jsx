import { Icon } from '../../components/Icon.jsx';

const TargetToggle = ({ value, onChange }) => {
  const pill = on =>
    `flex min-h-11 flex-1 flex-row cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm transition-all duration-200 ${on ? 'bg-primary text-primary-content font-medium' : 'text-[var(--ink-muted)] hover:text-base-content'}`;
  return (
    <div className='bg-base-200 flex min-w-0 rounded-full p-1'>
      <button
        type='button'
        aria-pressed={value === 0}
        className={pill(value === 0)}
        onClick={() => onChange(0)}
      >
        <Icon name={'clock'} className='text-[0.65rem]' /> <span>Time</span>
      </button>
      <button
        type='button'
        aria-pressed={value === 1}
        className={pill(value === 1)}
        onClick={() => onChange(1)}
      >
        <Icon name={'scale'} className='text-[0.65rem]' /> <span>Weight</span>
      </button>
    </div>
  );
};

export default TargetToggle;
