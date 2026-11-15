import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Input } from '../../../components/Field.jsx';
import { Icon } from '../../../components/Icon.jsx';
import { IconButton } from '../../../components/IconButton.jsx';
import { Popover } from '../../../components/Popover.jsx';
import '../statistics.css';
import { TOOLBAR_FLOATING_PANEL_ATTR } from './toolbar/constants';
import { useFocusOnOpen, usePopoverState } from './toolbar/hooks';

/* global globalThis */

const LONG_PRESS_MS = 220;
const MOVE_CANCEL_PX = 10;
const FLOATING_PANEL_PROPS = { [TOOLBAR_FLOATING_PANEL_ATTR]: '' };

// Reusable multiselect dropdown with desktop modifiers and touch "paint" selection.
function getBrowserWindow() {
  return globalThis.window;
}

function getBrowserDocument() {
  return globalThis.document;
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim();
}

function buildOrderedSelection(items, nextSet) {
  const ordered = [];
  const seen = new Set();
  for (const item of items || []) {
    if (!item?.id || seen.has(item.id)) continue;
    seen.add(item.id);
    if (nextSet.has(item.id)) ordered.push(item.id);
  }
  return ordered;
}

function getSingularLabel(label) {
  const normalized = String(label ?? '')
    .trim()
    .toLowerCase();
  if (normalized.endsWith('ies')) return `${normalized.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|sses|oes)$/.test(normalized)) return normalized.slice(0, -2);
  if (normalized.endsWith('s')) return normalized.slice(0, -1);
  return normalized || 'item';
}

function StatisticsMultiSelectRow({
  item,
  index,
  isSelected,
  singularLabel,
  onTogglePin,
  onRowClick,
  onCirclePointerDown,
  onCircleClick,
}) {
  const name = item.primary || item.id;
  const pinBlocked = !item.isPinned && !!item.pinDisabledReason;

  return (
    <div
      data-stat-multi-item-id={item.id}
      className='an-press flex items-center gap-1 rounded-md pr-1'
    >
      <button
        type='button'
        role='checkbox'
        aria-checked={isSelected}
        aria-label={`${isSelected ? 'Deselect' : 'Select'} ${name}`}
        className='st-option__mark'
        onClick={event => onCircleClick(item.id, index, event)}
        onPointerDown={event => {
          event.stopPropagation();
          onCirclePointerDown(event, item.id);
        }}
      >
        <span className='st-option__box'>
          <Icon name='check' size={14} />
        </span>
      </button>

      <button
        type='button'
        className='flex min-w-0 flex-1 cursor-pointer flex-col py-1 text-left'
        aria-pressed={isSelected}
        onClick={event => onRowClick(item.id, index, event)}
      >
        <span className='bm-label truncate'>{name}</span>
        {item.secondary ? <span className='bm-data truncate'>{item.secondary}</span> : null}
      </button>

      {onTogglePin ? (
        <IconButton
          size='sm'
          pressed={!!item.isPinned}
          label={`${item.isPinned ? 'Unpin' : 'Pin'} ${name}`}
          title={item.pinDisabledReason || `${item.isPinned ? 'Unpin' : 'Pin'} ${singularLabel}`}
          aria-disabled={pinBlocked}
          onClick={event => {
            event.stopPropagation();
            if (pinBlocked) return;
            onTogglePin(item);
          }}
        >
          <Icon name='pin' size={16} />
        </IconButton>
      ) : null}
    </div>
  );
}

export function StatisticsMultiSelectDropdown({
  label,
  items,
  selectedIds,
  onChange,
  onTogglePin,
  disabled = false,
  emptyText = 'Select',
  maxVisibleItems = 12,
}) {
  const popover = usePopoverState(disabled);
  const { open } = popover;
  const listRef = useRef(null);
  const anchorIndexRef = useRef(-1);
  const suppressRowClickRef = useRef(false);
  const touchStateRef = useRef(null);
  const latestSelectedSetRef = useRef(new Set());
  const onChangeRef = useRef(onChange);

  const [searchTerm, setSearchTerm] = useState('');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  onChangeRef.current = onChange;
  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  latestSelectedSetRef.current = selectedSet;
  const normalizedSearchTerm = normalizeSearchText(searchTerm);

  const filteredItems = useMemo(() => {
    let nextItems = items || [];

    if (showPinnedOnly) {
      nextItems = nextItems.filter(item => item?.isPinned);
    }

    if (!normalizedSearchTerm) return nextItems;
    return nextItems.filter(item => {
      const haystack = normalizeSearchText(
        `${item?.primary || ''} ${item?.secondary || ''} ${item?.searchText || ''}`,
      );
      return haystack.includes(normalizedSearchTerm);
    });
  }, [items, normalizedSearchTerm, showPinnedOnly]);

  const commitSelection = nextSet => {
    latestSelectedSetRef.current = new Set(nextSet);
    const next = buildOrderedSelection(items || [], nextSet);
    onChangeRef.current?.(next);
  };

  const setSingleSelection = (id, index) => {
    const nextSet = new Set();
    nextSet.add(id);
    commitSelection(nextSet);
    anchorIndexRef.current = index;
  };

  const toggleAdditiveSelection = (id, index) => {
    const nextSet = new Set(selectedSet);
    if (nextSet.has(id)) nextSet.delete(id);
    else nextSet.add(id);
    commitSelection(nextSet);
    anchorIndexRef.current = index;
  };

  const applyRangeSelection = (index, additive) => {
    if (!Number.isInteger(index) || index < 0 || index >= filteredItems.length) return;
    const anchorIndex = anchorIndexRef.current;
    if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= filteredItems.length) {
      const id = filteredItems[index]?.id;
      if (id) setSingleSelection(id, index);
      return;
    }

    const start = Math.min(anchorIndex, index);
    const end = Math.max(anchorIndex, index);
    const rangeIds = filteredItems
      .slice(start, end + 1)
      .map(item => item.id)
      .filter(Boolean);

    const nextSet = additive ? new Set(selectedSet) : new Set();
    rangeIds.forEach(id => nextSet.add(id));
    commitSelection(nextSet);
  };

  const handleItemInteraction = (itemId, index, event, { circleOnlyToggle = false } = {}) => {
    if (!itemId || disabled) return;

    if (suppressRowClickRef.current) {
      suppressRowClickRef.current = false;
      return;
    }

    const isShift = !!event?.shiftKey;
    const isMetaOrCtrl = !!event?.metaKey || !!event?.ctrlKey;

    if (isShift) {
      applyRangeSelection(index, isMetaOrCtrl || circleOnlyToggle);
      anchorIndexRef.current = index;
      return;
    }

    if (circleOnlyToggle || isMetaOrCtrl) {
      toggleAdditiveSelection(itemId, index);
      return;
    }

    setSingleSelection(itemId, index);
  };

  const applyPaintToId = (itemId, shouldSelect) => {
    if (!itemId) return;
    const nextSet = new Set(latestSelectedSetRef.current);
    if (shouldSelect) nextSet.add(itemId);
    else nextSet.delete(itemId);
    commitSelection(nextSet);
  };

  const cleanupTouchState = () => {
    const state = touchStateRef.current;
    if (!state) return;

    if (state.timer) {
      clearTimeout(state.timer);
    }

    const browserWindow = getBrowserWindow();
    if (browserWindow) {
      browserWindow.removeEventListener('pointermove', state.onMove);
      browserWindow.removeEventListener('pointerup', state.onUp);
      browserWindow.removeEventListener('pointercancel', state.onCancel);
    }

    touchStateRef.current = null;
  };

  const beginPaintMode = state => {
    if (!touchStateRef.current || touchStateRef.current.pointerId !== state.pointerId) return;
    touchStateRef.current.active = true;
    touchStateRef.current.timer = null;
    // Apply the start item immediately once long-press mode is confirmed.
    applyPaintToId(state.startItemId, state.paintSelect);
    touchStateRef.current.visitedIds.add(state.startItemId);
    suppressRowClickRef.current = true;
  };

  const handleCirclePointerDown = (event, itemId) => {
    if (disabled || !itemId) return;
    const pointerType = event.pointerType || 'mouse';
    if (pointerType === 'mouse') return;

    const startX = event.clientX;
    const startY = event.clientY;
    const paintSelect = !selectedSet.has(itemId);

    const state = {
      pointerId: event.pointerId,
      startItemId: itemId,
      startX,
      startY,
      paintSelect,
      active: false,
      timer: null,
      visitedIds: new Set(),
      onMove: null,
      onUp: null,
      onCancel: null,
    };

    const onMove = moveEvent => {
      const current = touchStateRef.current;
      if (!current || moveEvent.pointerId !== current.pointerId) return;

      if (!current.active) {
        const dx = moveEvent.clientX - current.startX;
        const dy = moveEvent.clientY - current.startY;
        if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
          cleanupTouchState();
        }
        return;
      }

      const el = getBrowserDocument()?.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      const row = el?.closest?.('[data-stat-multi-item-id]');
      const hitId = row?.getAttribute?.('data-stat-multi-item-id');
      if (!hitId || current.visitedIds.has(hitId)) return;
      current.visitedIds.add(hitId);
      applyPaintToId(hitId, current.paintSelect);
    };

    const endGesture = endEvent => {
      const current = touchStateRef.current;
      if (!current || endEvent.pointerId !== current.pointerId) return;
      if (current.active) suppressRowClickRef.current = true;
      cleanupTouchState();
    };

    state.onMove = onMove;
    state.onUp = endGesture;
    state.onCancel = endGesture;
    // Long-press turns the selection circle into a touch-friendly "paint"
    // gesture so users can sweep across many rows without modifier keys.
    state.timer = getBrowserWindow()?.setTimeout(() => beginPaintMode(state), LONG_PRESS_MS);

    touchStateRef.current = state;

    const browserWindow = getBrowserWindow();
    if (browserWindow) {
      browserWindow.addEventListener('pointermove', onMove, { passive: true });
      browserWindow.addEventListener('pointerup', endGesture, { passive: true });
      browserWindow.addEventListener('pointercancel', endGesture, { passive: true });
    }
  };

  useEffect(() => () => cleanupTouchState(), []);

  useEffect(() => {
    if (open) return;
    // Pinned-only is a transient drill-down inside the open menu, not a
    // persistent filter preference for later openings.
    setShowPinnedOnly(false);
  }, [open]);

  useFocusOnOpen(open, listRef);

  // Prune stale selections when the available items change (e.g. after a source switch).
  // The latest callback is read from a ref so this effect only tracks data changes.
  useEffect(() => {
    const validIds = new Set((items || []).map(item => item.id).filter(Boolean));
    const pruned = (selectedIds || []).filter(id => validIds.has(id));
    if (pruned.length !== (selectedIds || []).length) {
      onChangeRef.current?.(pruned);
    }
  }, [items, selectedIds]);

  const selectedCount = selectedSet.size;
  const triggerText = selectedCount > 0 ? `${label} (${selectedCount})` : emptyText;
  const panelMaxHeight = Math.max(8, Number(maxVisibleItems) || 12) * 36;
  const singularLabel = getSingularLabel(label);
  const lowerLabel = label.toLowerCase();

  return (
    <>
      <button
        ref={popover.anchor}
        type='button'
        data-statistics-multiselect-trigger={lowerLabel}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup='dialog'
        onClick={popover.toggle}
        className='bm-btn min-w-0'
      >
        <span className='truncate'>{triggerText}</span>
        <Icon name='chevron-down' size={18} />
      </button>

      <Popover
        {...FLOATING_PANEL_PROPS}
        open={open}
        onClose={popover.close}
        anchor={popover.anchor}
        label={`Select ${lowerLabel}`}
        width='min(calc(100vw - 24px), 26rem)'
      >
        <div ref={listRef} className='flex min-h-0 flex-col gap-2'>
          <div className='flex items-center gap-2'>
            <Input
              type='search'
              value={searchTerm}
              onInput={e => setSearchTerm(e.target.value)}
              placeholder={`Search ${lowerLabel}`}
              aria-label={`Search ${lowerLabel}`}
              className='an-input--sm'
              data-autofocus
            />
            {onTogglePin ? (
              <IconButton
                pressed={showPinnedOnly}
                label={`${showPinnedOnly ? 'Show all' : 'Show pinned only'} ${lowerLabel}`}
                onClick={() => setShowPinnedOnly(value => !value)}
              >
                <Icon name='pin' size={18} />
              </IconButton>
            ) : null}
          </div>

          <div
            className='an-scroll flex flex-col overflow-y-auto overscroll-contain'
            style={{ maxHeight: `${panelMaxHeight}px` }}
          >
            {filteredItems.length === 0 ? (
              <p className='bm-help px-2 py-3'>
                {showPinnedOnly ? `No pinned ${lowerLabel} found.` : `No ${lowerLabel} found.`}
              </p>
            ) : (
              filteredItems.map((item, index) => {
                const isSelected = selectedSet.has(item.id);
                return (
                  <StatisticsMultiSelectRow
                    key={item.id}
                    item={item}
                    index={index}
                    isSelected={isSelected}
                    singularLabel={singularLabel}
                    onTogglePin={onTogglePin}
                    onRowClick={handleItemInteraction}
                    onCirclePointerDown={handleCirclePointerDown}
                    onCircleClick={(itemId, itemIndex, event) => {
                      event.stopPropagation();
                      handleItemInteraction(itemId, itemIndex, event, {
                        circleOnlyToggle: true,
                      });
                    }}
                  />
                );
              })
            )}
          </div>

          {/* st-keys hides on a touch screen: it carries no layout utility that would undo that */}
          <div className='st-keys'>
            <p className='bm-caption flex items-center justify-between gap-3 px-1'>
              <span>Shift selects a range</span>
              <span>Cmd or Ctrl adds</span>
            </p>
          </div>
          <p className='st-touch-hint bm-caption px-1'>Hold a mark and sweep to select several.</p>
        </div>
      </Popover>
    </>
  );
}
