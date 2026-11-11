import { forwardRef } from 'preact/compat';
import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

function FieldLabel({ htmlFor, children }) {
  return htmlFor ? (
    <label className='bm-field__label' htmlFor={htmlFor}>
      {children}
    </label>
  ) : (
    <span className='bm-field__label'>{children}</span>
  );
}

/**
 * A labelled control: the label above in sentence case, one sentence of help below.
 * By default it is a <label> around one input. Pass `htmlFor` to make the label and the control
 * siblings, or `as='div'` when the control is a group such as a Segmented.
 */
export function Field({ label, help, htmlFor, as, className, children }) {
  const Tag = as || (htmlFor ? 'div' : 'label');
  return (
    <Tag className={cx('bm-field', className)}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {help && <span className='bm-help block'>{help}</span>}
    </Tag>
  );
}

/**
 * A setting in one row: its label and help on the left, its control on the right. Use it for a
 * Switch or a Stepper; `htmlFor` ties the label to the control's id.
 */
export function Setting({ label, help, htmlFor, className, children }) {
  const name = <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>;
  return (
    <div className={cx('bm-setting', className)}>
      {help ? (
        <span className='min-w-0'>
          {name}
          <span className='bm-help block'>{help}</span>
        </span>
      ) : (
        name
      )}
      {children}
    </div>
  );
}

/**
 * A text input: 44px, surface-2, a hairline that becomes the focus ring. Say what blank means in
 * the placeholder. With `unit` the input and its unit share one field: `<Input unit='°C' />`.
 */
export const Input = forwardRef(function Input({ unit, className, ...props }, ref) {
  if (unit == null) return <input ref={ref} {...props} className={cx('bm-input', className)} />;
  return (
    <span className={cx('bm-input bm-input--group', className)}>
      <input ref={ref} {...props} />
      <span className='bm-data'>{unit}</span>
    </span>
  );
});

/** A native select in the input recipe. Its options are its children. */
export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <span className={cx('bm-select', className)}>
      <select ref={ref} {...props}>
        {children}
      </select>
      <Icon name='chevron-down' size={18} />
    </span>
  );
});

/** The input recipe at several lines. */
export const Textarea = forwardRef(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} {...props} className={cx('bm-textarea', className)} />;
});

/**
 * On or off, applied at once. On is ink; off is line-strong.
 *   checked, onChange(next)
 *   label   names it when no visible label points at its `id`
 *   name    submits with a form the way a checkbox would
 */
export function Switch({ checked = false, onChange, label, name, className, ...rest }) {
  return (
    <>
      <button
        {...rest}
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
