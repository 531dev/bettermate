import { cx } from '../../../components/cx.js';
import { List, ListRow } from '../../../components/ListRow.jsx';
import { SkeletonBlock } from '../../../components/SkeletonBlock.jsx';
import { Tile } from '../../../components/Tile.jsx';
import { recentShotCountSignal, shotMetricSlotsSignal } from '../../../utils/dashboardManager.js';
import { cleanName } from '../utils.js';
import { daysLabel, parseSchedules, timeLabel } from '../wakeSchedule.js';

// Compares calendar dates, not raw milliseconds, so 11:59 PM yesterday
// correctly reads as "Yesterday" even if less than 24 h ago. Within the week a shot is named by
// its day; an older one by its date, which a weekday no longer tells.
function getRelativeDayLabel(timestamp) {
  if (!timestamp || timestamp < 10000) return '';
  const d = new Date(timestamp * 1000);
  const today = new Date();
  const shotDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((todayDay - shotDay) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatShotTime(timestamp, hour12) {
  if (!timestamp || timestamp < 10000) return '';
  return new Date(timestamp * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
}

// The facts a row can carry; Dashboard Settings picks three for the Customize view.
const FACTS = {
  duration: shot => (shot.duration != null ? `${(shot.duration / 1000).toFixed(1)} s` : null),
  weight: shot => (shot.volume != null ? `${shot.volume.toFixed(1)} g` : null),
  avgTemp: shot => (shot.avgTemp != null ? `${shot.avgTemp.toFixed(1)}°` : null),
  maxPressure: shot => (shot.maxPressure != null ? `${shot.maxPressure.toFixed(1)} bar` : null),
  avgFlow: shot => (shot.avgFlow != null ? `${shot.avgFlow.toFixed(2)} ml/s` : null),
};

// Day and time share a line where the tile is wide enough, and stack where it is not, so the
// facts keep their room on a phone.
function When({ day, time }) {
  return (
    <>
      <span className='block @sm:inline'>{day}</span>{' '}
      <span className='block @sm:inline'>{time}</span>
    </>
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
      end={
        <When
          day={getRelativeDayLabel(shot.timestamp)}
          time={formatShotTime(shot.timestamp, hour12)}
        />
      }
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
      <List>
        {loading && Array.from({ length: count }, (_, i) => <PendingRow key={i} />)}
        {!loading && shots.length === 0 && (
          <p className='bm-help pb-3'>No shots yet. Pull one and it shows up here.</p>
        )}
        {!loading &&
          shots.slice(0, count).map(shot => <ShotRow key={shot.id} shot={shot} hour12={hour12} />)}
        <WakeRow settings={settings} hour12={hour12} />
      </List>
    </Tile>
  );
}
