import { Icon } from '../../components/Icon.jsx';

const Adjuster = ({ label, value, onDecrease, onIncrease }) => {
  const btn = 'btn btn-ghost btn-sm flex h-8 w-8 items-center justify-center rounded-full p-0';
  return (
    <div className='flex flex-col items-center gap-1'>
      <div className='text-[0.65rem] font-light tracking-wider text-[var(--ink-muted)]'>
        {label}
      </div>
      <div className='flex items-center space-x-2'>
        <button onClick={onDecrease} className={btn}>
          <Icon name={'minus'} className='h-3 w-3' />
        </button>
        <div className='text-base-content min-w-[72px] text-center font-mono text-lg font-bold tabular-nums'>
          {value}
        </div>
        <button onClick={onIncrease} className={btn}>
          <Icon name={'plus'} className='h-3 w-3' />
        </button>
      </div>
    </div>
  );
};

export default Adjuster;
