const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** Parses a squad date. Date-only values are calendar dates, so they parse as local time and never shift a day. */
function parseSquadDate(value: string): Date | null {
  const parsed = new Date(DATE_ONLY.test(value) ? `${value}T00:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** "Saturday, January 1, 2028" (long) or "Jan 1, 2028" (short). Unknown formats pass through. */
export function formatSquadDate(value: string | null | undefined, style: 'long' | 'short' = 'long'): string {
  if (!value) return 'Date pending'
  const parsed = parseSquadDate(value)
  if (!parsed) return value
  return style === 'long'
    ? parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Formats a stored squad label such as "2028-01-01 9:00 PM" as "Jan 1, 2028 · 9:00 PM". */
export function formatSquadLabel(label: string | null | undefined): string | null {
  if (!label) return null
  const match = label.match(/^(\d{4}-\d{2}-\d{2})\s*(.*)$/)
  if (!match) return label
  const [, date, rest = ''] = match
  return [formatSquadDate(date, 'short'), rest.trim()].filter(Boolean).join(' · ')
}
