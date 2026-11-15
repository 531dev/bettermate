/** Coordinates analyzer navigation, import actions, status hints, and loading state. */

/* global globalThis */

import { useCallback, useEffect, useRef } from 'preact/hooks';
import { cx } from '../../../../components/cx.js';
import { Icon } from '../../../../components/Icon.jsx';
import { SegmentBar } from '../../../../components/SegmentBar.jsx';
import { getShotNotesKey } from '../useShotNotesState';
import {
  ActionBarCompareButton,
  ActionBarImportActions,
  ActionBarNavigationButtons,
  ActionBarStatisticsAction,
} from './ActionBarButtons';
import { ModeHint, useAnalyzerActionBarModeHint } from './ActionBarModeHint';
import { MobileStatusActionsMenu } from './MobileStatusActionsMenu';
import {
  getAnalyzerActionBarDisplayState,
  getAnalyzerActionBarNavigationState,
  isTypingTarget,
} from './actionBarState';
import { useAnalyzerActionBarLoadIndicator } from './useActionBarLoadIndicator';

export function AnalyzerActionBar({
  currentShot,
  selectedShot = null,
  shotList = [],
  onNavigate,
  onCompareModeToggle,
  compareAvailable = false,
  compareMode = false,
  showCompareButton = true,
  onShowStats,
  statsHref = '/statistics',
  statisticsAvailable = true,
  onImport,
  isImporting = false,
  importMode = 'temp',
  onImportModeChange,
  isSelectionPending = false,
  isProfilePending = false,
  showImportModeToggle = true,
  enableKeyboardNavigation = true,
  isFileDragActive = false,
  dropzoneProps,
}) {
  const fileInputRef = useRef(null);
  const desktopModeAnchorRef = useRef(null);
  const mobileModeAnchorRef = useRef(null);
  const { hint, hintAnchor, changeMode, closeHint } = useAnalyzerActionBarModeHint({
    onImportModeChange,
  });

  const { displayShot, hasDisplayShot } = getAnalyzerActionBarDisplayState({
    currentShot,
    selectedShot,
  });
  const { loadIndicatorVisible, loadIndicatorProgress } = useAnalyzerActionBarLoadIndicator({
    isSelectionPending,
    isProfilePending,
  });

  const handleNavigateToIndex = useCallback(
    (targetIndex, direction) => {
      if (targetIndex < 0 || targetIndex >= shotList.length) return;
      onNavigate?.({
        item: shotList[targetIndex],
        direction,
        listSnapshot: shotList,
        targetIndex,
        debounceMs: 0,
      });
    },
    [onNavigate, shotList],
  );

  // Navigation
  const { currentIndex, canGoPrev, canGoNext } = getAnalyzerActionBarNavigationState({
    hasShot: hasDisplayShot,
    shotList,
    activeShot: displayShot,
    getShotNotesKey,
  });

  // Keyboard navigation: ArrowLeft / ArrowRight
  useEffect(() => {
    if (!displayShot || !enableKeyboardNavigation) return;

    const handleKeyDown = e => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === 'ArrowLeft' && canGoPrev) {
        e.preventDefault();
        handleNavigateToIndex(currentIndex - 1, -1);
      } else if (e.key === 'ArrowRight' && canGoNext) {
        e.preventDefault();
        handleNavigateToIndex(currentIndex + 1, 1);
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [
    displayShot,
    canGoPrev,
    canGoNext,
    currentIndex,
    handleNavigateToIndex,
    enableKeyboardNavigation,
  ]);

  const handleImportClick = () => {
    if (isImporting) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = event => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      onImport?.(files);
      event.target.value = '';
    }
  };

  return (
    <div className='an-libbar__foot' {...dropzoneProps}>
      <div className={cx('an-libbar__actions', isFileDragActive && 'invisible')}>
        <ActionBarNavigationButtons
          canGoPrev={canGoPrev}
          canGoNext={canGoNext}
          currentIndex={currentIndex}
          onNavigateToIndex={handleNavigateToIndex}
        />

        {showCompareButton ? (
          <ActionBarCompareButton
            compareAvailable={compareAvailable}
            compareMode={compareMode}
            onCompareModeToggle={onCompareModeToggle}
          />
        ) : null}

        <ActionBarStatisticsAction
          compareMode={compareMode}
          statisticsAvailable={statisticsAvailable}
          statsHref={statsHref}
          onShowStats={onShowStats}
        />

        <MobileStatusActionsMenu
          anchorRef={mobileModeAnchorRef}
          onImportClick={handleImportClick}
          onImportModeChange={mode => changeMode(mode, mobileModeAnchorRef.current)}
          importMode={importMode}
          isImporting={isImporting}
          showImportModeToggle={showImportModeToggle}
        />

        <ActionBarImportActions
          onImportClick={handleImportClick}
          onImportModeChange={mode => changeMode(mode, desktopModeAnchorRef.current)}
          importMode={importMode}
          isImporting={isImporting}
          modeAnchorRef={desktopModeAnchorRef}
          showImportModeToggle={showImportModeToggle}
        />

        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept='.slog,.json'
          onChange={handleFileSelect}
          className='hidden'
          disabled={isImporting}
        />
      </div>

      {isFileDragActive && (
        <p className='an-libbar__drop bm-label'>
          <Icon name='upload' size={18} />
          Drop shot or profile files to open them
        </p>
      )}

      {loadIndicatorVisible && (
        <div className='an-libbar__load'>
          <SegmentBar total={24} value={loadIndicatorProgress} label='Loading the shot' />
        </div>
      )}

      <ModeHint hint={hint} anchor={hintAnchor} onClose={closeHint} />
    </div>
  );
}
