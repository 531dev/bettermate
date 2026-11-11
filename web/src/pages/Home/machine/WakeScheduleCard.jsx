import { useQuery } from 'preact-fetching';
import { Icon } from '../../../components/Icon.jsx';
import { clock24hSignal } from '../../../utils/dashboardManager.js';
import { daysLabel, parseSchedules, timeLabel } from './wakeSchedule.js';

export function WakeScheduleCard() {
  const { data: settings } = useQuery(
    'settings-cache',
    async () => (await fetch('/api/settings')).json(),
    { staleTime: 30000, refetchOnWindowFocus: false },
  );
  if (!settings) return null;

  const schedules = settings.autowakeupEnabled ? parseSchedules(settings.autowakeupSchedules) : [];

  if (schedules.length === 0) {
    return (
      <section className='bm-group py-2' aria-label='Wake schedule'>
        <a href='/settings/plugins' className='bm-row'>
          <span className='bm-row__icon'>
            <Icon name='clock' />
          </span>
          <span className='min-w-0 flex-1'>
            <span className='bm-row__title'>Wake schedule</span>
            <span className='bm-row__sub'>Hot before your first coffee</span>
          </span>
          <span className='bm-row__arrow'>
            <Icon name='arrow-right' />
          </span>
        </a>
      </section>
    );
  }

  return (
    <section className='bm-group' aria-label='Wake schedule'>
      <h2 className='bm-group__title'>Wake schedule</h2>
      <ul>
        {schedules.map((schedule, i) => (
          <li key={i}>
            <a href='/settings/plugins' className='bm-row'>
              <span className='bm-row__icon'>
                <Icon name='clock' />
              </span>
              <span className='min-w-0 flex-1'>
                <span className='bm-row__title'>Wake up</span>
                <span className='bm-row__sub'>{daysLabel(schedule.days)}</span>
              </span>
              <span className='shrink-0 text-sm'>
                {timeLabel(schedule.time, !clock24hSignal.value)}
              </span>
              <span className='bm-row__arrow'>
                <Icon name='arrow-right' />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
