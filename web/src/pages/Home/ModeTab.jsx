import { Icon } from '../../components/Icon.jsx';

export const ModeTab = ({
  mode,
  active,
  onClick,
  rotation = 0,
  compact = false,
  disabled = false,
}) => (
  <>
    <button
      type='button'
      title={mode.label}
      aria-label={mode.label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 min-w-0 flex-1 items-center justify-center rounded-full text-[13px] font-medium transition-colors duration-150 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        active
          ? mode.id === 2
            ? 'bg-secondary text-secondary-content'
            : 'bg-primary text-primary-content'
          : 'hover:text-base-content text-[var(--ink-muted)]'
      }`}
    >
      {compact ? (
        <Icon name={mode.icon} className='h-3.5 w-3.5' rotation={rotation} />
      ) : (
        <>
          <span className='hidden @sm:contents'>{mode.label}</span>
          <span className='@sm:hidden'>
            <Icon name={mode.icon} className='h-3.5 w-3.5' rotation={rotation} />
          </span>
        </>
      )}
    </button>
  </>
);
