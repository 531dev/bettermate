import { Chip } from '../../../../components/Chip.jsx';
import { SegmentBar } from '../../../../components/SegmentBar.jsx';
import { Spinner } from '../../../../components/Spinner.jsx';
import { Tile } from '../../../../components/Tile.jsx';
import { useState, useEffect, useRef, useContext, useCallback } from 'preact/hooks';
// Main StatisticsView orchestrator: wires hooks, toolbar, summary cards, and the detail section panel
import { ApiServiceContext } from '../../../../services/ApiService';
import { libraryService } from '../../../ShotAnalyzer/services/LibraryService';
import {
  ANALYZER_DB_KEYS,
  loadFromStorage,
  saveToStorage,
  normalizeCompareTargetDisplayMode,
  getPinnedProfiles,
  getPinnedShotsByProfile,
  toggleProfilePin,
  toggleShotPin,
} from '../../../ShotAnalyzer/utils/analyzerUtils';
import { StatisticsToolbar } from '../StatisticsToolbar';
import { SummaryCards } from '../SummaryCards';
import { normalizeStatisticsSourceSelection } from '../../utils/statisticsRoute';
import {
  getInitialProfileName,
  getStatisticsSelectionHint,
  isStatisticsHotkeyBlockedTarget,
  getStatisticsFallbackSource,
  normalizeStatisticsDetailSection,
} from './helpers';
import {
  useStatisticsMetadataState,
  useStatisticsSelectionModel,
  useStatisticsSelectionSync,
  useStatisticsRunExecution,
  useStatisticsResultViewState,
} from './hooks';
import { StatisticsDetailSectionPanel } from './StatisticsDetailSection';

export function StatisticsView({ initialContext }) {
  const apiService = useContext(ApiServiceContext);
  const initialProfileName = getInitialProfileName(initialContext);

  const [shotSource, setShotSource] = useState(() =>
    normalizeStatisticsSourceSelection(
      initialContext?.shotSource || initialContext?.source,
      'gaggimate',
    ),
  );
  const [profileSource, setProfileSource] = useState(() =>
    normalizeStatisticsSourceSelection(
      initialContext?.profileSource || initialContext?.source,
      'gaggimate',
    ),
  );

  const [mode, setMode] = useState(() => (initialProfileName ? 'profile' : 'all'));

  const [selectedProfileNames, setSelectedProfileNames] = useState(() =>
    initialProfileName ? [initialProfileName] : [],
  );
  const [selectedShotKeys, setSelectedShotKeys] = useState([]);
  const [query, setQuery] = useState('');
  const [dateFromLocal, setDateFromLocal] = useState('');
  const [dateToLocal, setDateToLocal] = useState('');
  const [dateBasisMode, setDateBasisMode] = useState('auto');

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [runRequest, setRunRequest] = useState(null);
  const [preparingRun, setPreparingRun] = useState(false);
  const [statisticsDetailSection, setStatisticsDetailSection] = useState(
    () => normalizeStatisticsDetailSection(initialContext?.preferredDetailSection) || 'metrics',
  );
  const [compareTargetDisplayMode, setCompareTargetDisplayMode] = useState(() =>
    normalizeCompareTargetDisplayMode(
      loadFromStorage(ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE),
    ),
  );
  const [pinnedProfiles, setPinnedProfiles] = useState(() => getPinnedProfiles());
  const [pinnedShotsByProfile, setPinnedShotsByProfile] = useState(() => getPinnedShotsByProfile());

  const analyzeLoadIdRef = useRef(0);
  const prepareRunIdRef = useRef(0);
  const entriesRef = useRef(null);
  const initializedDetailSectionRunIdRef = useRef(null);

  useEffect(() => {
    saveToStorage(
      ANALYZER_DB_KEYS.COMPARE_TARGET_DISPLAY_MODE,
      normalizeCompareTargetDisplayMode(compareTargetDisplayMode),
    );
  }, [compareTargetDisplayMode]);

  const {
    rawShotCandidates,
    rawProfiles,
    metadataLoading,
    metadataLoaded,
    metadataError,
    rawShotKeyOrder,
    shotKeyToCanonicalProfile,
    availableProfiles,
  } = useStatisticsMetadataState({
    apiService,
    shotSource,
    profileSource,
    initialProfileName,
    setSelectedProfileNames,
    setSelectedShotKeys,
  });

  const handleProfilePinToggle = item => {
    const result = toggleProfilePin(item?.id || item?.primary || item);
    if (!result.changed) return;
    setPinnedProfiles(result.pinnedProfiles);
  };

  const handleShotPinToggle = item => {
    const result = toggleShotPin(item?.id || item?.shotMeta, item?.pinBucketKey || '');
    if (!result.changed) return;
    setPinnedShotsByProfile(result.pinnedShotsByProfile);
  };
  const {
    dateBasisWarningState,
    candidateFilterState,
    hasBaseParseErrors,
    selectionScopeShotKeySet,
    visibleProfileIdSet,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
    profileSelectionItems,
    shotSelectionItems,
    displayedProfileSelection,
    dateInputPreviewRange,
    handleProfileSelectionChange,
    handleByProfileShotSelectionChange,
    handleShotSelectionChange,
    handleByShotsProfileSelectionChange,
  } = useStatisticsSelectionModel({
    rawShotCandidates,
    availableProfiles,
    rawShotKeyOrder,
    shotKeyToCanonicalProfile,
    pinnedProfiles,
    pinnedShotsByProfile,
    mode,
    selectedProfileNames,
    setSelectedProfileNames,
    selectedShotKeys,
    setSelectedShotKeys,
    query,
    dateFromLocal,
    dateToLocal,
    dateBasisMode,
  });

  useStatisticsSelectionSync({
    mode,
    metadataLoaded,
    hasBaseParseErrors,
    visibleProfileIdSet,
    shotSource,
    profileSource,
    selectedProfileNames,
    byProfileEligibleShotKeys,
    byProfileEligibleShotKeySet,
    selectionScopeShotKeySet,
    setSelectedProfileNames,
    setSelectedShotKeys,
  });

  useStatisticsRunExecution({
    runRequest,
    analyzeLoadIdRef,
    entriesRef,
    setLoading,
    setError,
    setResult,
    setProgress,
  });

  const isSelectionMissing =
    (mode === 'profile' && selectedProfileNames.length === 0) ||
    (mode === 'shots' && selectedShotKeys.length === 0);
  const selectionHint = getStatisticsSelectionHint({
    mode,
    selectedProfileNames,
    selectedShotKeys,
  });
  const canRunStatistics =
    !loading &&
    !preparingRun &&
    !metadataLoading &&
    !metadataError &&
    candidateFilterState.parseErrors.length === 0 &&
    !isSelectionMissing;

  const handleGo = useCallback(
    ({ preferredDetailSection = null } = {}) => {
      if (!canRunStatistics) {
        return;
      }

      const prepareRunId = ++prepareRunIdRef.current;
      const nextRunId = `${Date.now()}-${prepareRunId}`;
      const fallbackSource = getStatisticsFallbackSource(profileSource);
      const shotSnapshot = [...candidateFilterState.filteredShots];
      const profileSnapshot = [...rawProfiles];
      const orderedShotKeysSnapshot = [...selectedShotKeys];
      setPreparingRun(true);

      async function prepareRunRequest() {
        try {
          let fallbackProfiles = [];
          if (fallbackSource) {
            try {
              fallbackProfiles = await libraryService.getAllProfiles(fallbackSource);
            } catch {
              fallbackProfiles = [];
            }
          }

          if (prepareRunIdRef.current !== prepareRunId) return;

          setRunRequest({
            id: nextRunId,
            shots: shotSnapshot,
            profiles: profileSnapshot,
            fallbackProfiles: Array.isArray(fallbackProfiles) ? fallbackProfiles : [],
            orderedShotKeys: orderedShotKeysSnapshot,
            dateBasisMode,
            mode,
            preferredDetailSection:
              normalizeStatisticsDetailSection(preferredDetailSection) || null,
          });
        } finally {
          if (prepareRunIdRef.current === prepareRunId) {
            setPreparingRun(false);
          }
        }
      }

      prepareRunRequest();
    },
    [
      canRunStatistics,
      profileSource,
      candidateFilterState.filteredShots,
      rawProfiles,
      selectedShotKeys,
      dateBasisMode,
      mode,
    ],
  );

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isStatisticsHotkeyBlockedTarget(event.target)) return;

      const key = String(event.key || '').toLowerCase();
      if (key === 'enter') {
        event.preventDefault();
        handleGo();
        return;
      }

      if (key === 'c') {
        event.preventDefault();
        handleGo({ preferredDetailSection: 'compare' });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleGo]);

  const handleClearFilters = () => {
    setSelectedProfileNames([]);
    setSelectedShotKeys([]);
    setDateFromLocal('');
    setDateToLocal('');
    setQuery('');
    setDateBasisMode('auto');
  };

  const {
    hasProfileGroupStatistics,
    hasPhaseStatistics,
    hasMetricStatistics,
    hasTrendStatistics,
    resolvedStatisticsDetailSection,
    statisticsCompareEntries,
    shouldHidePhaseExitReasons,
    builtShotCount,
    builtProfileCount,
    builtDateRange,
    shouldShowEmptyStatisticsState,
  } = useStatisticsResultViewState({
    result,
    runRequest,
    statisticsDetailSection,
    setStatisticsDetailSection,
    initializedDetailSectionRunIdRef,
    entriesRef,
    preparingRun,
    loading,
    error,
    metadataError,
  });

  const statisticsDetailSectionPanel = (
    <StatisticsDetailSectionPanel
      chartRunKey={runRequest?.id || 'idle'}
      compareEntries={statisticsCompareEntries}
      compareTargetDisplayMode={compareTargetDisplayMode}
      onCompareTargetDisplayModeChange={setCompareTargetDisplayMode}
      hasMetricStatistics={hasMetricStatistics}
      hasTrendStatistics={hasTrendStatistics}
      hasPhaseStatistics={hasPhaseStatistics}
      hasProfileGroupStatistics={hasProfileGroupStatistics}
      resolvedStatisticsDetailSection={resolvedStatisticsDetailSection}
      result={result}
      setStatisticsDetailSection={setStatisticsDetailSection}
      hidePhaseExitReasons={shouldHidePhaseExitReasons}
    />
  );

  return (
    <div className='flex flex-col gap-2 lg:gap-3' data-tool='statistics'>
      <Tile className='z-30 lg:sticky lg:top-3' data-statistics-toolbar-shell>
        <StatisticsToolbar
          shotSource={shotSource}
          onShotSourceChange={setShotSource}
          profileSource={profileSource}
          onProfileSourceChange={setProfileSource}
          mode={mode}
          onModeChange={setMode}
          onGo={handleGo}
          startLoading={preparingRun}
          loading={loading}
          metadataLoading={metadataLoading}
          canGo={canRunStatistics}
          profileSelectionItems={profileSelectionItems}
          selectedProfileNames={displayedProfileSelection}
          onSelectedProfileNamesChange={
            mode === 'shots' ? handleByShotsProfileSelectionChange : handleProfileSelectionChange
          }
          onProfilePinToggle={handleProfilePinToggle}
          shotSelectionItems={shotSelectionItems}
          selectedShotKeys={selectedShotKeys}
          onSelectedShotKeysChange={
            mode === 'profile' ? handleByProfileShotSelectionChange : handleShotSelectionChange
          }
          onShotPinToggle={handleShotPinToggle}
          query={query}
          onQueryChange={setQuery}
          dateFromLocal={dateFromLocal}
          dateFromPreviewLocal={dateInputPreviewRange.fromLocal}
          onDateFromChange={setDateFromLocal}
          dateToLocal={dateToLocal}
          dateToPreviewLocal={dateInputPreviewRange.toLocal}
          onDateToChange={setDateToLocal}
          dateBasisMode={dateBasisMode}
          onDateBasisModeChange={setDateBasisMode}
          showDateBasisWarning={dateBasisWarningState.showDateBasisWarning}
          dateBasisWarningMessage={dateBasisWarningState.dateBasisWarningMessage}
          candidateCount={metadataLoading ? null : candidateFilterState.count}
          parseErrors={candidateFilterState.parseErrors}
          parseWarnings={candidateFilterState.parseWarnings}
          onClearFilters={handleClearFilters}
          metadataError={metadataError}
          selectionHint={selectionHint}
          hasBuiltStatistics={Boolean(result)}
          builtShotCount={builtShotCount}
          builtProfileCount={builtProfileCount}
          builtDateRangeStartMs={builtDateRange.startMs}
          builtDateRangeEndMs={builtDateRange.endMs}
        />
      </Tile>

      {loading && (
        <Tile className='items-center text-center' role='status' data-statistics-progress>
          {progress.total > 0 ? (
            <>
              <p className='bm-label'>
                Analyzing shot {progress.current} of {progress.total}
              </p>
              <SegmentBar className='w-full max-w-xs' value={progress.current / progress.total} />
            </>
          ) : (
            <>
              <Spinner size={8} className='text-(--ink-muted)' />
              <p className='bm-label'>Preparing statistics</p>
            </>
          )}
        </Tile>
      )}

      {error && (
        <div role='alert' className='bm-notice bm-notice--danger'>
          {error}
        </div>
      )}

      {!error && metadataError && (
        <div role='alert' className='bm-notice bm-notice--warning'>
          {metadataError}
        </div>
      )}

      {!loading && result && (
        <>
          <SummaryCards summary={result.summary} />

          {statisticsDetailSectionPanel}

          {result.summary.totalShots === 0 && (
            <Tile className='items-center text-center'>
              <p className='bm-help'>No shots found for the selected filters.</p>
            </Tile>
          )}
        </>
      )}

      {shouldShowEmptyStatisticsState && (
        <Tile className='items-center text-center'>
          <h2 className='bm-heading'>No statistics built yet</h2>
          <p className='bm-help'>Choose what to include above, then build.</p>
          {/* st-keys hides on a touch screen: it carries no layout utility that would undo that */}
          <div className='st-keys'>
            <p className='bm-help flex flex-wrap items-center justify-center gap-x-4 gap-y-2'>
              <span className='inline-flex items-center gap-2'>
                <Chip>Enter</Chip> Build
              </span>
              <span className='inline-flex items-center gap-2'>
                <Chip>C</Chip> Build and show shot charts
              </span>
            </p>
          </div>
        </Tile>
      )}
    </div>
  );
}
