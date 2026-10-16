const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function normalizeTournamentDate(value: string | null | undefined): string | null {
  const normalized = value?.trim().replace(/\s*\(day:\s*\d+\)\s*$/iu, '').trim();
  if (!normalized) return null;
  const legacy = /^([a-z]{3})\s+(\d{1,2})-(\d{4})$/iu.exec(normalized);
  if (!legacy) return normalized;
  const month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
    .indexOf(legacy[1].toLowerCase());
  return month < 0 ? normalized : `${legacy[3]}-${String(month + 1).padStart(2, '0')}-${legacy[2].padStart(2, '0')}`;
}

export function parseTournamentDate(value: string | null | undefined): Date | null {
  const normalized = normalizeTournamentDate(value);
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(normalized);
  if (match) {
    // Date-only database values describe a local calendar day, not midnight UTC.
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null;
  }
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTournamentDate(value: string | null | undefined, fallback = 'Date not set'): string {
  const date = parseTournamentDate(value);
  return date ? dateFormatter.format(date) : fallback;
}

export function formatTournamentDateRange(start: string | null | undefined, end: string | null | undefined): string {
  const startDate = parseTournamentDate(start);
  const endDate = parseTournamentDate(end);
  if (!startDate && !endDate) return 'Dates not set';
  if (!startDate) return dateFormatter.format(endDate!);
  if (!endDate || startDate.toDateString() === endDate.toDateString()) return dateFormatter.format(startDate);
  return `${dateFormatter.format(startDate)} - ${dateFormatter.format(endDate)}`;
}
