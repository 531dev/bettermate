import { Fragment } from 'preact';
import { Button } from '../../../../../components/Button.jsx';
import { cx } from '../../../../../components/cx.js';
import { Select } from '../../../../../components/Field.jsx';
import { COMPARE_TARGET_DISPLAY_MODES } from '../../../utils/analyzerUtils';
import { IconButton } from '../../../ui/IconButton.jsx';
import { ShotBadge } from '../../../ui/ShotBadge.jsx';

// Which shot is which: the badge of each shot with its name, and the swap between the two.
function CompareShotLegend({ compareShotLegendItems, onCompareSwap }) {
  return (
    <div className='flex min-w-0 flex-wrap items-center gap-2'>
      {compareShotLegendItems.map((item, index) => (
        <Fragment key={item.label}>
          <div className='shot-chart-compare-shot'>
            <ShotBadge number={item.shotNumber} />
            <span className='truncate'>{item.label}</span>
          </div>
          {index === 0 && compareShotLegendItems.length > 1 && onCompareSwap ? (
            <IconButton
              icon='refresh-cw'
              label='Swap shot 1 and shot 2'
              size='sm'
              onClick={onCompareSwap}
            />
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
      <Button
        size='sm'
        variant={compareAnnotationsEnabled ? 'ink' : undefined}
        aria-pressed={compareAnnotationsEnabled}
        onClick={onCompareAnnotationsToggle}
        title={compareAnnotationsEnabled ? 'Hide compare annotations' : 'Show compare annotations'}
      >
        Annotations
      </Button>
    );
  }

  return null;
}

/** A small select of the compare toolbar: how the shots align, which targets show. */
export function CompareSelect({ onChange, options, title, value, widthClass }) {
  if (onChange && options.length > 0) {
    return (
      <Select
        className={cx('an-input--sm', widthClass)}
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
        title={title}
        aria-label={title}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
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
        { value: COMPARE_TARGET_DISPLAY_MODES.NONE, label: 'No targets' },
        { value: COMPARE_TARGET_DISPLAY_MODES.PER_SHOT, label: 'Per shot' },
        { value: COMPARE_TARGET_DISPLAY_MODES.MAIN_SHOT_ONLY, label: 'Main shot' },
      ]}
      title='Target display mode'
      value={compareTargetDisplayMode}
      widthClass='w-36'
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
      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
        <CompareShotLegend
          compareShotLegendItems={compareShotLegendItems}
          onCompareSwap={onCompareSwap}
        />

        <div className='flex flex-wrap items-center gap-2'>
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
            widthClass='w-44'
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
