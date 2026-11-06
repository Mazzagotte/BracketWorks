import { describe, expect, it } from 'vitest'

import { formatSquadDate, formatSquadLabel } from './squadDate'

describe('squad dates', () => {
  it('formats date-only values without shifting a day', () => {
    expect(formatSquadDate('2028-01-01')).toBe('Saturday, January 1, 2028')
    expect(formatSquadDate('2028-01-01', 'short')).toBe('Jan 1, 2028')
  })

  it('handles missing and unknown values', () => {
    expect(formatSquadDate(undefined)).toBe('Date pending')
    expect(formatSquadDate('Sunday morning')).toBe('Sunday morning')
  })

  it('formats stored squad labels', () => {
    expect(formatSquadLabel('2028-01-01 9:00 PM')).toBe('Jan 1, 2028 · 9:00 PM')
    expect(formatSquadLabel('Early squad')).toBe('Early squad')
    expect(formatSquadLabel('')).toBeNull()
  })
})
