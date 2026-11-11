import { Icon } from '../../../components/Icon.jsx';
import { useEffect, useRef, useState } from 'preact/hooks';
import PropTypes from 'prop-types';
import {
  metricsColumnsSignal,
  metricsLastRowFillSignal,
  METRICS_LAST_ROW_FILLS,
} from '../../../utils/dashboardManager.js';

function AdjBtn({ icon, onClick, visible, disabled, label }) {
  if (!visible) return null;
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-label={`${icon === 'minus' ? 'Decrease' : 'Increase'} ${label.toLowerCase()} target`}
      className='btn btn-outline flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] p-0'
    >
      <Icon name={icon} className='h-2.5 w-2.5' />
    </button>
  );
}

function MetricCell({
  label,
  current,
  target,
  unit,
  onDecrease,
  onIncrease,
  adjustable,
  disabled = false,
  inCard = false,
  compact = false,
}) {
  const showAdj = adjustable;
  return (
    <div
      className={`flex flex-col items-center justify-between rounded-xl ${compact ? 'gap-1 p-2' : 'gap-2 p-3'} ${inCard ? 'bg-[var(--surface-2)]' : 'card bg-base-100'}`}
    >
      <div className='flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.1em] text-[var(--ink-muted)] uppercase'>
        <span
          className='h-1.5 w-1.5 rounded-full'
          style={{
            background: label.toLowerCase().includes('temp')
              ? 'var(--series-temperature)'
              : label.toLowerCase().includes('pressure')
                ? 'var(--series-pressure)'
                : label.toLowerCase().includes('flow')
                  ? 'var(--series-flow)'
                  : 'var(--series-weight)',
          }}
        />
        {label}
      </div>
      <div className='flex w-full items-center justify-between'>
        {showAdj && (
          <AdjBtn
            icon={'minus'}
            label={label}
            onClick={onDecrease}
            visible={showAdj}
            disabled={disabled}
          />
        )}
        <div className='flex-1 text-center font-mono tabular-nums'>
          <span
            className={`text-base-content block ${compact ? 'text-[18px] font-normal' : 'text-[24px] font-light'}`}
          >
            {current}
          </span>
          {target != null && (
            <span className='block'>
              <span className='mr-1 text-xs text-[var(--ink-muted)]'>Target</span>
              <span className='text-[13px] font-medium text-[var(--ink-muted)]'>
                {target}
                {unit}
              </span>
            </span>
          )}
        </div>
        {showAdj && (
          <AdjBtn
            icon={'plus'}
            label={label}
            onClick={onIncrease}
            visible={showAdj}
            disabled={disabled}
          />
        )}
      </div>
    </div>
  );
}

function MetricCellItem({ m, inCard, compact }) {
  return (
    <MetricCell
      label={m.label}
      current={m.current}
      target={m.target}
      unit={m.unit}
      adjustable={m.adjustable}
      disabled={m.disabled}
      onDecrease={m.onDecrease}
      onIncrease={m.onIncrease}
      inCard={inCard}
      compact={compact}
    />
  );
}

export function MetricsGrid({ metrics = [], inCard = false, compact = false }) {
  const containerRef = useRef(null);
  const userCols = metricsColumnsSignal.value;
  const lastRowFill = metricsLastRowFillSignal.value;
  const [effectiveCols, setEffectiveCols] = useState(userCols);
  const minCellWidth = metrics.some(m => m.adjustable) ? 200 : compact ? 100 : 160;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const initialWidth = el.getBoundingClientRect().width;
    setEffectiveCols(Math.max(1, Math.min(userCols, Math.floor(initialWidth / minCellWidth))));
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setEffectiveCols(Math.max(1, Math.min(userCols, Math.floor(width / minCellWidth))));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [userCols, minCellWidth]);

  const gap = compact ? 'gap-1' : 'gap-2';
  const remainder = metrics.length % effectiveCols;
  const fullRows = remainder === 0 ? metrics : metrics.slice(0, -remainder);
  const lastRow = remainder === 0 ? [] : metrics.slice(-remainder);

  return (
    <div ref={containerRef}>
      <div
        className={`grid ${gap}`}
        style={{ gridTemplateColumns: `repeat(${effectiveCols}, 1fr)` }}
      >
        {fullRows.map(m => (
          <MetricCellItem key={m.id} m={m} inCard={inCard} compact={compact} />
        ))}
      </div>
      {lastRow.length > 0 &&
        (lastRowFill === METRICS_LAST_ROW_FILLS.EVEN ? (
          <div className={`flex ${gap} ${compact ? 'mt-1' : 'mt-2'}`}>
            {lastRow.map(m => (
              <div key={m.id} style={{ flex: 1 }}>
                <MetricCellItem m={m} inCard={inCard} compact={compact} />
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`grid ${gap} ${compact ? 'mt-1' : 'mt-2'}`}
            style={{ gridTemplateColumns: `repeat(${effectiveCols}, 1fr)` }}
          >
            {lastRow.map(m => (
              <MetricCellItem key={m.id} m={m} inCard={inCard} compact={compact} />
            ))}
          </div>
        ))}
    </div>
  );
}

MetricsGrid.propTypes = {
  metrics: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      current: PropTypes.string,
      target: PropTypes.string,
      unit: PropTypes.string,
      adjustable: PropTypes.bool,
      disabled: PropTypes.bool,
      onDecrease: PropTypes.func,
      onIncrease: PropTypes.func,
    }),
  ).isRequired,
  inCard: PropTypes.bool,
  compact: PropTypes.bool,
};
