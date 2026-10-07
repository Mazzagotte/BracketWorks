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

export function normalizeTournamentDate(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s*\(day:\s*\d+\)\s*$/iu, '').trim();
  if (!normalized) return null;

  const legacyDateMatch = /^([a-z]{3})\s+(\d{1,2})-(\d{4})$/iu.exec(normalized);
  if (!legacyDateMatch) return normalized;

  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(legacyDateMatch[1].toLowerCase());
  if (month < 0) return normalized;

  const day = Number(legacyDateMatch[2]);
  const year = Number(legacyDateMatch[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return normalized;

  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function formatTournamentDate(value: string | null | undefined, fallback = 'Date not set'): string {
  const normalized = normalizeTournamentDate(value);
  if (!normalized) return fallback;
  const date = localCalendarDate(normalized) ?? new Date(normalized);
  return Number.isNaN(date.getTime()) ? normalized : dateFormatter.format(date);
}

export function formatTournamentDateRange(start: string | null | undefined, end: string | null | undefined): string {
  const normalizedStart = normalizeTournamentDate(start);
  const normalizedEnd = normalizeTournamentDate(end);
  if (!normalizedStart && !normalizedEnd) return 'Dates not set';
  if (!normalizedStart) return formatTournamentDate(normalizedEnd);
  if (!normalizedEnd || normalizedStart === normalizedEnd) return formatTournamentDate(normalizedStart);
  return `${formatTournamentDate(normalizedStart)} - ${formatTournamentDate(normalizedEnd)}`;
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
