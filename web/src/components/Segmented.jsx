import { useEffect, useRef } from 'preact/hooks';
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
 *   describedBy  the id of help under the group
 *   scroll    more items than the row holds (favourite profiles): the track scrolls sideways,
 *             each item keeps its name up to 176px, and the selected one is scrolled into view
 */
export function Segmented({
  options,
  value,
  onChange,
  label,
  block = false,
  onTile = false,
  disabled = false,
  describedBy,
  scroll = false,
  className,
}) {
  const track = useRef();
  useEffect(() => {
    if (!scroll || !track.current) return;
    const selected = track.current.querySelector('[aria-pressed="true"]');
    if (!selected) return;
    // Only the track moves, never the page around it.
    const box = track.current;
    const left = selected.offsetLeft - box.offsetLeft;
    if (left < box.scrollLeft || left + selected.offsetWidth > box.scrollLeft + box.clientWidth)
      box.scrollLeft = left - (box.clientWidth - selected.offsetWidth) / 2;
  }, [scroll, value]);
  return (
    <div
      ref={track}
      role='group'
      aria-label={label}
      aria-describedby={describedBy}
      className={cx(
        'bm-seg',
        block && !scroll && 'bm-seg--block',
        scroll && 'bm-seg--scroll',
        onTile && 'bm-seg--on-tile',
        className,
      )}
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
            <span className='bm-seg__label'>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
