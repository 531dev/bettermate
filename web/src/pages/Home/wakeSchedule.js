import { clockOf } from '../../utils/time.js';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// "07:00|1111100;08:30|0000011" from the firmware, days Monday first.
export function parseSchedules(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return raw
    .split(';')
    .map(entry => {
      const [time, days = ''] = entry.split('|');
      return { time, days: [...days].map(d => d === '1') };
    })
    .filter(s => s.time && s.days.length === DAY_NAMES.length && s.days.some(Boolean));
}

export function daysLabel(days) {
  const on = days.flatMap((enabled, i) => (enabled ? [i] : []));
  if (on.length === DAY_NAMES.length) return 'Every day';
  if (on.join() === '0,1,2,3,4') return 'Mon to Fri';
  if (on.join() === '5,6') return 'Weekends';
  return on.map(i => DAY_NAMES[i]).join(', ');
}

/** A wake time on the 24-hour clock: '06:30'. `hour12` is no longer read; the web is 24-hour. */
export const timeLabel = time => clockOf(time);

// When the machine next wakes on its own, as a short phrase. Empty when no wake is scheduled.
export function nextWakeLabel(settings, hour12, now = new Date()) {
  if (!settings?.autowakeupEnabled) return '';
  let next = null;
  for (const { time, days } of parseSchedules(settings.autowakeupSchedules)) {
    const [hours, minutes] = time.split(':').map(Number);
    for (let offset = 0; offset <= 7; offset++) {
      const at = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
        hours,
        minutes,
      );
      const mondayFirst = (at.getDay() + 6) % 7;
      if (at > now && days[mondayFirst]) {
        if (!next || at < next.at) next = { at, offset, mondayFirst, time };
        break;
      }
    }
  }
  if (!next) return '';
  const day =
    next.offset === 0 ? 'today' : next.offset === 1 ? 'tomorrow' : DAY_NAMES[next.mondayFirst];
  return `Wakes ${day} at ${timeLabel(next.time, hour12)}`;
}
