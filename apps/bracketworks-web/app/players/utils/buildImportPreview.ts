import type { Player } from '../types'
import type { ImportablePlayer, SkippedImportRow } from './importPlayers'

export type ImportCategory = 'new' | 'existing_match' | 'possible_duplicate' | 'invalid' | 'warning' | 'skipped'

export interface ImportPreviewRow {
  id: string
  sourceRow: number
  category: ImportCategory
  reason: string
  selected: boolean
  player?: ImportablePlayer
}

const normalizedName = (firstName: string, lastName: string) => `${firstName} ${lastName}`.trim().toLowerCase().replace(/\s+/g, ' ')

export function buildImportPreview(imported: ImportablePlayer[], existing: Player[], skipped: SkippedImportRow[]): ImportPreviewRow[] {
  const rows: ImportPreviewRow[] = skipped.map((row, index) => ({
    id: `skipped-${row.row}-${index}`,
    sourceRow: row.row,
    category: row.reason.toLowerCase().includes('missing') || row.reason.toLowerCase().includes('could not') ? 'invalid' : 'skipped',
    reason: row.reason,
    selected: false,
  }))
  const existingKeys = new Set(existing.map(player => player.usbc
    ? `usbc:${String(player.usbc).trim().toLowerCase()}`
    : `name:${normalizedName(player.firstName, player.lastName)}`))
  const existingNames = new Set(existing.map(player => normalizedName(player.firstName, player.lastName)))
  const seenKeys = new Set<string>()

  for (const player of imported) {
    let category: ImportCategory = 'new'
    let reason = 'Ready to import'
    let selected = true
    if (existingKeys.has(player.importKey)) {
      category = 'existing_match'; reason = 'Matches an existing tournament entry'; selected = false
    } else if (seenKeys.has(player.importKey) || existingNames.has(player.normalizedName)) {
      category = 'possible_duplicate'; reason = seenKeys.has(player.importKey) ? 'Duplicate within uploaded file' : 'Name resembles an existing entry'; selected = false
    } else if (!player.usbc || player.average <= 0) {
      category = 'warning'; reason = !player.usbc ? 'USBC number is missing' : 'Average should be reviewed'
    }
    seenKeys.add(player.importKey)
    rows.push({ id: `player-${player.sourceRow}`, sourceRow: player.sourceRow, category, reason, selected, player })
  }
  return rows.sort((left, right) => left.sourceRow - right.sourceRow)
}

export function importPreviewCounts(rows: ImportPreviewRow[]): Record<ImportCategory, number> {
  return rows.reduce((counts, row) => ({ ...counts, [row.category]: counts[row.category] + 1 }), {
    new: 0, existing_match: 0, possible_duplicate: 0, invalid: 0, warning: 0, skipped: 0,
  })
}
