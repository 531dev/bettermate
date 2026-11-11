export const ModeTab = ({ mode, active, onClick, disabled = false }) => (
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
          ? 'bg-primary text-primary-content'
          : 'hover:text-base-content text-[var(--ink-muted)]'
      }`}
    >
      <span>{mode.label}</span>
    </button>
  </>
);
