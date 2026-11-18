import { createContext } from 'preact';
import { useCallback, useContext, useId, useRef, useState } from 'preact/hooks';
import { Button } from './Button.jsx';
import { cx } from './cx.js';
import { Field, Input, Select, Setting, Textarea, useDescribedBy } from './Field.jsx';
import { Icon } from './Icon.jsx';
import { NumberField } from './NumberField.jsx';
import { Segmented } from './Segmented.jsx';
import { Stepper } from './Stepper.jsx';

// The fields of a form that is saved as a whole (Settings, the profile editor): Field, Input,
// Select, Segmented and Stepper composed with a label, one sentence of help and what the last
// save found wrong. Layout utilities and recipes only.

/**
 * What the last save found wrong, by input id. A form provides it
 * (`<FormErrors.Provider value={errors}>`) and each field reads its own.
 */
export const FormErrors = createContext({});

/**
 * A field's problem under its control, in danger with the error glyph. It takes the help's place.
 * `id` is `<input id>-error`.
 */
export function FieldError({ id, children }) {
  return (
    <span id={id} className='bm-field__msg bm-field__msg--error'>
      <Icon name='circle-alert' size={14} aria-hidden='true' />
      <span>{children}</span>
    </span>
  );
}

/**
 * The problem of the field `id`: the one `given` by its page, or the form's.
 * `invalid` is what the control takes so that readers hear the message with it.
 */
export function useFieldError(id, given) {
  const fromForm = useContext(FormErrors)[id];
  const error = given ?? fromForm;
  return {
    error,
    errorId: `${id}-error`,
    invalid: {
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': error ? `${id}-error` : undefined,
    },
  };
}

/**
 * The browser's own field validation (`required`, `min`, `max`, `step`), said in the page instead
 * of in the browser's bubble. A submit with an invalid field stops as it always did; each invalid
 * field then says why under itself, the first one takes focus, and a message goes as soon as its
 * field is valid again.
 *
 * Spread `formProps` on the <form>, and wrap its fields in <FormErrors.Provider value={errors}>.
 * Call `clearErrors` when the fields on the page change, because messages are kept by field id.
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

/**
 * Anything typed: a label, an input and one sentence of help. `id` ties the label, the input and
 * its message together, and is the input's `name` unless one is given. The input keeps its native
 * constraints (`min`, `max`, `step`, `minLength`); what they reject on save shows under it.
 *   unit       the input and its unit share one field. A number with a short unit
 *              (`type='number'`) is a NumberField: decimal keyboard, Up and Down step, a comma
 *              is a point, rounded to `step` and checked against `min` and `max` when focus leaves
 *   multiline  a textarea
 *   optional   says "Optional" beside the label (never in the placeholder)
 *   error      a problem the page found itself; otherwise the form's (FormErrors)
 * Everything else reaches the input.
 */
export function FormField({
  id,
  label,
  help,
  unit,
  multiline = false,
  optional = false,
  error: given,
  className,
  ...props
}) {
  // A NumberField says what is wrong as soon as focus leaves it, not only on save.
  const [left, setLeft] = useState(null);
  const { error, errorId, invalid } = useFieldError(
    id,
    given ?? (left?.id === id ? left.text : null),
  );
  const numeric = !multiline && props.type === 'number' && unit && `${unit}`.length <= 4;
  const Control = multiline ? Textarea : numeric ? NumberField : Input;

  // A number is typed through texts that are not that number yet: '18.' on its way to '18.5', an
  // empty field on its way to a new value. While the field has focus it shows what was typed and
  // not what the form made of it, which would take the point away and move the caret. The form's
  // value shows again when focus leaves. Kept by id: one field serves each phase in turn.
  const [typed, setTyped] = useState(null);
  const keepsText = !multiline && props.type === 'number';
  const draft = keepsText && typed?.id === id ? typed.text : null;

  return (
    <Field
      label={label}
      htmlFor={id}
      help={error ? undefined : help}
      optional={optional}
      className={className}
    >
      <Control
        name={id}
        {...props}
        id={id}
        value={draft ?? props.value}
        type={numeric ? undefined : props.type}
        onInput={event => {
          if (keepsText) setTyped({ id, text: event.target.value });
          if (numeric && left && event.target.validity.valid) setLeft(null);
          props.onInput?.(event);
        }}
        onBlur={event => {
          if (keepsText) setTyped(null);
          if (numeric) {
            const text = event.target.validationMessage;
            setLeft(text ? { id, text } : null);
          }
          props.onBlur?.(event);
        }}
        unit={multiline ? undefined : unit}
        {...invalid}
      />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}

/** The input of a PasswordField, inside its Field so that it reads the help's id. */
function PasswordInput({ shown, invalid, ...input }) {
  const describedBy = useDescribedBy(invalid['aria-describedby']);
  return (
    <input
      type={shown ? 'text' : 'password'}
      autoComplete='off'
      {...invalid}
      aria-describedby={describedBy}
      {...input}
    />
  );
}

/** A password with a button that shows it. */
export function PasswordField({ id, label, help, ...input }) {
  const [shown, setShown] = useState(false);
  const { error, errorId, invalid } = useFieldError(id);
  return (
    <Field label={label} htmlFor={id} help={error ? undefined : help}>
      <span className='bm-input bm-input--group pr-0 has-[button:focus-visible]:outline-none'>
        <PasswordInput id={id} name={id} shown={shown} invalid={invalid} {...input} />
        <Button
          iconOnly
          variant='ghost'
          className='text-(--ink-muted)'
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          onClick={() => setShown(!shown)}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={20} />
        </Button>
      </span>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}

/** A choice of more than three: a native select. Its options are its children. */
export function SelectField({ id, label, help, className, children, ...select }) {
  return (
    <Field label={label} htmlFor={id} help={help} className={className}>
      <Select id={id} name={id} {...select}>
        {children}
      </Select>
    </Field>
  );
}

/**
 * A choice of two or three, across the tile's width.
 *   name      names the group for screen readers when `label` is not plain text
 *   children  follow the help, such as a link
 * Everything else reaches the Segmented.
 */
export function SegmentedField({ label, name, help, className, children, ...segmented }) {
  const helpId = `${useId()}-help`;
  return (
    <Field label={label} as='div' className={className}>
      <Segmented
        block
        label={name ?? label}
        describedBy={help ? helpId : undefined}
        {...segmented}
      />
      {help && (
        <span id={helpId} className='bm-help block'>
          {help}
        </span>
      )}
      {children}
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
      <SegmentedField
        label={label}
        help={help}
        options={options}
        value={value}
        onChange={onChange}
        className={className}
      />
    );
  }
  return (
    <SelectField
      id={id}
      name={undefined}
      label={label}
      help={help}
      className={className}
      value={value}
      onChange={event => onChange(event.target.value)}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

/**
 * A value that steps: its label on the left, minus, the value and plus on the right, and the help
 * under both, so a long sentence keeps the row's width on a phone. Everything else reaches the
 * Stepper.
 */
export function StepperSetting({ label, help, className, ...stepper }) {
  const helpId = `${useId()}-help`;
  return (
    <div className={cx('bm-field', className)}>
      <Setting label={label}>
        <Stepper describedBy={help ? helpId : undefined} {...stepper} />
      </Setting>
      {help && (
        <span id={helpId} className='bm-help block'>
          {help}
        </span>
      )}
    </div>
  );
}
