const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const timestampFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function localCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTournamentDate(value: string | null | undefined, fallback = 'Date not set'): string {
  if (!value?.trim()) return fallback;
  const date = localCalendarDate(value) ?? new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function formatTournamentDateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start?.trim() && !end?.trim()) return 'Dates not set';
  if (!start?.trim()) return formatTournamentDate(end);
  if (!end?.trim() || start === end) return formatTournamentDate(start);
  return `${formatTournamentDate(start)} - ${formatTournamentDate(end)}`;
}

export function formatSquadTime(value: string | null | undefined): string {
  if (!value?.trim()) return 'Time not set';
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/u.exec(value.trim());
  if (!match) return value;
  const date = new Date(2000, 0, 1, Number(match[1]), Number(match[2]));
  return Number.isNaN(date.getTime()) ? value : timeFormatter.format(date);
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
