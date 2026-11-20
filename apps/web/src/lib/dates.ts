/**
 * Helpers for calendar days.
 *
 * A day is a "YYYY-MM-DD" string (the same format the API uses). All the math
 * is done in UTC, so daylight saving time can never shift a day by an hour and
 * land it on the wrong date.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);
const format = (d: Date) => d.toISOString().slice(0, 10);

/** True for a real date in the form "YYYY-MM-DD" (so not "2026-02-30"). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = parse(value);
  return !Number.isNaN(d.getTime()) && format(d) === value;
}

/** Today's date where the user is (not in UTC). */
export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return format(new Date(parse(iso).getTime() + days * DAY_MS));
}

/** The Monday of the week that `iso` is in. */
export function startOfWeek(iso: string): string {
  const daysSinceMonday = (parse(iso).getUTCDay() + 6) % 7; // getUTCDay: 0 = Sunday
  return addDays(iso, -daysSinceMonday);
}

/** The seven days of a week, Monday first. */
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * ISO 8601 week number, the one used in Sweden. A week belongs to the year
 * its Thursday is in, so week 1 is the week with the year's first Thursday.
 */
export function isoWeekNumber(iso: string): number {
  const thursday = parse(addDays(startOfWeek(iso), 3));
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / DAY_MS / 7) + 1;
}

const weekdayFormat = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', timeZone: 'UTC' });
const dayMonthFormat = new Intl.DateTimeFormat('sv-SE', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "2026-11-16" → "måndag" */
export const formatWeekday = (iso: string) => weekdayFormat.format(parse(iso));

/** "2026-11-16" → "16 nov." */
export const formatDayMonth = (iso: string) => dayMonthFormat.format(parse(iso));
