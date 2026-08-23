import { describe, expect, it } from 'vitest'
import { buildImportPreview, importPreviewCounts } from './buildImportPreview'
import type { ImportablePlayer } from './importPlayers'

const row = (sourceRow: number, name: string, usbc = ''): ImportablePlayer => ({
  sourceRow, firstName: name.split(' ')[0]!, lastName: name.split(' ').slice(1).join(' '),
  normalizedName: name.toLowerCase(), importKey: usbc ? `usbc:${usbc}` : `name:${name.toLowerCase()}`,
  usbc, average: 180, handicap: 1, scratch: 1, bracketEntries: { handicap: 1, scratch: 1 }, lane: 'A1', amountPaid: 0, totalCost: 20,
})

describe('buildImportPreview', () => {
  it('categorizes new, existing, duplicate, warning, and invalid rows', () => {
    const rows = buildImportPreview(
      [row(2, 'New Player', '100'), row(3, 'Existing Player', '200'), row(4, 'New Player', '100'), row(5, 'No Number')],
      [{ id: 1, firstName: 'Existing', lastName: 'Player', usbc: '200' } as never],
      [{ row: 6, reason: 'Missing first or last name' }],
    )
    expect(importPreviewCounts(rows)).toMatchObject({ new: 1, existing_match: 1, possible_duplicate: 1, warning: 1, invalid: 1 })
    expect(rows.filter(item => item.selected)).toHaveLength(2)
  })
})
