import { Icon } from '../../../../components/Icon.jsx';
import { analyzerUiColors } from '../../utils/analyzerUtils';

export function ActionBarNavigationButtons({
  navButtonClasses,
  canGoPrev,
  canGoNext,
  currentIndex,
  onNavigateToIndex,
}) {
  return (
    <div className='flex shrink-0 items-center gap-1'>
      <button
        type='button'
        className={navButtonClasses}
        disabled={!canGoPrev}
        onClick={() => canGoPrev && onNavigateToIndex(currentIndex - 1, -1)}
        title='Previous shot'
      >
        <Icon name={'chevron-left'} />
      </button>

      <button
        type='button'
        className={navButtonClasses}
        disabled={!canGoNext}
        onClick={() => canGoNext && onNavigateToIndex(currentIndex + 1, 1)}
        title='Next shot'
      >
        <Icon name={'chevron-right'} />
      </button>
    </div>
  );
}

export function ActionBarCompareButton({
  actionButtonClasses,
  compareAvailable,
  compareMode,
  onCompareModeToggle,
}) {
  return (
    <button
      type='button'
      className={`${actionButtonClasses} ${compareMode ? 'text-primary opacity-100' : ''}`}
      disabled={!compareAvailable}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onCompareModeToggle?.();
      }}
      title={compareMode ? 'Disable compare mode' : 'Enable compare mode'}
    >
      <Icon name={'sliders-horizontal'} className='text-sm' />
      <span>Compare</span>
    </button>
  );
}

export function ActionBarStatisticsAction({
  actionButtonClasses,
  compareMode,
  statisticsAvailable,
  statsHref,
  onShowStats,
}) {
  const statisticsIcon = compareMode ? 'chart-column' : 'chart-column';
  const content = (
    <>
      <Icon name={statisticsIcon} className='text-sm' />
      <span>{compareMode ? 'Multi-Compare' : 'Profile Stats'}</span>
    </>
  );

  if (statisticsAvailable) {
    return (
      <a
        href={statsHref || '/statistics'}
        className={actionButtonClasses}
        onClick={event => {
          event.stopPropagation();
          onShowStats?.();
        }}
        title='Open statistics'
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type='button'
      className={actionButtonClasses}
      disabled
      title='Load a profile to open statistics'
    >
      {content}
    </button>
  );
}

function ActionBarImportModeToggle({
  actionButtonClasses,
  importMode,
  modeButtonRef,
  handleModeToggle,
}) {
  const isBrowserImportMode = importMode === 'browser';

  return (
    <button
      ref={modeButtonRef}
      type='button'
      className={`${actionButtonClasses} ${isBrowserImportMode ? 'opacity-100' : ''}`}
      style={isBrowserImportMode ? { color: analyzerUiColors.sourceBadgeWebText } : undefined}
      onClick={handleModeToggle}
      title={
        isBrowserImportMode
          ? 'Save to Browser. Click to switch imports to View temporarily.'
          : 'View temporarily. Click to switch imports to Save to Browser.'
      }
      aria-label={
        isBrowserImportMode
          ? 'Switch import mode to View temporarily'
          : 'Switch import mode to Save to Browser'
      }
    >
      <Icon name={isBrowserImportMode ? 'monitor' : 'search'} className='text-sm' />
      <span>{isBrowserImportMode ? 'Save' : 'View'}</span>
    </button>
  );
}

export function ActionBarImportActions({
  actionButtonClasses,
  handleImportClick,
  handleModeToggle,
  importMode,
  isImporting,
  modeButtonRef,
  showImportModeToggle,
}) {
  return (
    <div className='hidden shrink-0 items-center gap-1 sm:ml-auto sm:flex'>
      <button
        type='button'
        className={actionButtonClasses}
        onClick={handleImportClick}
        disabled={isImporting}
        title='Import shot or profile'
        aria-label={isImporting ? 'Importing shot or profile' : 'Import shot or profile'}
      >
        <Icon name={isImporting ? 'refresh-cw' : 'plus'} spin={isImporting} className='text-sm' />
        <span>Import</span>
      </button>

      {showImportModeToggle ? (
        <ActionBarImportModeToggle
          actionButtonClasses={actionButtonClasses}
          importMode={importMode}
          modeButtonRef={modeButtonRef}
          handleModeToggle={handleModeToggle}
        />
      ) : null}
    </div>
  );
}
