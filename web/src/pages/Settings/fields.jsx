import { createContext } from 'preact';
import { useContext, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { cx } from '../../components/cx.js';
import { Field, Input, Select, Setting } from '../../components/Field.jsx';
import { Icon } from '../../components/Icon.jsx';
import { Segmented } from '../../components/Segmented.jsx';
import { SettingsFormField } from '../../components/SettingsFormField.jsx';
import { Stepper } from '../../components/Stepper.jsx';

// The Settings page's own field pieces: the foundation's Field, Input, Segmented, Stepper and
// Switch, composed the way the tabs use them. Layout utilities and recipes only.

/** Tiles of a tab: one column on a phone, two from 768px, where each tile is as wide as a phone's. */
export const TILE_GRID = 'grid grid-cols-1 gap-2 md:grid-cols-2 lg:gap-3';

/** What the last save found wrong, by input id. The page provides it and each field reads its own. */
export const FormErrors = createContext({});

/** A field's problem, as a notice under its control. */
export function FieldError({ id, children }) {
  return (
    <span id={id} className='bm-notice bm-notice--danger px-3 py-2'>
      {children}
    </span>
  );
}

function useFieldError(id, given) {
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
 * Anything typed: a label, an input (with its `unit` in the same field) and one sentence of help.
 * The input keeps its native constraints (`min`, `max`, `step`, `minLength`); what they reject on
 * save shows under it. `error` shows a problem the tab found itself.
 */
export function TextField({ id, label, help, unit, error: given, ...input }) {
  const { error, errorId, invalid } = useFieldError(id, given);
  return (
    <SettingsFormField label={label} htmlFor={id} helpText={help}>
      <Input id={id} name={id} unit={unit} {...invalid} {...input} />
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </SettingsFormField>
  );
}

/** A password with a button that shows it. */
export function PasswordField({ id, label, help, ...input }) {
  const [shown, setShown] = useState(false);
  const { error, errorId, invalid } = useFieldError(id);
  return (
    <SettingsFormField label={label} htmlFor={id} helpText={help}>
      <span className='bm-input bm-input--group pr-0 has-[button:focus-visible]:outline-none'>
        <input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          autoComplete='off'
          {...invalid}
          {...input}
        />
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
    </SettingsFormField>
  );
}

/** A choice of more than three: a native select. Its options are its children. */
export function SelectField({ id, label, help, children, ...select }) {
  return (
    <SettingsFormField label={label} htmlFor={id} helpText={help}>
      <Select id={id} name={id} {...select}>
        {children}
      </Select>
    </SettingsFormField>
  );
}

/**
 * A choice of two or three, across the tile's width.
 *   name      names the group for screen readers when `label` is not plain text
 *   children  follow the help, such as a link
 */
export function SegmentedField({ label, name, help, className, children, ...segmented }) {
  return (
    <Field label={label} as='div' className={className}>
      <Segmented block label={name ?? label} {...segmented} />
      {help && <span className='bm-help block'>{help}</span>}
      {children}
    </Field>
  );
}

/**
 * A value that steps: its label on the left, minus, the value and plus on the right, and the help
 * under both, so a long sentence keeps the row's width on a phone.
 */
export function StepperSetting({ label, help, className, ...stepper }) {
  return (
    <div className={cx('bm-field', className)}>
      <Setting label={label}>
        <Stepper {...stepper} />
      </Setting>
      {help && <span className='bm-help block'>{help}</span>}
    </div>
  );
}
