import { Icon } from '../../../../../components/Icon.jsx';
import { Fragment } from 'preact';
import { COMPARE_TARGET_DISPLAY_MODES } from '../../../utils/analyzerUtils';
import {
  ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS,
  getAnalyzerIconButtonClasses,
  getAnalyzerSurfaceTriggerClasses,
  getAnalyzerTextButtonClasses,
} from '../../analyzerControlStyles';

function CompareShotLegend({ compareShotLegendItems, onCompareSwap }) {
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2.5'>
      {compareShotLegendItems.map((item, index) => (
        <Fragment key={item.label}>
          <div className='inline-flex min-w-0 items-center gap-1 text-xs font-normal text-[var(--ink-muted)]'>
            <span
              className={[
                'analyzer-compare-shot-badge inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-xs leading-none font-semibold tabular-nums',
                item.shotNumber === 2 ? 'analyzer-compare-shot-badge--striped' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--analyzer-compare-shot-color': item.badgeColor || item.color }}
              aria-label={`Shot ${item.shotNumber || ''}`}
            >
              {item.shotNumber}
            </span>
            <span className='truncate'>{item.label}</span>
          </div>
          {index === 0 && compareShotLegendItems.length > 1 && onCompareSwap ? (
            <button
              type='button'
              onClick={onCompareSwap}
              className={getAnalyzerIconButtonClasses({
                className: 'h-7 min-h-0 w-7 rounded-lg p-0 text-sm',
              })}
              title='Swap shot 1 and shot 2'
              aria-label='Swap shot 1 and shot 2'
            >
              <Icon name={'refresh-cw'} className='text-sm' />
            </button>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

function CompareAnnotationToggle({
  compareAnnotationsEnabled,
  onCompareAnnotationsToggle,
  showCompareAnnotationToggle,
}) {
  if (showCompareAnnotationToggle && onCompareAnnotationsToggle) {
    return (
      <button
        type='button'
        onClick={onCompareAnnotationsToggle}
        className={getAnalyzerTextButtonClasses({
          className: `h-6 min-h-0 px-2 text-xs font-medium ${
            compareAnnotationsEnabled
              ? 'bg-base-content/8 text-base-content/80'
              : 'text-[var(--ink-muted)]'
          }`,
        })}
        aria-pressed={compareAnnotationsEnabled}
        title={compareAnnotationsEnabled ? 'Hide compare annotations' : 'Show compare annotations'}
      >
        Annotations
      </button>
    );
  }

  return null;
}

export function CompareSelect({ onChange, options, title, value, widthClass }) {
  if (onChange && options.length > 0) {
    return (
      <div className={`relative flex ${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} items-center`}>
        <select
          value={value}
          onChange={event => onChange(event.currentTarget.value)}
          className={getAnalyzerSurfaceTriggerClasses({
            className: `${ANALYZER_COMPACT_CONTROL_HEIGHT_CLASS} ${widthClass} appearance-none rounded-md border-0 bg-transparent px-2.5 pr-6 text-xs font-medium outline-none`,
          })}
          title={title}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className='pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-[var(--ink-muted)]'>
          <Icon name={'chevron-down'} />
        </span>
      </div>
    );
  }

  return null;
}

export function CompareTargetSelect({
  compareTargetDisplayMode,
  onCompareTargetDisplayModeChange,
}) {
  return (
    <CompareSelect
      onChange={onCompareTargetDisplayModeChange}
      options={[
        { value: COMPARE_TARGET_DISPLAY_MODES.NONE, label: 'No Targets' },
        { value: COMPARE_TARGET_DISPLAY_MODES.PER_SHOT, label: 'Per Shot' },
        { value: COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY, label: 'Main Shot' },
      ]}
      title='Target display mode'
      value={compareTargetDisplayMode}
      widthClass='w-[7rem] max-w-[7rem]'
    />
  );
}

export function CompareControlsRow({
  compareAlignmentMode,
  compareAlignmentOptions,
  compareAnnotationsEnabled,
  compareShotLegendItems,
  compareTargetDisplayMode,
  onCompareAlignmentModeChange,
  onCompareAnnotationsToggle,
  onCompareSwap,
  onCompareTargetDisplayModeChange,
  shouldShowCompareControls,
  showCompareAnnotationToggle,
}) {
  if (shouldShowCompareControls) {
    return (
      <div className='mt-2 mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1'>
        <CompareShotLegend
          compareShotLegendItems={compareShotLegendItems}
          onCompareSwap={onCompareSwap}
        />

        <div className='flex items-center gap-2'>
          <CompareAnnotationToggle
            compareAnnotationsEnabled={compareAnnotationsEnabled}
            onCompareAnnotationsToggle={onCompareAnnotationsToggle}
            showCompareAnnotationToggle={showCompareAnnotationToggle}
          />

          <CompareSelect
            onChange={onCompareAlignmentModeChange}
            options={compareAlignmentOptions}
            title='Compare alignment'
            value={compareAlignmentMode}
            widthClass='w-[9rem] max-w-[9rem]'
          />

          <CompareTargetSelect
            compareTargetDisplayMode={compareTargetDisplayMode}
            onCompareTargetDisplayModeChange={onCompareTargetDisplayModeChange}
          />
        </div>
      </div>
    );
  }

  return null;
}
