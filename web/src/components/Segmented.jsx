import { cx } from './cx.js';
import { Icon } from './Icon.jsx';

/**
 * A pill-shaped choice of two or three that applies at once. The selected item is ink.
 *   options   [{ value, label, icon?, disabled?, title? }], or plain strings; `title` is the
 *             item's hover hint
 *   value, onChange(value)
 *   label     names the group for screen readers
 *   block     the items share the full width
 *   onTile    the track in surface-0 instead of surface-2: use it inside a Cell
 */
export function Segmented({
  options,
  value,
  onChange,
  label,
  block = false,
  onTile = false,
  disabled = false,
  className,
}) {
  return (
    <div
      role='group'
      aria-label={label}
      className={cx('bm-seg', block && 'bm-seg--block', onTile && 'bm-seg--on-tile', className)}
    >
      {options.map(option => {
        const item = typeof option === 'object' ? option : { value: option, label: option };
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            type='button'
            className='bm-seg__item'
            aria-pressed={selected}
            title={item.title}
            disabled={disabled || item.disabled}
            onClick={() => !selected && onChange?.(item.value)}
          >
            {item.icon && <Icon name={item.icon} size={18} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
