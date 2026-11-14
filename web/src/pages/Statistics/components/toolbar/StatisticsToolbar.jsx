// StatisticsToolbar: the mode, selection, source, date and search controls of a statistics run.
// Once statistics are built it folds into one summary row and unfolds on demand.
import { useState, useRef } from 'preact/hooks';
import '../../statistics.css';
import { SOURCE_OPTIONS } from './constants';
import {
  formatCountLabel,
  formatCollapsedDateRangeText,
  getDateRangeDisplay,
  getCandidateSummary,
  getToolbarMessages,
  isToolbarControlTarget,
} from './helpers';
import {
  useAdvancedSearchSync,
  useDslPreviewOutsideDismiss,
  useToolbarCollapseBehavior,
} from './hooks';
import {
  ToolbarBusyOverlay,
  CollapsedToolbarStrip,
  ExpandedToolbarControls,
  DateBasisWarning,
  ToolbarNotice,
  SelectionHint,
  DslSelectionPreview,
} from './subcomponents';

export function StatisticsToolbar({
  shotSource,
  onShotSourceChange,
  profileSource,
  onProfileSourceChange,
  mode,
  onModeChange,
  onGo,
  startLoading = false,
  loading = false,
  metadataLoading = false,
  canGo = true,
  profileSelectionItems,
  selectedProfileNames,
  onSelectedProfileNamesChange,
  onProfilePinToggle,
  shotSelectionItems,
  selectedShotKeys,
  onSelectedShotKeysChange,
  onShotPinToggle,
  query,
  onQueryChange,
  dateFromLocal,
  dateFromPreviewLocal = '',
  onDateFromChange,
  dateToLocal,
  dateToPreviewLocal = '',
  onDateToChange,
  dateBasisMode,
  onDateBasisModeChange,
  showDateBasisWarning = false,
  dateBasisWarningMessage = null,
  candidateCount,
  parseErrors = [],
  parseWarnings = [],
  onClearFilters,
  metadataError = null,
  selectionHint = null,
  hasBuiltStatistics = false,
  builtShotCount = 0,
  builtProfileCount = 0,
  builtDateRangeStartMs = null,
  builtDateRangeEndMs = null,
}) {
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(() => !!query);
  const [showDslSelectionPreview, setShowDslSelectionPreview] = useState(
    () => !!String(query || '').trim(),
  );
  const dslInputRef = useRef(null);
  const toolbarContainerRef = useRef(null);
  const [isCollapsedStripExpanded, setIsCollapsedStripExpanded] = useState(false);

  const isBusy = startLoading || loading || metadataLoading;
  const showBusyOverlay = startLoading || metadataLoading;
  const canExecute = canGo && !isBusy;
  const { topError, noticeMessage, noticeTone, moreCount } = getToolbarMessages({
    parseErrors,
    parseWarnings,
  });
  const dateRangeDisplay = getDateRangeDisplay({
    dateFromLocal,
    dateToLocal,
    dateFromPreviewLocal,
    dateToPreviewLocal,
  });
  const showDateRangeLabelInTrigger = !dateRangeDisplay.isAuto;
  const { candidateLabel, candidateTitle, resetAriaCount } = getCandidateSummary({
    metadataLoading,
    candidateCount,
  });
  const currentShotSourceOption =
    SOURCE_OPTIONS.find(opt => opt.value === shotSource) || SOURCE_OPTIONS[0];
  const currentProfileSourceOption =
    SOURCE_OPTIONS.find(opt => opt.value === profileSource) || SOURCE_OPTIONS[0];
  const hasDslQuery = !!String(query || '').trim();
  const shotSelectionItemMap = new Map((shotSelectionItems || []).map(item => [item.id, item]));
  const selectedShotPreviewItems = (selectedShotKeys || [])
    .map(id => shotSelectionItemMap.get(id))
    .filter(Boolean);
  const selectedProfilePreviewItems = (selectedProfileNames || [])
    .filter(Boolean)
    .map(name => ({ id: name, primary: name }));
  const profilePreviewItems =
    selectedProfilePreviewItems.length > 0
      ? selectedProfilePreviewItems
      : (profileSelectionItems || []).map(item => ({
          id: item.id,
          primary: item.primary || item.id,
        }));
  const shotPreviewItems =
    selectedShotPreviewItems.length > 0 ? selectedShotPreviewItems : shotSelectionItems || [];
  const shouldShowDslSelectionPreview =
    showAdvancedSearch &&
    hasDslQuery &&
    showDslSelectionPreview &&
    (profilePreviewItems.length > 0 || shotPreviewItems.length > 0);
  const shouldCollapseToolbar = Boolean(hasBuiltStatistics);
  const isToolbarExpanded = !shouldCollapseToolbar || isCollapsedStripExpanded;
  const shouldShowSelectionHint = topError || metadataError ? false : isToolbarExpanded;
  const collapsedShotCountLabel = formatCountLabel(builtShotCount, 'shot', 'shots');
  const collapsedProfileCountLabel = formatCountLabel(builtProfileCount, 'profile', 'profiles');
  const collapsedDateRangeText = formatCollapsedDateRangeText(
    builtDateRangeStartMs,
    builtDateRangeEndMs,
  );

  useAdvancedSearchSync({
    query,
    parseErrorsLength: parseErrors.length,
    parseWarningsLength: parseWarnings.length,
    showAdvancedSearch,
    setShowAdvancedSearch,
    setShowDslSelectionPreview,
  });
  useDslPreviewOutsideDismiss({
    shouldShowDslSelectionPreview,
    isToolbarExpanded,
    dslInputRef,
    setShowDslSelectionPreview,
  });
  useToolbarCollapseBehavior({
    isToolbarExpanded,
    shouldCollapseToolbar,
    isCollapsedStripExpanded,
    toolbarContainerRef,
    setShowDslSelectionPreview,
    setIsCollapsedStripExpanded,
  });

  // An unfolded toolbar folds again on a press on its empty ground.
  const handleGroundClick = event => {
    if (!shouldCollapseToolbar || !isCollapsedStripExpanded) return;
    if (isToolbarControlTarget(event.target)) return;
    setIsCollapsedStripExpanded(false);
  };

  return (
    <div
      ref={toolbarContainerRef}
      className='st-toolbar relative flex w-full min-w-0 flex-col gap-2'
      onClick={handleGroundClick}
    >
      <ToolbarBusyOverlay visible={showBusyOverlay} />
      {shouldCollapseToolbar && !isToolbarExpanded ? (
        <CollapsedToolbarStrip
          collapsedShotCountLabel={collapsedShotCountLabel}
          collapsedProfileCountLabel={collapsedProfileCountLabel}
          collapsedDateRangeText={collapsedDateRangeText}
          onExpand={() => setIsCollapsedStripExpanded(true)}
        />
      ) : (
        <ExpandedToolbarControls
          mode={mode}
          onModeChange={onModeChange}
          isBusy={isBusy}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={selectedProfileNames}
          onSelectedProfileNamesChange={onSelectedProfileNamesChange}
          onProfilePinToggle={onProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={onSelectedShotKeysChange}
          onShotPinToggle={onShotPinToggle}
          onClearFilters={onClearFilters}
          resetAriaCount={resetAriaCount}
          candidateLabel={candidateLabel}
          candidateTitle={candidateTitle}
          onGo={onGo}
          canExecute={canExecute}
          setShowDslSelectionPreview={setShowDslSelectionPreview}
          currentShotSourceOption={currentShotSourceOption}
          currentProfileSourceOption={currentProfileSourceOption}
          shotSource={shotSource}
          onShotSourceChange={onShotSourceChange}
          profileSource={profileSource}
          onProfileSourceChange={onProfileSourceChange}
          showDateRangeLabelInTrigger={showDateRangeLabelInTrigger}
          dateRangeDisplay={dateRangeDisplay}
          dateFromLocal={dateFromLocal}
          onDateFromChange={onDateFromChange}
          dateToLocal={dateToLocal}
          onDateToChange={onDateToChange}
          showAdvancedSearch={showAdvancedSearch}
          setShowAdvancedSearch={setShowAdvancedSearch}
          dslInputRef={dslInputRef}
          query={query}
          onQueryChange={onQueryChange}
        />
      )}

      <DateBasisWarning
        visible={isToolbarExpanded && showDateBasisWarning}
        dateBasisWarningMessage={dateBasisWarningMessage}
        dateBasisMode={dateBasisMode}
        onDateBasisModeChange={onDateBasisModeChange}
        isBusy={isBusy}
      />

      <ToolbarNotice
        visible={isToolbarExpanded}
        noticeMessage={noticeMessage}
        noticeTone={noticeTone}
        moreCount={moreCount}
      />

      <SelectionHint visible={shouldShowSelectionHint} selectionHint={selectionHint} />

      <DslSelectionPreview
        visible={isToolbarExpanded && shouldShowDslSelectionPreview}
        profilePreviewItems={profilePreviewItems}
        shotPreviewItems={shotPreviewItems}
      />
    </div>
  );
}
