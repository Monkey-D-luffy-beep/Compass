/**
 * Calendar maths for the timeline. Dates are plain "YYYY-MM-DD" strings in the local calendar (the person's own day,
 * not UTC), and weeks run Monday to Sunday. Pure, so the buckets are easy to test.
 */
export type Bucket = 'overdue' | 'today' | 'week' | 'next' | 'month' | 'later';
export type When = 'today' | 'week' | 'next' | 'month' | 'later';

const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string): Date => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
/** The person's time zone. A hosted server runs in UTC, so "today" must be worked out for where they live. */
export const tzName = (): string => (typeof process !== 'undefined' && process.env.COMPASS_TZ) || 'Asia/Kolkata';
function parts(now: Date, tz: string): Record<string, string> {
  const o: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now)) o[p.type] = p.value;
  return o;
}
/** Today's date in the person's own time zone (only numbers are read out, so server and browser cannot disagree). */
export const todayStr = (now: Date = new Date(), tz: string = tzName()): string => { const p = parts(now, tz); return `${p.year}-${p.month}-${p.day}`; };
export const hourNow = (now: Date = new Date(), tz: string = tzName()): number => Number(parts(now, tz).hour);
export const addDays = (s: string, n: number): string => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };

/** Sunday of the week that contains `s`. */
export function weekEnd(s: string): string {
  const d = parse(s);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return addDays(s, 6 - dow);
}
export function weekStart(s: string): string { return addDays(weekEnd(s), -6); }
export function monthEnd(s: string): string { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }

export function bucketOf(due: string | null, today: string): Bucket {
  if (!due) return 'later';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  if (due <= weekEnd(today)) return 'week';
  if (due <= addDays(weekEnd(today), 7)) return 'next';
  if (due <= monthEnd(today)) return 'month';
  return 'later';
}

/** The date a "when" choice stands for. "This month" is the real last day of the month, so late in the month it shows under next week or this week, which is where it is due. */
export function dueFor(when: When, today: string): string | null {
  switch (when) {
    case 'today': return today;
    case 'week': return weekEnd(today);
    case 'next': return addDays(weekEnd(today), 7);
    case 'month': return monthEnd(today);
    default: return null;
  }
}

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue', today: 'Today', week: 'This week', next: 'Next week', month: 'This month', later: 'Later',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon 10 Nov". */
export function dayLabel(s: string): string {
  const d = parse(s);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
export const monthOf = (s: string): string => s.slice(0, 7);
export function monthLabel(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
}
