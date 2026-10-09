export type PaidRecords = Map<string, string | null>

export function parsePaidRecords(stored: string | null): PaidRecords {
  if (stored === null) return new Map()
  const value: unknown = JSON.parse(stored)
  // Legacy paid flags have no payment time; never substitute the export time.
  if (Array.isArray(value) && value.every(key => typeof key === 'string')) {
    return new Map(value.map(key => [key, null]))
  }
  if (typeof value !== 'object' || value === null || !('version' in value) ||
      value.version !== 1 || !('entries' in value) || !Array.isArray(value.entries)) {
    throw new Error('Invalid saved payout payment records')
  }
  const records: PaidRecords = new Map()
  for (const entry of value.entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' ||
        (entry[1] !== null && (typeof entry[1] !== 'string' ||
          !Number.isFinite(Date.parse(entry[1]))))) {
      throw new Error('Invalid saved payout payment timestamp')
    }
    records.set(entry[0], entry[1])
  }
  return records
}

export function serializePaidRecords(records: PaidRecords): string {
  return JSON.stringify({ version: 1, entries: [...records] })
}

export function togglePaidRecord(records: PaidRecords, key: string, now: Date): PaidRecords {
  const next = new Map(records)
  if (next.has(key)) next.delete(key)
  else next.set(key, now.toISOString())
  return next
}
