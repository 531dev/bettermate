import { useEffect, useRef } from 'preact/hooks';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

// Holding a disc repeats the step after 400 ms.
const HOLD_DELAY = 400;
const HOLD_EVERY = 150;

function StepButton({ icon, label, onStep, disabled }) {
  const step = useRef(onStep);
  step.current = onStep;
  const timers = useRef({});
  const repeated = useRef(false);

  const release = () => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.every);
  };
  // A disc that reaches its limit while held is disabled, and then never sees the release.
  useEffect(() => {
    if (disabled) release();
    return release;
  }, [disabled]);

  const press = event => {
    if (event.button > 0) return;
    release();
    repeated.current = false;
    timers.current.delay = setTimeout(() => {
      repeated.current = true;
      step.current?.();
      timers.current.every = setInterval(() => step.current?.(), HOLD_EVERY);
    }, HOLD_DELAY);
  };

  return (
    <button
      type='button'
      className='bm-stepper__btn'
      aria-label={label}
      disabled={disabled}
      onPointerDown={press}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onClick={() => {
        // The click that ends a hold has already been counted.
        if (!repeated.current) onStep?.();
        repeated.current = false;
      }}
    >
      <Icon name={icon} />
    </button>
  );
}

/**
 * Minus, a value, plus: for a number changed in small steps, such as a target temperature.
 * One press is one step, holding repeats, and the value snaps.
 *   value                         what to show, with its unit attached: '93°', '18.0 g'
 *   onDecrease, onIncrease        one step each
 *   canDecrease, canIncrease      false at a limit: that disc is disabled, never hidden
 *   decreaseLabel, increaseLabel  the discs' names for screen readers
 *   onCell                        discs in surface-1, for inside a Cell
 */
export function Stepper({
  value,
  onDecrease,
  onIncrease,
  canDecrease = true,
  canIncrease = true,
  decreaseLabel = 'Lower',
  increaseLabel = 'Raise',
  onCell = false,
  disabled = false,
  className,
}) {
  return (
    <span className={cx('bm-stepper', onCell && 'bm-stepper--on-cell', className)}>
      <StepButton
        icon='minus'
        label={decreaseLabel}
        onStep={onDecrease}
        disabled={disabled || !canDecrease}
      />
      <span className='bm-stepper__value'>{value ?? '—'}</span>
      <StepButton
        icon='plus'
        label={increaseLabel}
        onStep={onIncrease}
        disabled={disabled || !canIncrease}
      />
    </span>
  );
}
