import { useRef } from 'preact/hooks';
import { Chip } from '../../../../components/Chip.jsx';
import { Icon } from '../../../../components/Icon.jsx';
import { Spinner } from '../../../../components/Spinner.jsx';
import { Tile } from '../../../../components/Tile.jsx';
import { cleanName } from '../../utils/analyzerUtils';
import { SourceMarker } from '../SourceMarker';
import { getAnalyzerShotDisplayName, getShotDateTimeLabel } from '../useShotNotesState';
import { ShotSummaryMetricsRow } from './ShotMetricCards';
import './shotDetails.css';
import { clock } from '../../../../utils/time.js';

const WEEKDAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const RATING_VALUES = [1, 2, 3, 4, 5];

function getRelativeDayLabel(timestamp) {
  if (!timestamp) return '';
  const now = new Date();
  const shotDate = new Date(timestamp * 1000);

  // Check if same calendar date
  const isSameDate =
    now.getFullYear() === shotDate.getFullYear() &&
    now.getMonth() === shotDate.getMonth() &&
    now.getDate() === shotDate.getDate();
  if (isSameDate) {
    return clock(shotDate);
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    yesterday.getFullYear() === shotDate.getFullYear() &&
    yesterday.getMonth() === shotDate.getMonth() &&
    yesterday.getDate() === shotDate.getDate();
  if (isYesterday) return 'Yesterday';

  // Approximate day diff for remaining cases
  const diffDays = Math.floor((now - shotDate) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return '';

  if (diffDays <= 6) return WEEKDAY_LABELS[shotDate.getDay()];

  if (diffDays <= 13) return 'Last week';

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks <= 4) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;

  const diffYears = Math.floor(diffDays / 365);
  if (diffYears < 2) return '1 year ago';
  return `${diffYears} years ago`;
}

/** The profile the shot was pulled with, or nothing when none is known. */
function getProfileLabel(entry) {
  const label = cleanName(
    entry?.shot?.profile || entry?.profileName || entry?.profile?.label || '',
  );
  return /^no profile loaded$/i.test(label) ? '' : label;
}

/**
 * Five marks, lit up to the rating. A radio group: the arrow keys move the rating, and only the
 * chosen mark is the checked radio.
 */
function RatingControl({ rating, onChange }) {
  const current = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  const marks = useRef([]);

  const onKeyDown = event => {
    const focused = marks.current.indexOf(event.target) + 1 || current || 1;
    const next = {
      ArrowRight: focused + 1,
      ArrowUp: focused + 1,
      ArrowLeft: focused - 1,
      ArrowDown: focused - 1,
      Home: 1,
      End: 5,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const value = Math.max(1, Math.min(5, next));
    if (value !== current) onChange(value);
    marks.current[value - 1]?.focus();
  };

  return (
    <div
      className='an-rating shot-details-rating'
      role='radiogroup'
      aria-label='Rating'
      onKeyDown={onKeyDown}
    >
      {RATING_VALUES.map(value => (
        <button
          key={value}
          ref={element => {
            marks.current[value - 1] = element;
          }}
          type='button'
          role='radio'
          className='an-rating__mark'
          aria-checked={value === current}
          aria-label={`${value} of 5`}
          title={`${value}/5`}
          data-lit={value <= current ? 'true' : undefined}
          tabIndex={value === (current || 1) ? 0 : -1}
          onClick={() => onChange(value)}
        />
      ))}
    </div>
  );
}

export function ShotMainInfoCard({
  entry,
  notes,
  loading = false,
  onRatingChange = () => {},
  showSummaryMetrics = true,
  className,
}) {
  const shotLabel = getAnalyzerShotDisplayName(entry?.shot, entry?.shotName || entry?.label);
  const subtitle = [getRelativeDayLabel(entry?.shot?.timestamp), getProfileLabel(entry)]
    .filter(Boolean)
    .join(' · ');
  const dateLabel = getShotDateTimeLabel(entry?.shot?.timestamp);
  const completionLabel = entry?.results?.completionLabel || entry?.results?.brewModeLabel;

  return (
    <Tile className={className}>
      <div className='bm-tile__head items-start'>
        <div className='min-w-0'>
          <h2 className='bm-sub truncate'>{shotLabel}</h2>
          {subtitle ? <p className='bm-help truncate'>{subtitle}</p> : null}
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          {loading ? <Spinner size={4} /> : null}
          {entry?.shot?.source === 'temp' ? (
            <Icon name='search' size={20} title='Temporary view' />
          ) : (
            <SourceMarker source={entry?.shot?.source} variant='library' />
          )}
        </div>
      </div>

      {showSummaryMetrics ? <ShotSummaryMetricsRow total={entry?.results?.total} /> : null}

      <div className='flex items-center justify-between gap-3'>
        <span className='bm-eyebrow'>Rating</span>
        <RatingControl rating={notes?.rating} onChange={onRatingChange} />
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='bm-caption'>{dateLabel}</span>
        {completionLabel ? (
          <Chip tone={entry?.results?.completionTone === 'warning' ? 'warning' : undefined}>
            {completionLabel}
          </Chip>
        ) : null}
      </div>
    </Tile>
  );
}
