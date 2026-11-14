import { createContext } from 'preact';
import { useCallback, useContext, useRef, useState } from 'preact/hooks';
import { Field, Input, Select, Textarea } from '../../components/Field.jsx';
import { Segmented } from '../../components/Segmented.jsx';

const Errors = createContext({});

/**
 * The browser's own field validation (`required`, `min`, `max`, `step`), said in the page instead
 * of in the browser's bubble. A submit with an invalid field stops as it always did; each invalid
 * field then says why under itself, the first one takes focus, and a message goes as soon as its
 * field is valid again.
 *
 * Spread `formProps` on the <form>, and wrap its fields in <FormErrors value={errors}>. Call
 * `clearErrors` when the fields on the page change, because messages are kept by field id.
 */
export function useFormValidation() {
  const [errors, setErrors] = useState({});
  const collecting = useRef(null);

  const onInvalidCapture = useCallback(event => {
    event.preventDefault();
    const field = event.target;
    if (!collecting.current) {
      // Every invalid field of one submit reports in the same task: show them together.
      collecting.current = {};
      setTimeout(() => {
        setErrors(collecting.current);
        collecting.current = null;
        field.scrollIntoView({ block: 'center' });
        field.focus({ preventScroll: true });
      });
    }
    if (field.id) collecting.current[field.id] = field.validationMessage;
  }, []);

  // On the way back up from the field, not on the way down: a state change made before the field's
  // own handler runs would redraw the field with its old value first.
  const onInput = useCallback(event => {
    const field = event.target;
    setErrors(current => {
      if (!field.id || !(field.id in current)) return current;
      const next = { ...current };
      if (field.validity?.valid) delete next[field.id];
      else next[field.id] = field.validationMessage;
      return next;
    });
  }, []);

  const clearErrors = useCallback(
    () => setErrors(current => (Object.keys(current).length ? {} : current)),
    [],
  );

  return { errors, clearErrors, formProps: { onInvalidCapture, onInput } };
}

export const FormErrors = Errors.Provider;

/**
 * A labelled input of a validated form. `id` ties the label, the input and its message together.
 *   unit       the input and its unit share one field
 *   multiline  a textarea
 *   help       one sentence under the field; a validation message takes its place
 * Everything else reaches the input.
 */
export function FormField({ id, label, help, unit, multiline = false, className, ...props }) {
  const error = useContext(Errors)[id];
  const Control = multiline ? Textarea : Input;

  return (
    <Field label={label} htmlFor={id} help={error ? undefined : help} className={className}>
      <Control
        {...props}
        id={id}
        unit={multiline ? undefined : unit}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={error ? 'border-(--danger)' : undefined}
      />
      {error && (
        <span id={`${id}-error`} className='bm-help block text-(--danger)'>
          {error}
        </span>
      )}
    </Field>
  );
}

/**
 * One choice among named options: a Segmented control for two or three, a Select for more.
 *   options   [{ value, label }]
 *   value, onChange(value)
 *   id        the select's id, when there are more than three options
 */
export function Choice({ id, label, help, options, value, onChange, className }) {
  if (options.length <= 3) {
    return (
      <Field label={label} help={help} as='div' className={className}>
        <Segmented block label={label} options={options} value={value} onChange={onChange} />
      </Field>
    );
  }
  return (
    <Field label={label} htmlFor={id} help={help} className={className}>
      <Select id={id} value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
