import { Button } from '../../../../components/Button.jsx';
import { Icon } from '../../../../components/Icon.jsx';
import { Segmented } from '../../../../components/Segmented.jsx';
import { Spinner } from '../../../../components/Spinner.jsx';
import { IconButton } from '../../ui/IconButton.jsx';

export const IMPORT_MODE_OPTIONS = [
  { value: 'temp', label: 'View' },
  { value: 'browser', label: 'Save' },
];

export function ActionBarNavigationButtons({
  canGoPrev,
  canGoNext,
  currentIndex,
  onNavigateToIndex,
}) {
  return (
    <div className='flex shrink-0 items-center'>
      <IconButton
        icon='chevron-left'
        label='Previous shot'
        disabled={!canGoPrev}
        onClick={() => canGoPrev && onNavigateToIndex(currentIndex - 1, -1)}
      />
      <IconButton
        icon='chevron-right'
        label='Next shot'
        disabled={!canGoNext}
        onClick={() => canGoNext && onNavigateToIndex(currentIndex + 1, 1)}
      />
    </div>
  );
}

export function ActionBarCompareButton({ compareAvailable, compareMode, onCompareModeToggle }) {
  return (
    <Button
      size='sm'
      variant={compareMode ? 'ink' : undefined}
      aria-pressed={compareMode}
      disabled={!compareAvailable}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onCompareModeToggle?.();
      }}
      title={compareMode ? 'Disable compare mode' : 'Enable compare mode'}
      data-analyzer-compare
    >
      <Icon name='sliders-horizontal' size={18} />
      Compare
    </Button>
  );
}

export function ActionBarStatisticsAction({
  compareMode,
  statisticsAvailable,
  statsHref,
  onShowStats,
}) {
  const content = (
    <>
      <Icon name='chart-column' size={18} />
      {compareMode ? 'Multi-compare' : 'Profile stats'}
    </>
  );

  if (statisticsAvailable) {
    return (
      <Button
        size='sm'
        href={statsHref || '/statistics'}
        onClick={event => {
          event.stopPropagation();
          onShowStats?.();
        }}
        title='Open statistics'
      >
        {content}
      </Button>
    );
  }

  return (
    <Button size='sm' disabled title='Load a profile to open statistics'>
      {content}
    </Button>
  );
}

/** Import, and what an import does: open the file for now, or keep it in the browser library. */
export function ActionBarImportActions({
  onImportClick,
  onImportModeChange,
  importMode,
  isImporting,
  modeAnchorRef,
  showImportModeToggle,
}) {
  return (
    <div className='ml-auto hidden shrink-0 items-center gap-2 sm:flex'>
      {showImportModeToggle ? (
        <span ref={modeAnchorRef} className='inline-flex'>
          <Segmented
            className='an-seg--sm'
            label='What an import does: view the file temporarily, or save it to the browser'
            options={IMPORT_MODE_OPTIONS}
            value={importMode === 'browser' ? 'browser' : 'temp'}
            onChange={onImportModeChange}
          />
        </span>
      ) : null}
      <Button
        size='sm'
        onClick={onImportClick}
        disabled={isImporting}
        title='Import shot or profile'
        aria-label={isImporting ? 'Importing shot or profile' : 'Import shot or profile'}
        data-analyzer-import
      >
        {isImporting ? <Spinner size={4} /> : <Icon name='plus' size={18} />}
        {isImporting ? 'Importing' : 'Import'}
      </Button>
    </div>
  );
}
