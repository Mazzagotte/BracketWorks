import { describe, expect, it } from 'vitest'

import type { Player } from '../types'
import type { ImportablePlayer } from './importPlayers'
import { prepareImportedPlayers } from './prepareImportedPlayers'

const imported = (overrides: Partial<ImportablePlayer> = {}): ImportablePlayer => ({
  sourceRow: 2,
  normalizedName: 'jane doe',
  importKey: 'usbc:12345',
  firstName: 'Jane',
  lastName: 'Doe',
  usbc: '12345',
  average: 180,
  handicap: 1,
  scratch: 0,
  bracketEntries: { handicap: 1 },
  sidePotEntries: {},
  lane: 'A1',
  totalCost: 25,
  amountPaid: 0,
  ...overrides,
})

const existing = (overrides: Partial<Player> = {}): Player => ({
  id: 1, firstName: 'Existing', lastName: 'Bowler', usbc: '77777', average: 180,
  handicap: 0, scratch: 0, bracketEntries: {}, lane: 'A1', totalCost: 0, amountPaid: 0,
  ...overrides,
})

describe('prepareImportedPlayers', () => {
  it('deduplicates rows inside an import file', () => {
    const result = prepareImportedPlayers([imported({ sourceRow: 4 }), imported({ sourceRow: 7 })], [])
    expect(result.playersToImport).toHaveLength(1)
    expect(result.skippedRows[0]?.reason).toBe('Duplicate within file (first seen at row 4)')
  })

  it('skips entries already present in the active table', () => {
    const result = prepareImportedPlayers([imported({ importKey: 'usbc:77777', usbc: '77777' })], [existing()])
    expect(result.playersToImport).toEqual([])
    expect(result.skippedRows[0]?.reason).toBe('Already exists in entries table')
  })
})
