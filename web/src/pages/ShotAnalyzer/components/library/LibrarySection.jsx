/**
 * LibrarySection.jsx
 * One list of the library (shots or profiles) with its search, sort and source filter.
 */

import { cx } from '../../../../components/cx.js';
import { Input, Select } from '../../../../components/Field.jsx';
import { Icon } from '../../../../components/Icon.jsx';
import { Segmented } from '../../../../components/Segmented.jsx';
import { Spinner } from '../../../../components/Spinner.jsx';
import { Cell } from '../../../../components/Tile.jsx';
import { getShotIdentityKey } from '../../utils/analyzerUtils';
import { IconButton } from '../../ui/IconButton.jsx';
import { PinIcon } from '../../ui/PinIcon.jsx';
import { LibraryRow } from './LibraryRow';
import { LibraryActionsMenu } from './LibraryActionsMenu';
import './LibrarySection.css';

function getLibraryItemKey(item, isShot) {
  if (!item) return 'unknown-item';

  if (isShot) {
    if (item.source === 'gaggimate') return `gaggimate-shot:${String(item.id || '')}`;
    return `browser-shot:${String(item.storageKey || item.name || item.id || '')}`;
  }

  if (item.source === 'gaggimate') {
    return `gaggimate-profile:${String(
      item.profileId ||
        item.id ||
        item.label ||
        item.name ||
        item.fileName ||
        item.exportName ||
        '',
    )}`;
  }

  return `browser-profile:${String(
    item.label || item.name || item.fileName || item.exportName || item.id || '',
  )}`;
}

const SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'gaggimate', label: 'Machine', icon: 'coffee' },
  { value: 'browser', label: 'Browser', icon: 'monitor' },
];

/** A column head that sorts by its column: the chevron shows the direction while it is the key. */
function SortHead({ label, column, sortKey, sortOrder, onSortChange, className }) {
  const isActive = sortKey === column;
  return (
    <button
      type='button'
      className={cx('an-lib__sort', className)}
      aria-pressed={isActive}
      title={`Sort by ${label.toLowerCase()}`}
      onClick={() => onSortChange(column)}
    >
      {label}
      {isActive && <Icon name={sortOrder === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />}
    </button>
  );
}

function getLibraryCompareState({
  item,
  isShot,
  compareSelectionKeys,
  comparePendingKeys,
  compareReferenceKey,
  getCompareStatus,
  getCompareBadgeNumber,
}) {
  const compareKey = isShot ? getShotIdentityKey(item) : '';
  const isCompareSelected = isShot && compareSelectionKeys.has(compareKey);
  const isComparePending = isShot && comparePendingKeys.includes(compareKey);
  const isCompareReference = isShot && compareKey === compareReferenceKey;

  return {
    isCompareSelected,
    isComparePending,
    isCompareReference,
    isCompareSelectionDisabled: isComparePending || isCompareReference,
    isCompareRelated: Boolean(getCompareStatus?.(item)),
    compareBadgeNumber: getCompareBadgeNumber?.(item) || null,
  };
}

export function LibrarySection({
  title,
  items,
  isShot,
  sectionHeight,
  searchValue,
  sortKey,
  sortOrder,
  sourceFilter,
  onSearchChange,
  onSortChange,
  onSourceFilterChange,
  onLoad,
  onExport,
  onDelete,
  onExportAll,
  onDeleteAll,
  compareSelectionKeys = new Set(),
  comparePendingKeys = [],
  compareReferenceKey = '',
  onShowStats,
  getMatchStatus,
  getCompareStatus,
  getCompareBadgeNumber,
  getActiveStatus,
  getPinStatus,
  getPinDisabledReason,
  onPinToggle,
  pinnedFirstEnabled = false,
  onPinnedFirstToggle,
  isLoading,
}) {
  const lowerTitle = title.toLowerCase();
  const gridClass = isShot ? 'an-lib__grid--shot' : 'an-lib__grid--profile';

  return (
    <Cell
      className='an-lib__section'
      style={sectionHeight ? { height: sectionHeight } : undefined}
      data-library-section={isShot ? 'shots' : 'profiles'}
    >
      <div className='flex items-center gap-2'>
        <h3 className='bm-sub flex min-w-0 flex-1 items-center gap-2'>
          {title} <span className='bm-data'>{items.length}</span>
        </h3>
        <Select
          value={`${sortKey}-${sortOrder}`}
          aria-label={`Sort ${lowerTitle}`}
          onChange={e => {
            const [k, o] = e.target.value.split('-');
            onSortChange(k, o);
          }}
          className='an-lib__field an-input--sm shrink-0'
        >
          {isShot && <option value='shotDate-desc'>Newest first</option>}
          {isShot && <option value='shotDate-asc'>Oldest first</option>}
          <option value='name-asc'>Name A to Z</option>
          <option value='name-desc'>Name Z to A</option>
          {isShot && <option value='data.rating-desc'>Highest rating</option>}
          {isShot && <option value='data.rating-asc'>Lowest rating</option>}
          {isShot && <option value='duration-desc'>Longest</option>}
          {isShot && <option value='duration-asc'>Shortest</option>}
        </Select>
        <LibraryActionsMenu
          ariaLabel={`Open ${lowerTitle} actions menu`}
          actions={[
            { label: 'Export all', icon: 'download', onSelect: onExportAll },
            { label: 'Delete all', icon: 'trash-2', tone: 'error', onSelect: onDeleteAll },
          ]}
        />
      </div>

      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <Input
          type='search'
          placeholder={`Search ${lowerTitle}`}
          aria-label={`Search ${lowerTitle}`}
          value={searchValue}
          onInput={e => onSearchChange(e.target.value)}
          className='an-lib__field an-input--sm min-w-40 flex-1 max-sm:basis-full'
        />
        <Segmented
          onTile
          className='an-seg--sm'
          label={`Source of the ${lowerTitle}`}
          options={SOURCE_FILTER_OPTIONS}
          value={sourceFilter}
          onChange={onSourceFilterChange}
        />
      </div>

      <div className='an-lib__list an-scroll'>
        {isLoading && (
          <div className='absolute inset-0 z-20 grid place-items-center bg-(--surface-2)'>
            <Spinner size={12} className='text-(--ink-muted)' />
          </div>
        )}

        <div className={cx('an-lib__head', gridClass)}>
          <span className='an-lib__mark' aria-hidden='true' />
          <SortHead
            label='Name'
            column='name'
            sortKey={sortKey}
            sortOrder={sortOrder}
            onSortChange={onSortChange}
          />
          <span className='an-lib__pin'>
            {onPinnedFirstToggle ? (
              <IconButton
                size='sm'
                pressed={pinnedFirstEnabled}
                label={`Show pinned ${lowerTitle} first`}
                onClick={event => {
                  event.stopPropagation();
                  // Header pinning is a view-level promotion toggle; it
                  // does not mutate the pinned items themselves.
                  onPinnedFirstToggle();
                }}
              >
                <PinIcon size={16} />
              </IconButton>
            ) : null}
          </span>
          <span className='an-lib__source' aria-hidden='true' />
          {isShot ? (
            <SortHead
              label='Date'
              column='shotDate'
              sortKey={sortKey}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
              className='an-lib__date'
            />
          ) : null}
          {isShot ? <span className='an-lib__profile bm-eyebrow'>Profile</span> : null}
          <span className='an-lib__actions' aria-hidden='true' />
        </div>

        {items.length === 0 && !isLoading ? (
          <p className='bm-help px-2 py-6 text-center'>No {lowerTitle} here.</p>
        ) : (
          <ul className='an-lib__rows'>
            {items.map(item => {
              const { isCompareSelected, isComparePending, isCompareRelated, compareBadgeNumber } =
                getLibraryCompareState({
                  item,
                  isShot,
                  compareSelectionKeys,
                  comparePendingKeys,
                  compareReferenceKey,
                  getCompareStatus,
                  getCompareBadgeNumber,
                });

              return (
                <LibraryRow
                  key={getLibraryItemKey(item, isShot)}
                  item={item}
                  isShot={isShot}
                  compareBadgeNumber={compareBadgeNumber}
                  isMatch={getMatchStatus(item)}
                  isCompareRelated={isCompareRelated}
                  isActive={getActiveStatus ? getActiveStatus(item) : false}
                  isCompareSelected={isCompareSelected}
                  isComparePending={isComparePending}
                  onShowStats={onShowStats}
                  onLoad={() => onLoad(item)}
                  onExport={onExport}
                  onDelete={onDelete}
                  isPinned={Boolean(getPinStatus?.(item))}
                  pinDisabledReason={getPinDisabledReason?.(item) || ''}
                  onPinToggle={onPinToggle}
                />
              );
            })}
          </ul>
        )}
      </div>
    </Cell>
  );
}
