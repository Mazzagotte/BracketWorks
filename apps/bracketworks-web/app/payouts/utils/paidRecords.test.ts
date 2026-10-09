import { describe, expect, it } from 'vitest'
import { parsePaidRecords, serializePaidRecords, togglePaidRecord } from './paidRecords'

describe('paidRecords', () => {
  it('preserves legacy paid flags without inventing timestamps', () => {
    expect(parsePaidRecords('["11","22"]')).toEqual(new Map([['11', null], ['22', null]]))
    expect(parsePaidRecords(null).size).toBe(0)
  })

  it('persists the actual check time across reloads and later exports', () => {
    const checkedAt = new Date('2026-10-09T01:05:00Z')
    const records = togglePaidRecord(new Map(), '11', checkedAt)
    expect(parsePaidRecords(serializePaidRecords(records)).get('11')).toBe(checkedAt.toISOString())
    expect(togglePaidRecord(records, '22', new Date('2026-10-10T01:05:00Z')).get('11'))
      .toBe(checkedAt.toISOString())
  })

  it('removes the timestamp when unchecked and records a fresh one when checked again', () => {
    const original = togglePaidRecord(new Map(), '11', new Date('2026-10-09T01:05:00Z'))
    const unchecked = togglePaidRecord(original, '11', new Date('2026-10-09T01:06:00Z'))
    expect(unchecked.has('11')).toBe(false)
    expect(togglePaidRecord(unchecked, '11', new Date('2026-10-09T01:07:00Z')).get('11'))
      .toBe('2026-10-09T01:07:00.000Z')
    expect(original.get('11')).toBe('2026-10-09T01:05:00.000Z')
  })

  it.each([
    '{}', '["11",12]', '{"version":2,"entries":[]}',
    '{"version":1,"entries":[["11","invalid"]]}',
    '{"version":1,"entries":[[11,null]]}',
  ])('rejects malformed records: %s', stored => {
    expect(() => parsePaidRecords(stored)).toThrow()
  })
})
