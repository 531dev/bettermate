import { forwardRef } from 'preact/compat';
import { useId } from 'preact/hooks';
import { cx } from './cx.js';
import { useDescribedBy } from './Field.jsx';

// A unit's word for a screen reader: "G" alone is read as a letter.
const UNIT_WORDS = {
  '°C': 'degrees Celsius',
  '°': 'degrees',
  bar: 'bar',
  g: 'grams',
  ml: 'millilitres',
  'ml/s': 'millilitres a second',
  'g/s': 'grams a second',
  s: 'seconds',
  ms: 'milliseconds',
  min: 'minutes',
  h: 'hours',
  '%': 'percent',
  mm: 'millimetres',
  dB: 'decibels',
  W: 'watts',
};

const decimalsOf = step => {
  const text = `${step ?? ''}`;
  return text.includes('.') ? text.split('.')[1].length : 0;
};
const parse = text =>
  /^\s*-?(\d+([.,]\d*)?|[.,]\d+)\s*$/.test(text) ? parseFloat(text.replace(',', '.')) : NaN;
const num = value => (value === undefined || value === null || value === '' ? null : Number(value));

/** What is wrong with `text` for these limits, as the field's message, or ''. */
export function numberProblem(text, { min, max, unit, required }) {
  if (`${text}`.trim() === '') return required ? 'Enter a value.' : '';
  const value = parse(`${text}`);
  if (!Number.isFinite(value)) return 'Enter a number.';
  const [low, high] = [num(min), num(max)];
  const words = unit ? ` ${unit}` : '';
  if ((low !== null && value < low) || (high !== null && value > high)) {
    if (low !== null && high !== null) return `Enter ${low} to ${high}${words}.`;
    if (low !== null) return `Enter ${low}${words} or more.`;
    return `Enter up to ${high}${words}.`;
  }
  return '';
}

// Writes a value the way typing would, so the page's onInput and onChange hear it.
function put(input, text) {
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * A typed number with its unit inside the field: dose, yield, a phase's duration. A text input
 * with the decimal keyboard (no spinner, no scroll-wheel changes), the number right-aligned and
 * the unit in the space after it, given its word for screen readers.
 *   unit           '°C', 'g', 'bar', 's' ...
 *   min, max       the range; a value outside it is the field's error ("Enter 80 to 100 °C.")
 *   step           what Up and Down add (Shift for ten times as much; at least 0.1), and the
 *                  decimals the value is rounded to when the field loses focus
 * A comma is taken as the decimal point. Everything else reaches the input.
 */
export const NumberField = forwardRef(function NumberField(
  { unit, min, max, step, required, className, onKeyDown, onInput, onBlur, ...props },
  ref,
) {
  const unitId = useId();
  const describedBy = useDescribedBy([props['aria-describedby'], unitId].filter(Boolean).join(' '));
  const limits = { min, max, unit, required };

  const check = input => input.setCustomValidity(numberProblem(input.value, limits));

  const focusInput = event => {
    const input = event.currentTarget.querySelector('input');
    if (event.target === input || !input || input.disabled) return;
    event.preventDefault();
    input.focus();
  };

  return (
    <span className={cx('bm-inputwrap', className)} onPointerDown={focusInput}>
      <input
        ref={node => {
          if (node) check(node);
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type='text'
        inputMode='decimal'
        autoComplete='off'
        {...props}
        required={required}
        aria-describedby={describedBy}
        className='bm-input bm-input--num'
        onInput={event => {
          const input = event.currentTarget;
          if (input.value.includes(',')) {
            const at = input.selectionStart;
            input.value = input.value.replace(/,/g, '.');
            input.setSelectionRange(at, at);
          }
          check(input);
          onInput?.(event);
        }}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (event.defaultPrevented || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown'))
            return;
          event.preventDefault();
          const input = event.currentTarget;
          const by = Math.max(Number(step) || 1, 0.1) * (event.shiftKey ? 10 : 1);
          const now = parse(input.value);
          let next =
            (Number.isFinite(now) ? now : (num(min) ?? 0)) + (event.key === 'ArrowUp' ? by : -by);
          if (num(min) !== null) next = Math.max(num(min), next);
          if (num(max) !== null) next = Math.min(num(max), next);
          put(input, `${Number(next.toFixed(Math.max(decimalsOf(step), decimalsOf(by))))}`);
        }}
        onBlur={event => {
          const input = event.currentTarget;
          const value = parse(input.value);
          // Rounded to the step's decimals when focus leaves, never while typing.
          if (step && step !== 'any' && Number.isFinite(value)) {
            const shown = `${Number(value.toFixed(decimalsOf(step)))}`;
            if (shown !== input.value) put(input, shown);
          }
          check(input);
          onBlur?.(event);
        }}
      />
      {unit && (
        <span className='bm-input__unit' id={unitId}>
          <span aria-hidden='true'>{unit}</span>
          <span className='bm-sr'>{UNIT_WORDS[unit] ?? unit}</span>
        </span>
      )}
    </span>
  );
});
