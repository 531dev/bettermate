// Times and dates as the design's Content section writes them: a 24-hour clock with a leading
// zero, no AM or PM, no comma between day and time. `14:41`, `Today 14:41`, `12 Nov 07:12`,
// `12 Nov 2025`; a day heading is `Today`, `Yesterday` or `12 November`. The machine's 24-hour
// setting is the round display's; the web always reads 24-hour.

const pad = n => String(n).padStart(2, '0');
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A Date from a device timestamp in seconds, or in milliseconds, or a Date. */
export const toDate = value =>
  value instanceof Date ? value : new Date(value < 1e11 ? value * 1000 : value);

/** `14:41`. */
export const clock = value => {
  const date = toDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** A wall-clock time of day stored as 'H:MM' (a wake schedule): `06:30`. */
export const clockOf = time => {
  const [hours, minutes] = String(time).split(':').map(Number);
  return `${pad(hours || 0)}:${pad(minutes || 0)}`;
};

const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Whole calendar days between `value` and now: 0 today, 1 yesterday. */
export const daysAgo = (value, now = new Date()) =>
  Math.round((startOfDay(now) - startOfDay(toDate(value))) / 86400000);

/** `12 Nov`, with the year when it is not this one: `12 Nov 2025`. */
export const shortDate = (value, now = new Date()) => {
  const date = toDate(value);
  const day = `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
};

/** A day heading: `Today`, `Yesterday`, `12 November`, `12 November 2025`. */
export const dayHeading = (value, now = new Date()) => {
  const date = toDate(value);
  const ago = daysAgo(date, now);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? day : `${day} ${date.getFullYear()}`;
};

/**
 * When something happened, for a row with no day heading: `Today 14:41`, `Yesterday 14:41`,
 * `12 Nov 07:12`, and `12 Nov 2025` for another year.
 */
export const when = (value, now = new Date()) => {
  const date = toDate(value);
  const ago = daysAgo(date, now);
  if (ago === 0) return `Today ${clock(date)}`;
  if (ago === 1) return `Yesterday ${clock(date)}`;
  if (date.getFullYear() !== now.getFullYear()) return shortDate(date, now);
  return `${shortDate(date, now)} ${clock(date)}`;
};

/** A full date and time, for a fact line: `12 Nov 2026 14:41`. */
export const dateTime = value => {
  const date = toDate(value);
  return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)} ${date.getFullYear()} ${clock(date)}`;
};
