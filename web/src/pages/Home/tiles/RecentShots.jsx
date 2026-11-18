import { cx } from '../../../components/cx.js';
import { List, ListRow } from '../../../components/ListRow.jsx';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { recentShotCountSignal, shotMetricSlotsSignal } from '../../../utils/dashboardManager.js';
import { cleanName } from '../utils.js';
import { clock, daysAgo, shortDate } from '../../../utils/time.js';
import { daysLabel, parseSchedules, timeLabel } from '../wakeSchedule.js';
import { EmptyState } from '../../../components/EmptyState.jsx';

// Calendar days, so 23:59 yesterday reads as Yesterday: Today, Yesterday, then '12 Nov'.
function getRelativeDayLabel(timestamp) {
  if (!timestamp || timestamp < 10000) return '';
  const ago = daysAgo(timestamp);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return shortDate(timestamp);
}

const formatShotTime = timestamp => (!timestamp || timestamp < 10000 ? '' : clock(timestamp));

// The facts a row can carry; Dashboard Settings picks three for the Customize view.
const FACTS = {
  duration: shot => (shot.duration != null ? `${(shot.duration / 1000).toFixed(1)} s` : null),
  weight: shot => (shot.volume != null ? `${shot.volume.toFixed(1)} g` : null),
  avgTemp: shot => (shot.avgTemp != null ? `${shot.avgTemp.toFixed(1)}°` : null),
  maxPressure: shot => (shot.maxPressure != null ? `${shot.maxPressure.toFixed(1)} bar` : null),
  avgFlow: shot => (shot.avgFlow != null ? `${shot.avgFlow.toFixed(2)} ml/s` : null),
};

// One thing at the end of a row, on one line. Where the tile is wide enough that is the day and
// the time; on a phone it is the time of a shot pulled today and the day of an older one, so the
// facts keep their room.
function When({ timestamp }) {
  const day = getRelativeDayLabel(timestamp);
  const today = day === 'Today';
  return (
    <span className='whitespace-nowrap'>
      <span className={today ? 'hidden @sm:inline' : undefined}>{day}</span>{' '}
      <span className={today ? undefined : 'hidden @sm:inline'}>{formatShotTime(timestamp)}</span>
    </span>
  );
}

function ShotRow({ shot, hour12 }) {
  // Each fact holds together with its dot, so a row too narrow for all of them breaks between
  // facts instead of cutting the last one off.
  const facts = shotMetricSlotsSignal.value
    .map(slot => FACTS[slot]?.(shot))
    .filter(Boolean)
    .map((fact, i, all) => `${fact}${i < all.length - 1 ? ' ·' : ''}`.replaceAll(' ', ' '))
    .join(' ');
  return (
    <ListRow
      href={`/analyzer/internal/${shot.id}`}
      icon='coffee'
      title={cleanName(shot.profile) || 'Unknown'}
      meta={facts && <span className='whitespace-normal'>{facts}</span>}
      end={<When timestamp={shot.timestamp} hour12={hour12} />}
    />
  );
}

function PendingRow() {
  return (
    <div className='bm-item'>
      <SkeletonBlock className='rounded-pill h-10 w-10' />
      <span className='bm-item__body flex flex-col gap-2'>
        <SkeletonBlock className='h-4 w-2/5' />
        <SkeletonBlock className='h-3 w-3/5' />
      </span>
    </div>
  );
}

// The wake schedule is the last row: when the machine heats on its own, or where to set that up.
function WakeRow({ settings, hour12 }) {
  if (!settings) return null;
  const schedules = settings.autowakeupEnabled ? parseSchedules(settings.autowakeupSchedules) : [];
  const [only] = schedules;
  const meta =
    schedules.length === 0
      ? 'Hot before your first coffee'
      : schedules.length === 1
        ? daysLabel(only.days)
        : schedules.map(s => `${daysLabel(s.days)} ${timeLabel(s.time, hour12)}`).join(' · ');
  return (
    <ListRow
      href='/settings/plugins'
      icon='clock'
      title='Wake schedule'
      meta={meta}
      end={schedules.length === 1 ? timeLabel(only.time, hour12) : undefined}
    />
  );
}

/**
 * The newest shots, each a row that opens in the Analyzer, then the wake schedule.
 *   recent    useRecentShots()
 *   max       show at most this many of them
 *   settings  the machine's settings, for the wake schedule
 *   hour12    times as 2:41 PM instead of 14:41
 */
export function RecentShots({ recent, max, settings, hour12, className }) {
  const { shots, loading } = recent;
  const count = Math.min(recentShotCountSignal.value, max ?? Infinity);
  return (
    <Tile
      aria-label='Recent shots'
      title='Recent shots'
      end={
        <a href='/history' className='bm-link'>
          All shots
        </a>
      }
      className={cx('@container', className)}
    >
      {!loading && shots.length === 0 && (
        <EmptyState icon='coffee' title='No shots yet'>
          Your shots appear here as soon as you pull one.
        </EmptyState>
      )}
      <List>
        {loading && Array.from({ length: count }, (_, i) => <PendingRow key={i} />)}
        {!loading &&
          shots.slice(0, count).map(shot => <ShotRow key={shot.id} shot={shot} hour12={hour12} />)}
        <WakeRow settings={settings} hour12={hour12} />
      </List>
    </Tile>
  );
}
