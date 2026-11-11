import { Icon } from '../../components/Icon.jsx';

const Adjuster = ({ label, value, onDecrease, onIncrease }) => {
  const btn =
    'btn btn-outline flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0';
  return (
    <div className='flex flex-col items-center gap-1'>
      <div className='text-xs tracking-wider text-[var(--ink-muted)]'>{label}</div>
      <div className='flex items-center space-x-2'>
        <button
          type='button'
          aria-label={`Decrease ${label.toLowerCase()} target`}
          onClick={onDecrease}
          className={btn}
        >
          <Icon name={'minus'} className='h-3 w-3' />
        </button>
        <div className='text-base-content min-w-[72px] text-center font-mono text-lg font-normal tabular-nums'>
          {value}
        </div>
        <button
          type='button'
          aria-label={`Increase ${label.toLowerCase()} target`}
          onClick={onIncrease}
          className={btn}
        >
          <Icon name={'plus'} className='h-3 w-3' />
        </button>
      </div>
    </div>
  );
};

export default Adjuster;
