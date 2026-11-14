/** The table's header row, its scroll buttons, and the chips that speak about the whole shot. */

import { useRef, useState } from 'preact/hooks';
import { cx } from '../../../../components/cx.js';
import { Icon } from '../../../../components/Icon.jsx';
import { IconButton } from '../../ui/IconButton.jsx';
import { Popover } from '../../ui/Popover.jsx';
import { getAnalyzerColumnVisual } from './analyzerGroupVisuals';
import { getAnalysisHeaderLabel } from './analysisTableModel';

const SCROLL_STEP = 240;

/** A table wider than its tile is moved by the column: to either end, or a step at a time. */
export function AnalysisTableToolbarActions({ onScrollTable, onScrollToBound }) {
  return (
    <div className='hidden shrink-0 items-center sm:flex'>
      <IconButton
        icon='arrow-left'
        label='Scroll to the first column'
        onClick={() => onScrollToBound('start')}
      />
      <IconButton
        icon='chevron-left'
        label='Scroll left'
        onClick={() => onScrollTable(-SCROLL_STEP)}
      />
      <IconButton
        icon='chevron-right'
        label='Scroll right'
        onClick={() => onScrollTable(SCROLL_STEP)}
      />
      <IconButton
        icon='arrow-right'
        label='Scroll to the last column'
        onClick={() => onScrollToBound('end')}
      />
    </div>
  );
}

export function AnalysisTableHeader({ compareMode, hasProfilePhaseStops, visibleColumns }) {
  return (
    <thead>
      <tr>
        {compareMode ? <th>Shot</th> : <th className='an-table__index'>#</th>}
        <th>
          Phase
          {hasProfilePhaseStops && <span className='an-table__subhead'>Stop reason</span>}
        </th>
        {visibleColumns.map(col => {
          const columnVisual = getAnalyzerColumnVisual(col);
          return (
            <th key={col.id} className='text-right'>
              <span className='an-table__colhead'>
                <Icon name={columnVisual.icon} size={14} style={{ color: columnVisual.color }} />
                <span>{getAnalysisHeaderLabel(col)}</span>
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/**
 * Something the analysis has to say about the whole shot: a chip that opens its explanation.
 *   tone  'warning' when the numbers are in doubt; none for a hint
 */
export function StatusBadge({ label, tone, details }) {
  const anchor = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        ref={anchor}
        type='button'
        className={cx('bm-chip an-chipbtn', tone && `bm-chip--${tone}`)}
        aria-expanded={isOpen}
        aria-haspopup='dialog'
        onClick={() => setIsOpen(current => !current)}
      >
        {label}
        <Icon name='info' size={14} />
      </button>
      <Popover
        open={isOpen && Boolean(details)}
        onClose={() => setIsOpen(false)}
        anchor={anchor}
        label={label}
        width='min(22rem, calc(100vw - 24px))'
        className='an-table__note'
      >
        <span className='an-label'>{label}</span>
        <span className='bm-help'>{details}</span>
      </Popover>
    </>
  );
}
