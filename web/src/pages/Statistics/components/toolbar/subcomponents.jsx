// Render-only parts of StatisticsToolbar: the folded summary row, the mode choice, the source and
// date popovers, the search row and the notices under the controls.
import { Button } from '../../../../components/Button.jsx';
import { Chip } from '../../../../components/Chip.jsx';
import { cx } from '../../../../components/cx.js';
import { Field, Input, Switch } from '../../../../components/Field.jsx';
import { Icon } from '../../../../components/Icon.jsx';
import { Segmented } from '../../../../components/Segmented.jsx';
import { Spinner } from '../../../../components/Spinner.jsx';
import { SourceMarker } from '../../../ShotAnalyzer/components/SourceMarker';
import { Popover } from '../../../ShotAnalyzer/ui/Popover.jsx';
import { StatisticsSearchHelp } from '../StatisticsSearchHelp';
import { StatisticsMultiSelectDropdown } from '../StatisticsMultiSelectDropdown';
import {
  SOURCE_OPTIONS,
  MODE_OPTIONS,
  DATE_BASIS_OPTIONS,
  TOOLBAR_FLOATING_PANEL_ATTR,
} from './constants';
import { getDateBasisOptionTitle } from './helpers';
import { usePopoverState } from './hooks';

const FLOATING_PANEL_PROPS = { [TOOLBAR_FLOATING_PANEL_ATTR]: '' };

const SOURCE_SEGMENT_OPTIONS = SOURCE_OPTIONS.map(option => ({
  value: option.value,
  label: option.label,
  icon: { gaggimate: 'coffee', browser: 'monitor' }[option.value],
}));

function SourceSummaryMarks({ option }) {
  if (!option) return null;
  if (option.value === 'both') {
    return (
      <span className='inline-flex items-center gap-1'>
        <SourceMarker source='gaggimate' variant='compact' />
        <SourceMarker source='browser' variant='compact' />
      </span>
    );
  }
  return <SourceMarker source={option.value} variant='compact' />;
}

export function ToolbarBusyOverlay({ visible }) {
  if (!visible) return null;

  return (
    <div className='pointer-events-none absolute inset-0 z-30 flex items-center justify-center'>
      <Spinner size={8} className='text-(--ink-muted)' />
    </div>
  );
}

export function CollapsedToolbarStrip({
  collapsedShotCountLabel,
  collapsedProfileCountLabel,
  collapsedDateRangeText,
  onExpand,
}) {
  return (
    <button
      type='button'
      onClick={onExpand}
      className='an-press flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left'
      aria-expanded='false'
      aria-label='Expand statistics toolbar'
      title='Expand statistics toolbar'
    >
      <span className='bm-data flex min-w-0 flex-1 items-center gap-2 overflow-hidden'>
        <span className='shrink-0'>{collapsedShotCountLabel}</span>
        <span className='shrink-0' aria-hidden='true'>
          ·
        </span>
        <span className='shrink-0'>{collapsedProfileCountLabel}</span>
        <span className='shrink-0' aria-hidden='true'>
          ·
        </span>
        <span className='min-w-0 truncate'>{collapsedDateRangeText}</span>
      </span>
      <Icon name='chevron-down' size={18} className='text-(--ink-muted)' />
    </button>
  );
}

export function SelectionDropdowns({
  mode,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  isBusy,
}) {
  const profileDropdown = (
    <StatisticsMultiSelectDropdown
      label='Profiles'
      items={profileSelectionItems}
      selectedIds={selectedProfileNames}
      onChange={onSelectedProfileNamesChange}
      onTogglePin={onProfilePinToggle}
      disabled={isBusy}
      emptyText='Select profiles'
    />
  );
  const shotDropdown = (
    <StatisticsMultiSelectDropdown
      label='Shots'
      items={shotSelectionItems}
      selectedIds={selectedShotKeys}
      onChange={onSelectedShotKeysChange}
      onTogglePin={onShotPinToggle}
      disabled={isBusy}
      emptyText='Select shots'
    />
  );

  if (mode === 'profile') {
    return (
      <>
        {profileDropdown}
        {shotDropdown}
      </>
    );
  }

  if (mode === 'shots') {
    return (
      <>
        {shotDropdown}
        {profileDropdown}
      </>
    );
  }

  return null;
}

export function SourceSelectionDropdown({
  currentShotSourceOption,
  currentProfileSourceOption,
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  isBusy,
}) {
  const popover = usePopoverState(isBusy);
  const sourceGroups = [
    { label: 'Shots', value: shotSource, onChange: onShotSourceChange },
    { label: 'Profiles', value: profileSource, onChange: onProfileSourceChange },
  ];

  return (
    <>
      <button
        ref={popover.anchor}
        type='button'
        className='bm-btn bm-btn--sm min-w-0'
        aria-label='Select shot and profile sources'
        title='Select shot and profile sources'
        aria-haspopup='dialog'
        aria-expanded={popover.open}
        disabled={isBusy}
        onClick={popover.toggle}
      >
        <SourceSummaryMarks option={currentShotSourceOption} />
        <span>Shots</span>
        <span className='text-(--ink-muted)' aria-hidden='true'>
          ·
        </span>
        <SourceSummaryMarks option={currentProfileSourceOption} />
        <span>Profiles</span>
        <Icon name='chevron-down' size={18} />
      </button>

      <Popover
        {...FLOATING_PANEL_PROPS}
        open={popover.open}
        onClose={popover.close}
        anchor={popover.anchor}
        label='Shot and profile sources'
      >
        {sourceGroups.map(group => (
          <Field key={group.label} as='div' label={group.label}>
            <Segmented
              block
              onTile
              label={`${group.label} source`}
              options={SOURCE_SEGMENT_OPTIONS}
              value={group.value}
              onChange={group.onChange}
              disabled={isBusy}
            />
          </Field>
        ))}
      </Popover>
    </>
  );
}

export function DateRangeDropdown({
  showDateRangeLabelInTrigger,
  dateRangeDisplay,
  dateFromLocal,
  onDateFromChange,
  dateToLocal,
  onDateToChange,
  isBusy,
}) {
  const popover = usePopoverState(isBusy);
  const dateModeText = dateRangeDisplay.isAuto
    ? 'The range follows the shots in the selection.'
    : 'A date filter is set.';

  return (
    <>
      <button
        ref={popover.anchor}
        type='button'
        className='bm-btn bm-btn--sm min-w-0'
        aria-label='Edit date range filter'
        title='Edit date range filter'
        aria-haspopup='dialog'
        aria-expanded={popover.open}
        disabled={isBusy}
        onClick={popover.toggle}
      >
        <Icon name='history' size={18} />
        {showDateRangeLabelInTrigger && <span className='shrink-0'>{dateRangeDisplay.label}</span>}
        <span className='min-w-0 truncate'>
          {dateRangeDisplay.fromText || 'No dates'}
          {dateRangeDisplay.toText && ` – ${dateRangeDisplay.toText}`}
        </span>
        <Icon name='chevron-down' size={18} />
      </button>

      <Popover
        {...FLOATING_PANEL_PROPS}
        open={popover.open}
        onClose={popover.close}
        anchor={popover.anchor}
        label='Date range'
        width='min(calc(100vw - 24px), 20rem)'
      >
        <Field label='From'>
          <Input
            type='date'
            value={dateFromLocal}
            onInput={event => onDateFromChange(event.target.value)}
            className='st-date'
            disabled={isBusy}
            aria-label='Start date'
            data-autofocus
          />
        </Field>
        <Field label='To'>
          <Input
            type='date'
            value={dateToLocal}
            onInput={event => onDateToChange(event.target.value)}
            className='st-date'
            disabled={isBusy}
            aria-label='End date'
          />
        </Field>
        <p className='bm-help'>{dateModeText}</p>
        <Button
          size='sm'
          variant='outline'
          className='self-start'
          onClick={() => {
            onDateFromChange('');
            onDateToChange('');
          }}
          disabled={isBusy || (!dateFromLocal && !dateToLocal)}
          title='Clear date filter'
        >
          Clear dates
        </Button>
      </Popover>
    </>
  );
}

export function AdvancedSearchControls({
  showAdvancedSearch,
  setShowAdvancedSearch,
  setShowDslSelectionPreview,
  dslInputRef,
  query,
  onQueryChange,
  isBusy,
}) {
  return (
    <div
      className={cx(
        'flex min-w-0 items-center gap-2',
        showAdvancedSearch ? 'basis-full sm:flex-1 sm:basis-auto' : 'ml-auto',
      )}
    >
      {showAdvancedSearch && (
        <div ref={dslInputRef} className='min-w-0 flex-1'>
          <Input
            type='text'
            value={query}
            onInput={event => {
              setShowDslSelectionPreview(!!String(event.target.value || '').trim());
              onQueryChange(event.target.value);
            }}
            onFocus={() => setShowDslSelectionPreview(true)}
            onClick={() => setShowDslSelectionPreview(true)}
            placeholder='name:"325"; profile:3_0_25; date:>h-7d;'
            className='st-query an-input--sm'
            aria-label='Search query'
            autocomplete='off'
            autocapitalize='off'
            spellcheck={false}
            disabled={isBusy}
          />
        </div>
      )}

      {showAdvancedSearch && <StatisticsSearchHelp />}

      <label className='an-label flex shrink-0 cursor-pointer items-center gap-2'>
        <Switch
          checked={showAdvancedSearch}
          disabled={isBusy}
          label='Toggle advanced search'
          title='Toggle advanced search'
          onChange={next => {
            setShowAdvancedSearch(next);
            if (!next) setShowDslSelectionPreview(false);
          }}
        />
        <span aria-hidden='true'>Advanced</span>
      </label>
    </div>
  );
}

export function ExpandedToolbarControls({
  mode,
  onModeChange,
  isBusy,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  onClearFilters,
  resetAriaCount,
  candidateLabel,
  candidateTitle,
  onGo,
  canExecute,
  setShowDslSelectionPreview,
  currentShotSourceOption,
  currentProfileSourceOption,
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  showDateRangeLabelInTrigger,
  dateRangeDisplay,
  dateFromLocal,
  onDateFromChange,
  dateToLocal,
  onDateToChange,
  showAdvancedSearch,
  setShowAdvancedSearch,
  dslInputRef,
  query,
  onQueryChange,
}) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex w-full min-w-0 flex-wrap items-center gap-2'>
        <Segmented
          className='st-toolbar__mode max-sm:basis-full'
          label='Statistics mode'
          options={MODE_OPTIONS}
          value={mode}
          onChange={onModeChange}
          disabled={isBusy}
        />

        <SelectionDropdowns
          mode={mode}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={selectedProfileNames}
          onSelectedProfileNamesChange={onSelectedProfileNamesChange}
          onProfilePinToggle={onProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={onSelectedShotKeysChange}
          onShotPinToggle={onShotPinToggle}
          isBusy={isBusy}
        />

        <div className='ml-auto flex items-center gap-2'>
          <Chip title={candidateTitle} data-statistics-candidates>
            {candidateLabel}
          </Chip>
          <Button
            iconOnly
            onClick={onClearFilters}
            disabled={isBusy}
            aria-label={`Clear filters and selections (${resetAriaCount})`}
            title={`Clear filters and selections (${resetAriaCount})`}
          >
            <Icon name='refresh-cw' size={20} />
          </Button>
          <Button
            variant='ink'
            onClick={() => {
              setShowDslSelectionPreview(false);
              onGo();
            }}
            disabled={!canExecute}
            aria-label='Build statistics'
            title='Build statistics'
            data-statistics-run
          >
            <Icon name='play' size={18} />
            Build
          </Button>
        </div>
      </div>

      <div className='flex w-full min-w-0 flex-wrap items-center gap-2'>
        <SourceSelectionDropdown
          currentShotSourceOption={currentShotSourceOption}
          currentProfileSourceOption={currentProfileSourceOption}
          shotSource={shotSource}
          onShotSourceChange={onShotSourceChange}
          profileSource={profileSource}
          onProfileSourceChange={onProfileSourceChange}
          isBusy={isBusy}
        />

        <DateRangeDropdown
          showDateRangeLabelInTrigger={showDateRangeLabelInTrigger}
          dateRangeDisplay={dateRangeDisplay}
          dateFromLocal={dateFromLocal}
          onDateFromChange={onDateFromChange}
          dateToLocal={dateToLocal}
          onDateToChange={onDateToChange}
          isBusy={isBusy}
        />

        <AdvancedSearchControls
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          setShowDslSelectionPreview={setShowDslSelectionPreview}
          dslInputRef={dslInputRef}
          query={query}
          onQueryChange={onQueryChange}
          isBusy={isBusy}
        />
      </div>
    </div>
  );
}

export function DateBasisWarning({
  visible,
  dateBasisWarningMessage,
  dateBasisMode,
  onDateBasisModeChange,
  isBusy,
}) {
  if (!visible) return null;

  return (
    <div className='bm-notice bm-notice--warning flex-wrap items-center'>
      <p className='min-w-56 flex-1'>
        <span className='font-semibold'>Date basis.</span>{' '}
        {dateBasisWarningMessage ||
          'Some shots have no shot timestamp. Choose how date handling should treat them.'}{' '}
        {getDateBasisOptionTitle(dateBasisMode)}.
      </p>
      <Segmented
        onTile
        label='Date basis'
        options={DATE_BASIS_OPTIONS}
        value={dateBasisMode}
        onChange={onDateBasisModeChange}
        disabled={isBusy}
      />
    </div>
  );
}

export function ToolbarNotice({ visible, noticeMessage, noticeTone, moreCount }) {
  if (!visible || !noticeMessage) return null;

  return (
    <div
      role={noticeTone === 'error' ? 'alert' : 'status'}
      className={cx(
        'bm-notice',
        noticeTone === 'error' ? 'bm-notice--danger' : 'bm-notice--warning',
      )}
    >
      <Icon name={noticeTone === 'error' ? 'circle-alert' : 'triangle-alert'} size={18} />
      <span className='min-w-0 flex-1'>
        {noticeMessage}
        {moreCount > 0 && ` (${moreCount} more)`}
      </span>
    </div>
  );
}

export function SelectionHint({ visible, selectionHint }) {
  if (!visible || !selectionHint) return null;

  return <p className='bm-help px-1'>{selectionHint}</p>;
}

export function DslSelectionPreview({ visible, profilePreviewItems, shotPreviewItems }) {
  if (!visible) return null;

  return (
    <div className='bm-cell flex w-full min-w-0 flex-col gap-3'>
      {profilePreviewItems.length > 0 && (
        <div className='flex min-w-0 flex-col gap-2'>
          <span className='bm-eyebrow'>Profiles ({profilePreviewItems.length})</span>
          <div className='an-scroll flex max-h-24 flex-wrap gap-1.5 overflow-auto'>
            {profilePreviewItems.map(item => (
              <Chip key={item.id} className='st-chip--plain'>
                {item.primary}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {shotPreviewItems.length > 0 && (
        <div className='flex min-w-0 flex-col gap-2'>
          <span className='bm-eyebrow'>Shots ({shotPreviewItems.length})</span>
          <ul className='an-scroll max-h-40 overflow-auto'>
            {shotPreviewItems.map(item => (
              <li
                key={item.id}
                className='flex min-w-0 flex-col border-t border-(--line) py-2 first:border-t-0'
              >
                <span className='an-label truncate'>{item.fileStem || item.primary}</span>
                {(item.shotId || item.secondary) && (
                  <span className='bm-data truncate'>
                    {item.shotId ? `ID ${item.shotId}` : ''}
                    {item.shotId && item.secondary ? ' · ' : ''}
                    {item.secondary || ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
