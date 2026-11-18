import { useRef, useState } from 'preact/hooks';
import { Button } from './Button.jsx';
import { cx } from './cx.js';
import { Setting, Switch } from './Field.jsx';
import { Icon } from './Icon.jsx';

/**
 * A setting that is on or off, as a Switch beside its label. `onChange` receives what a checkbox
 * would send (`event.target.checked`), which is what the pages read.
 */
export function ToggleField({ label, htmlFor, checked, onChange, helpText }) {
  const report = next => {
    const target = { id: htmlFor, name: htmlFor, checked: next, value: 'on' };
    onChange?.({ target, currentTarget: target });
  };

  return (
    <Setting label={label} help={helpText} htmlFor={htmlFor}>
      <Switch id={htmlFor} name={htmlFor} checked={!!checked} onChange={report} />
    </Setting>
  );
}

/**
 * Two lists, shown and hidden, for choosing and ordering dashboard panels and readings: drag a
 * row, or use its buttons.
 *   order          ids of the visible items, in order
 *   definitions    [{ id, label, required? }]: a required item cannot be removed
 *   hidden         definitions that are not in `order`
 *   onOrderChange(ids)
 *   emptyMessage   shown when nothing is hidden
 *   extraControls(definition)  more controls for a visible row
 */
export function SortableConfigurator({
  order,
  definitions,
  hidden,
  onOrderChange,
  emptyMessage,
  extraControls,
}) {
  const orderRef = useRef(order);
  orderRef.current = order;

  const draggingIdRef = useRef(null);
  const draggingSourceRef = useRef(null);
  const [draggingId, setDraggingId] = useState(null);
  const [draggingSource, setDraggingSource] = useState(null);
  const dragOverInfoRef = useRef(null);
  const [dragOverInfo, setDragOverInfo] = useState(null);

  const updateDragOver = info => {
    dragOverInfoRef.current = info;
    setDragOverInfo(info);
  };

  const startDrag = (e, id, source) => {
    draggingIdRef.current = id;
    draggingSourceRef.current = source;
    setDraggingId(id);
    setDraggingSource(source);
    e.dataTransfer.effectAllowed = 'move';
  };

  const endDrag = () => {
    draggingIdRef.current = null;
    draggingSourceRef.current = null;
    setDraggingId(null);
    setDraggingSource(null);
    updateDragOver(null);
  };

  const move = (id, dir) => {
    const idx = order.indexOf(id);
    if (idx === -1) return;
    const next = [...order];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    onOrderChange(next);
  };

  const remove = id => {
    const def = definitions.find(d => d.id === id);
    if (def?.required) return;
    onOrderChange(order.filter(oid => oid !== id));
  };

  const add = id => {
    if (order.includes(id)) return;
    onOrderChange([...order, id]);
  };

  // The line that shows where a dragged row will land.
  const dropLine = 'var(--outline) solid var(--focus)';
  const row = 'bm-cell min-h-14 flex-row items-center gap-2 py-2 pr-2 pl-3';

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
      <div className='flex flex-col gap-2'>
        <span className='bm-eyebrow'>Visible</span>
        <div
          className='flex flex-col gap-1'
          style={{
            borderRadius: 'var(--radius-lg)',
            outline: draggingSource === 'available' ? dropLine : undefined,
          }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault();
            const srcId = draggingIdRef.current;
            const src = draggingSourceRef.current;
            if (!srcId || src !== 'available') return;
            const cur = orderRef.current;
            if (!cur.includes(srcId)) onOrderChange([...cur, srcId]);
          }}
        >
          {order.map((id, idx) => {
            const def = definitions.find(d => d.id === id);
            if (!def) return null;
            const isDragging = draggingId === id;
            const overPos = dragOverInfo?.id === id && !isDragging ? dragOverInfo.pos : null;
            return (
              <div
                key={id}
                draggable
                onDragStart={e => startDrag(e, id, 'visible')}
                onDragOver={e => {
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const pos = e.clientY < r.top + r.height / 2 ? 'before' : 'after';
                  if (dragOverInfoRef.current?.id !== id || dragOverInfoRef.current?.pos !== pos) {
                    updateDragOver({ id, pos });
                  }
                }}
                onDragLeave={e => {
                  if (!e.currentTarget.contains(e.relatedTarget)) updateDragOver(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  const info = dragOverInfoRef.current;
                  updateDragOver(null);
                  const srcId = draggingIdRef.current;
                  const src = draggingSourceRef.current;
                  if (!srcId || !info) return;
                  const cur = orderRef.current;
                  if (src !== 'visible' && cur.includes(srcId)) return;
                  const next = src === 'visible' ? cur.filter(x => x !== srcId) : [...cur];
                  const targetIdx = next.indexOf(info.id);
                  if (targetIdx === -1) return;
                  next.splice(info.pos === 'before' ? targetIdx : targetIdx + 1, 0, srcId);
                  onOrderChange(next);
                }}
                onDragEnd={endDrag}
                className={cx(row, '@container', isDragging && 'text-(--ink-faint)')}
                style={{
                  borderTop: overPos === 'before' ? dropLine : undefined,
                  borderBottom: overPos === 'after' ? dropLine : undefined,
                }}
              >
                <Icon name='menu' size={18} className='cursor-grab text-(--ink-faint)' />
                <span className='min-w-0 flex-1'>{def.label}</span>
                {extraControls?.(def)}
                <Button
                  iconOnly
                  size='sm'
                  variant='outline'
                  aria-label={`Move ${def.label} up`}
                  disabled={idx === 0}
                  onClick={() => move(id, 'up')}
                >
                  <Icon name='chevron-up' size={18} />
                </Button>
                <Button
                  iconOnly
                  size='sm'
                  variant='outline'
                  aria-label={`Move ${def.label} down`}
                  disabled={idx === order.length - 1}
                  onClick={() => move(id, 'down')}
                >
                  <Icon name='chevron-down' size={18} />
                </Button>
                {!def.required && (
                  <Button
                    iconOnly
                    size='sm'
                    variant='outline'
                    aria-label={`Hide ${def.label}`}
                    onClick={() => remove(id)}
                  >
                    <Icon name='x' size={18} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className='flex flex-col gap-2'>
        <span className='bm-eyebrow'>Hidden</span>
        <div className='flex flex-col gap-1'>
          {hidden.map(def => (
            <div
              key={def.id}
              draggable
              onDragStart={e => startDrag(e, def.id, 'available')}
              onDragEnd={endDrag}
              className={cx(row, 'cursor-grab', draggingId === def.id && 'text-(--ink-faint)')}
            >
              <Icon name='menu' size={18} className='text-(--ink-faint)' />
              <span className='min-w-0 flex-1'>{def.label}</span>
              <Button size='sm' variant='outline' onClick={() => add(def.id)}>
                <Icon name='plus' size={18} />
                Add
              </Button>
            </div>
          ))}
          {hidden.length === 0 && <p className='bm-help'>{emptyMessage}</p>}
        </div>
      </div>
    </div>
  );
}
