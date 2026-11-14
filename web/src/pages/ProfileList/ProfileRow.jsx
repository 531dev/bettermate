import { useCallback, useState } from 'preact/hooks';
import { Button } from '../../components/Button.jsx';
import { Chip } from '../../components/Chip.jsx';
import { cx } from '../../components/cx.js';
import { ExtendedProfileChart } from '../../components/ExtendedProfileChart.jsx';
import { Icon } from '../../components/Icon.jsx';
import { ListRow } from '../../components/ListRow.jsx';
import { Menu, MenuItem } from '../../components/Menu.jsx';
import { Cell } from '../../components/Tile.jsx';
import { Tooltip } from '../../components/Tooltip.jsx';
import { downloadJson } from '../../utils/download.js';
import { buildStatisticsProfileHref } from '../Statistics/utils/statisticsRoute.js';
import { ConfirmMenuItem } from './ConfirmMenuItem.jsx';

const PhaseLabels = {
  preinfusion: 'Pre-infusion',
  brew: 'Brew',
};

/**
 * One profile of the list: the row, its menu and, once opened from the menu, its details. A tap
 * on the row selects the profile. The wrapper is the item SortableJS moves.
 */
export function ProfileRow({
  data,
  onDelete,
  onSelect,
  onFavorite,
  onUnfavorite,
  onDuplicate,
  favoriteDisabled,
  unfavoriteDisabled,
  disabledDrag,
  isDragging,
  onMoveTop,
  onMoveBottom,
  isFirst,
  isLast,
}) {
  const [tooltipsDisabled, setTooltipsDisabled] = useState(false);

  const handleMoveTop = useCallback(() => {
    setTooltipsDisabled(true);
    onMoveTop(data.id);
    setTimeout(() => setTooltipsDisabled(false), 500);
  }, [onMoveTop, data.id]);

  const handleMoveBottom = useCallback(() => {
    setTooltipsDisabled(true);
    onMoveBottom(data.id);
    setTimeout(() => setTooltipsDisabled(false), 500);
  }, [onMoveBottom, data.id]);

  const favoriteToggleDisabled = data.favorite ? unfavoriteDisabled : favoriteDisabled;

  const onFavoriteToggle = useCallback(() => {
    if (data.favorite && !unfavoriteDisabled) onUnfavorite(data.id);
    else if (!data.favorite && !favoriteDisabled) onFavorite(data.id);
  }, [data.favorite, unfavoriteDisabled, favoriteDisabled, onUnfavorite, onFavorite, data.id]);

  const onDownload = useCallback(() => {
    const download = {
      ...data,
    };
    delete download.id;
    delete download.selected;
    delete download.favorite;

    downloadJson(download, `profile-${data.id}.json`);
  }, [data]);
  const statsHref = buildStatisticsProfileHref({ source: 'gaggimate', profileName: data.label });

  const [detailsCollapsed, setDetailsCollapsed] = useState(true);
  const onToggleDetails = useCallback(() => setDetailsCollapsed(v => !v), []);
  const detailsSectionId = `profile-${data.id}-summary`;

  const phases = Array.isArray(data?.phases) ? data.phases : [];

  // Sum total duration from phases (in seconds)
  const totalDurationSeconds = phases.reduce(
    (sum, p) => sum + (Number.isFinite(p?.duration) ? p.duration : 0),
    0,
  );
  const weightOut = phases
    .flatMap(p => p.targets || [])
    .filter(t => t.type === 'volumetric')
    .at(-1)?.value;
  const several = phases.length > 1;
  // The row holds three facts, so it still fits a phone beside its Chip and its menu.
  const facts = [
    `${data.temperature}°`,
    weightOut && `${weightOut} g`,
    several ? `${phases.length} phases` : `${totalDurationSeconds} s`,
  ];
  // The details add only what the row leaves out.
  const moreFacts = [
    data.type === 'pro' && data.selected && 'Pro',
    data.dose && `${data.dose} g in`,
    several && `${totalDurationSeconds} s in all`,
  ].filter(Boolean);

  return (
    <div
      role='listitem'
      className='profile-card-container border-t border-(--line) first:border-t-0'
    >
      <ListRow
        onClick={() => onSelect(data.id)}
        icon='coffee'
        current={data.selected}
        title={data.label}
        meta={facts.filter(Boolean).join(' · ')}
        end={
          data.selected ? (
            <Chip tone='ink'>In use</Chip>
          ) : data.type === 'pro' ? (
            <Chip>Pro</Chip>
          ) : null
        }
        action={
          <Menu label={`Actions for ${data.label}`}>
            <MenuItem icon='pencil' href={`/profiles/${data.id}`}>
              Edit
            </MenuItem>
            <MenuItem
              icon={detailsCollapsed ? 'chevron-down' : 'chevron-up'}
              onClick={onToggleDetails}
            >
              {detailsCollapsed ? 'Show details' : 'Hide details'}
            </MenuItem>
            <MenuItem
              icon={data.favorite ? 'x' : 'check'}
              disabled={favoriteToggleDisabled}
              onClick={onFavoriteToggle}
            >
              {data.favorite ? 'Unfavourite' : 'Favourite'}
            </MenuItem>
            <MenuItem icon='chart-column' href={statsHref}>
              Statistics
            </MenuItem>
            <MenuItem icon='download' onClick={onDownload}>
              Export
            </MenuItem>
            <MenuItem icon='plus' onClick={() => onDuplicate(data.id)}>
              Duplicate
            </MenuItem>
            <ConfirmMenuItem
              label='Delete'
              confirmLabel='Confirm delete'
              onConfirm={() => onDelete(data.id)}
            />
          </Menu>
        }
      />
      {!detailsCollapsed && (
        <div
          id={detailsSectionId}
          role='group'
          aria-label={`Profile details for ${data.label}`}
          className={cx('flex flex-col gap-3 pb-4 sm:pl-13', isDragging && 'hidden')}
        >
          {data.description && <p className='bm-help'>{data.description}</p>}
          {moreFacts.length > 0 && <p className='bm-data'>{moreFacts.join(' · ')}</p>}
          <div className='min-w-0 overflow-x-auto'>
            {data.type === 'pro' ? (
              <ExtendedProfileChart data={{ ...data, phases }} className='max-h-36' />
            ) : (
              <PhaseCells phases={phases} />
            )}
          </div>
          <div className='flex items-center gap-2' role='group' aria-label='Order in the list'>
            <span className='bm-eyebrow mr-1'>Order</span>
            <Tooltip content='Move to top' disabled={isDragging || tooltipsDisabled}>
              <Button
                iconOnly
                size='sm'
                onClick={handleMoveTop}
                disabled={isFirst}
                aria-label={`Move ${data.label} to top`}
              >
                <Icon name='chevron-up' size={18} />
              </Button>
            </Tooltip>
            <Tooltip
              content={disabledDrag ? 'Clear the search to drag' : 'Drag to reorder'}
              disabled={isDragging}
            >
              <span
                data-drag-handle
                className={cx(
                  'bm-btn bm-btn--icon bm-btn--sm',
                  disabledDrag ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
                )}
              >
                <Icon name='menu' size={18} />
              </span>
            </Tooltip>
            <Tooltip content='Move to bottom' disabled={isDragging || tooltipsDisabled}>
              <Button
                iconOnly
                size='sm'
                onClick={handleMoveBottom}
                disabled={isLast}
                aria-label={`Move ${data.label} to bottom`}
              >
                <Icon name='chevron-down' size={18} />
              </Button>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}

// The phases of a simple profile, one cell each, in the order they run.
function PhaseCells({ phases }) {
  if (phases.length === 0) {
    return <p className='bm-help'>No phases</p>;
  }

  return (
    <div className='grid grid-cols-2 gap-2 sm:grid-cols-3' role='list' aria-label='Brew phases'>
      {phases.map((phase, i) => {
        const targets = phase.targets || [];
        return (
          <Cell key={i} role='listitem'>
            <span className='bm-eyebrow'>{PhaseLabels[phase.phase]}</span>
            <span className='bm-field__label'>{phase.name}</span>
            <span className='bm-data'>
              {targets.length === 0
                ? `${phase.duration} s`
                : targets
                    .map(t => `Stop at ${t.value}${t.type === 'volumetric' ? ' g' : ''}`)
                    .join(' · ')}
            </span>
          </Cell>
        );
      })}
    </div>
  );
}
