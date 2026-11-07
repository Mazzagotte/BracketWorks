export { normalizeTournamentDate, formatTournamentDate, formatTournamentDateRange } from '@/lib/tournamentDates';
const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function formatSquadTime(value: string | null | undefined): string {
  if (!value?.trim()) return 'Time not set';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/u.exec(value.trim());
  if (!match) return value;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return Number.isNaN(date.getTime()) ? value : timeFormatter.format(date);
}

/** Offset (ms) of a timezone from UTC at a given instant. */
function timeZoneOffsetMs(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
  return asUtc - instant.getTime();
}

/**
 * The moment registration closes: a calendar date and wall-clock time in the tournament's timezone.
 * Without a time, registration closes at the end of that day (11:59 PM).
 */
export function getRegistrationDeadline(
  dateIso: string | null | undefined,
  time?: string | null,
  timeZone?: string | null,
): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/u.exec(dateIso?.trim() ?? '');
  if (!dateMatch) return null;
  const timeMatch = /^(\d{1,2}):(\d{2})/u.exec(time?.trim() || '23:59');
  const hours = Number(timeMatch?.[1] ?? 23);
  const minutes = Number(timeMatch?.[2] ?? 59);
  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  if (!timeZone) return new Date(year, monthIndex, day, hours, minutes);
  try {
    const wallClockAsUtc = Date.UTC(year, monthIndex, day, hours, minutes);
    const firstGuess = wallClockAsUtc - timeZoneOffsetMs(timeZone, new Date(wallClockAsUtc));
    // Re-check once so dates near a daylight-saving change land on the right offset.
    return new Date(wallClockAsUtc - timeZoneOffsetMs(timeZone, new Date(firstGuess)));
  } catch {
    return new Date(year, monthIndex, day, hours, minutes);
  }
}

/** "Nov 8, 2026, 11:59 PM MST", shown in the tournament's own timezone. */
export function formatRegistrationDeadline(
  dateIso: string | null | undefined,
  time?: string | null,
  timeZone?: string | null,
  fallback = 'Not set',
): string {
  const deadline = getRegistrationDeadline(dateIso, time, timeZone);
  if (!deadline) return fallback;
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: timeZone || undefined, timeZoneName: timeZone ? 'short' : undefined,
    }).format(deadline);
  } catch {
    return timestampFormatter.format(deadline);
  }
}

export function formatRegistrationTimestamp(value: string | null | undefined, fallback = 'Unknown date'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : timestampFormatter.format(date);
}

export function formatMoney(cents: number | null | undefined, currency = 'USD'): string {
  const amount = Number.isFinite(cents) ? Number(cents) : 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100);
  }
}
