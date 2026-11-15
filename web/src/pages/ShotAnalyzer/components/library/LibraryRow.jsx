/**
 * LibraryRow.jsx
 * One shot or profile of the library: a press loads it; pin and its menu sit at the end.
 */

import { cx } from '../../../../components/cx.js';
import { Spinner } from '../../../../components/Spinner.jsx';
import { cleanName, formatTimestamp, getProfileDisplayLabel } from '../../utils/analyzerUtils';
import { buildStatisticsProfileHref } from '../../../Statistics/utils/statisticsRoute';
import { Icon } from '../../../../components/Icon.jsx';
import { IconButton } from '../../../../components/IconButton.jsx';
import { ShotBadge } from '../../ui/ShotBadge.jsx';
import { SourceMarker } from '../SourceMarker';
import { LibraryActionsMenu } from './LibraryActionsMenu';

function getLibraryDisplayName(item, itemName, isShot) {
  if (!isShot) return itemName.replace(/\.json$/i, '');
  if (item.source === 'gaggimate') return `#${item.id || itemName}`;
  return cleanName(item.name || item.storageKey || item.id || itemName);
}

function stopRowClick(event) {
  event.stopPropagation();
}

function splitLibraryDateTime(value) {
  return value.includes(', ') ? value.split(', ') : [value, ''];
}

/**
 * What a row is to the analyzer, drawn at its start: the shot or profile in use is an ink disc
 * (its ShotBadge in a comparison), one that goes with what is loaded is a ring, one that is
 * loading is the spinner.
 */
function LibraryRowMark({ compareBadgeNumber, isActive, isComparePending, isMatch }) {
  if (isComparePending) return <Spinner size={4} className='text-(--ink-muted)' />;
  if (compareBadgeNumber) return <ShotBadge number={compareBadgeNumber} />;
  if (isActive) return <i className='an-lib__dot' title='Loaded' />;
  if (isMatch)
    return <i className='an-lib__dot an-lib__dot--match' title='Matches what is loaded' />;
  return null;
}

function LibraryPinButton({ item, isPinned, pinDisabledReason, onPinToggle, displayName, isShot }) {
  if (!onPinToggle) return null;
  const pinBlocked = !isPinned && !!pinDisabledReason;

  return (
    <IconButton
      size='sm'
      pressed={isPinned}
      label={`${isPinned ? 'Unpin' : 'Pin'} ${displayName}`}
      title={pinDisabledReason || `${isPinned ? 'Unpin' : 'Pin'} ${isShot ? 'shot' : 'profile'}`}
      aria-disabled={pinBlocked}
      onClick={event => {
        stopRowClick(event);
        if (pinBlocked) return;
        onPinToggle(item);
      }}
    >
      <Icon name='pin' size={16} />
    </IconButton>
  );
}

function LibraryActionsCell({ isShot, item, profileStatsHref, onShowStats, onExport, onDelete }) {
  const actions = [
    ...(!isShot
      ? [
          {
            label: 'Profile statistics',
            icon: 'chart-column',
            href: profileStatsHref || '/statistics',
            onSelect: () => onShowStats?.(item),
          },
        ]
      : []),
    {
      label: 'Export',
      icon: 'download',
      onSelect: () => onExport(item),
    },
    {
      label: 'Delete',
      icon: 'trash-2',
      tone: 'error',
      onSelect: () => onDelete(item),
    },
  ];

  return (
    <LibraryActionsMenu
      actions={actions}
      ariaLabel={`Open ${isShot ? 'shot' : 'profile'} actions menu`}
    />
  );
}

export function LibraryRow({
  item,
  compareBadgeNumber = null,
  isMatch,
  isCompareRelated = false,
  isActive,
  isShot,
  isCompareSelected = false,
  isComparePending = false,
  onShowStats,
  onLoad,
  onExport,
  onDelete,
  isPinned = false,
  pinDisabledReason = '',
  onPinToggle,
}) {
  const itemName = isShot ? item.name || item.label || 'Unknown' : getProfileDisplayLabel(item);
  const displayName = getLibraryDisplayName(item, itemName, isShot);

  // Format Date & Time
  const dateStr = formatTimestamp(item.timestamp || item.shotDate);
  const [datePart, timePart] = splitLibraryDateTime(dateStr);
  const profileStatsHref = isShot
    ? null
    : buildStatisticsProfileHref({
        source: item.source,
        profileName: getProfileDisplayLabel(item, ''),
      });

  const isCompareHighlight = isCompareSelected || isCompareRelated;
  const isCurrent = Boolean(isActive || isCompareHighlight);

  return (
    <li
      className={cx(
        'an-lib__row an-press',
        isShot ? 'an-lib__grid--shot' : 'an-lib__grid--profile',
      )}
      aria-current={isCurrent ? 'true' : undefined}
      data-library-row={isShot ? 'shot' : 'profile'}
      onClick={onLoad}
    >
      <span className='an-lib__mark'>
        <LibraryRowMark
          compareBadgeNumber={compareBadgeNumber}
          isActive={isActive}
          isComparePending={isComparePending}
          isMatch={isMatch || isCompareHighlight}
        />
      </span>
      <button
        type='button'
        className='an-lib__name'
        onClick={event => {
          stopRowClick(event);
          onLoad();
        }}
        title={displayName}
      >
        {displayName}
      </button>
      <span className='an-lib__pin'>
        <LibraryPinButton
          item={item}
          isPinned={isPinned}
          pinDisabledReason={pinDisabledReason}
          onPinToggle={onPinToggle}
          displayName={displayName}
          isShot={isShot}
        />
      </span>
      <span className='an-lib__source'>
        <SourceMarker source={item.source} variant='library' />
      </span>
      {isShot ? (
        <span className='an-lib__date'>
          <span className='an-data block truncate'>{datePart}</span>
          <span className='bm-data block truncate'>{timePart}</span>
        </span>
      ) : null}
      {isShot ? (
        <span className='an-lib__profile'>{item.profileName || item.profile || '—'}</span>
      ) : null}
      <span className='an-lib__actions'>
        <LibraryActionsCell
          isShot={isShot}
          item={item}
          profileStatsHref={profileStatsHref}
          onShowStats={onShowStats}
          onExport={onExport}
          onDelete={onDelete}
        />
      </span>
    </li>
  );
}
