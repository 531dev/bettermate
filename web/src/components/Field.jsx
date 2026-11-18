import { createContext } from 'preact';
import { forwardRef } from 'preact/compat';
import { useContext, useId } from 'preact/hooks';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

// The id of the help under a Field or a Setting, so that the control inside reads it with its name.
const FieldHelp = createContext(undefined);

/**
 * The control's `aria-describedby`: what it was given, then the help of the Field around it.
 * Input, Select, Textarea and Switch use it; a control of a page's own can too.
 */
export function useDescribedBy(given) {
  const help = useContext(FieldHelp);
  return [given, help].filter(Boolean).join(' ') || undefined;
}

function FieldLabel({ htmlFor, optional, children }) {
  const content = optional ? (
    <>
      <span className='min-w-0'>{children}</span>
      <span className='bm-field__opt'>Optional</span>
    </>
  ) : (
    children
  );
  return htmlFor ? (
    <label className='bm-field__label' htmlFor={htmlFor}>
      {content}
    </label>
  ) : (
    <span className='bm-field__label'>{content}</span>
  );
}

/** One sentence of help, with the id its control points at. */
function Help({ id, children }) {
  return (
    <span id={id} className='bm-help block'>
      {children}
    </span>
  );
}

/**
 * A labelled control: the label above in sentence case, one sentence of help below. The help is
 * where an instruction goes ("Leave blank to keep the saved one"), never the placeholder; Input,
 * Select, Textarea and Switch inside are described by it.
 * By default it is a <label> around one input. Pass `htmlFor` to make the label and the control
 * siblings, or `as='div'` when the control is a group such as a Segmented.
 *   optional  says "Optional" at the label's right; required fields are not marked
 */
export function Field({ label, help, htmlFor, as, optional = false, className, children }) {
  const Tag = as || (htmlFor ? 'div' : 'label');
  const helpId = `${useId()}-help`;
  return (
    <Tag className={cx('bm-field', className)}>
      <FieldLabel htmlFor={htmlFor} optional={optional}>
        {label}
      </FieldLabel>
      <FieldHelp.Provider value={help ? helpId : undefined}>{children}</FieldHelp.Provider>
      {help && <Help id={helpId}>{help}</Help>}
    </Tag>
  );
}

/**
 * A setting in one row: its label and help on the left, its control on the right. Use it for a
 * Switch or a Stepper; `htmlFor` ties the label to the control's id.
 */
export function Setting({ label, help, htmlFor, className, children }) {
  const helpId = `${useId()}-help`;
  const name = <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>;
  return (
    <div className={cx('bm-setting', className)}>
      {help ? (
        <span className='min-w-0'>
          {name}
          <Help id={helpId}>{help}</Help>
        </span>
      ) : (
        name
      )}
      <FieldHelp.Provider value={help ? helpId : undefined}>{children}</FieldHelp.Provider>
    </div>
  );
}

/**
 * A text input: 44px, surface-2, a line-strong edge. A placeholder only shows an example of the
 * format ('192.168.1.20'); an instruction goes in the Field's help. With `unit` the input and its
 * unit share one field: `<Input unit='°C' />`.
 */
export const Input = forwardRef(function Input({ unit, className, ...props }, ref) {
  const describedBy = useDescribedBy(props['aria-describedby']);
  if (unit == null)
    return (
      <input
        ref={ref}
        {...props}
        aria-describedby={describedBy}
        className={cx('bm-input', className)}
      />
    );
  // The whole field is the input's target: a press on its padding or its unit focuses it.
  const focusInput = event => {
    const input = event.currentTarget.querySelector('input');
    if (event.target === input || !input || input.disabled) return;
    event.preventDefault();
    input.focus();
  };
  return (
    <span className={cx('bm-input bm-input--group', className)} onPointerDown={focusInput}>
      <input ref={ref} {...props} aria-describedby={describedBy} />
      <span className='bm-data'>{unit}</span>
    </span>
  );
});

/**
 * A native select in the input recipe, with the chevron inside it. Its options are its children.
 * `className` reaches the wrapper (`bm-inputwrap`), so layout utilities size the whole field; a
 * page styles the select itself as `.its-class > .bm-select`.
 */
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  const describedBy = useDescribedBy(props['aria-describedby']);
  return (
    <span className={cx('bm-inputwrap', className)}>
      <select ref={ref} {...props} aria-describedby={describedBy} className='bm-select'>
        {children}
      </select>
      <Icon name='chevron-down' size={18} className='bm-input__icon' />
    </span>
  );
});

/** The input recipe at several lines. */
export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  const describedBy = useDescribedBy(props['aria-describedby']);
  return (
    <textarea
      ref={ref}
      {...props}
      aria-describedby={describedBy}
      className={cx('bm-textarea', className)}
    />
  );
});

/**
 * On or off, applied at once. On is ink; off is line-strong.
 *   checked, onChange(next)
 *   label   names it when no visible label points at its `id`
 *   name    submits with a form the way a checkbox would
 */
export function Switch({ checked = false, onChange, label, name, className, ...rest }) {
  const describedBy = useDescribedBy(rest['aria-describedby']);
  return (
    <>
      <button
        {...rest}
        aria-describedby={describedBy}
        type='button'
        role='switch'
        aria-checked={!!checked}
        aria-label={label}
        className={cx('bm-switch', className)}
        onClick={event => onChange?.(!checked, event)}
      />
      {name && checked && <input type='hidden' name={name} value='on' />}
    </>
  );
}

/**
 * A native checkbox for a choice that waits for its form (a Switch applies at once). Checked is
 * an ink fill. The label is `label` or the children; other props reach the input.
 */
export function Checkbox({ label, className, children, ...props }) {
  return (
    <label className={cx('bm-checkbox', className)}>
      <input type='checkbox' {...props} />
      <span className='bm-checkbox__box'>
        <Icon name='check' size={16} />
      </span>
      {label ?? children}
    </label>
  );
}

/** A native radio button, drawn like the Checkbox, for a list of choices that waits for its form. */
export function Radio({ label, className, children, ...props }) {
  return (
    <label className={cx('bm-radio', className)}>
      <input type='radio' {...props} />
      <span className='bm-radio__box' />
      {label ?? children}
    </label>
  );
}
