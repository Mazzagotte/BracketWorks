import { Player } from '../types'
import { ImportablePlayer, SkippedImportRow } from './importPlayers'

interface PreparedImportPlayersResult {
  skippedRows: SkippedImportRow[]
  playersToImport: Omit<Player, 'id'>[]
}

export function prepareImportedPlayers(
  importedPlayers: ImportablePlayer[],
  existingPlayers: Player[],
  initialSkippedRows: SkippedImportRow[] = [],
): PreparedImportPlayersResult {
  const skippedRows = [...initialSkippedRows]
  const seenImportedPlayers = new Map<string, number>()
  const uniqueImportedPlayers: ImportablePlayer[] = []

  // Dedupe inside the uploaded file first so operators get precise row-level feedback.
  for (const player of importedPlayers) {
    const firstSeenAt = seenImportedPlayers.get(player.importKey)
    if (firstSeenAt != null) {
      skippedRows.push({
        row: player.sourceRow,
        reason: `Duplicate within file (first seen at row ${firstSeenAt})`,
        name: `${player.firstName} ${player.lastName}${player.usbc ? ` [${player.usbc}]` : ''}`.trim(),
      })
      continue
    }
    seenImportedPlayers.set(player.importKey, player.sourceRow)
    uniqueImportedPlayers.push(player)
  }

  const existingImportKeys = new Set(existingPlayers.map(player => {
    const normalizedUsbc = String(player.usbc || '').trim().toLowerCase()
    return normalizedUsbc
      ? `usbc:${normalizedUsbc}`
      : `name:${`${player.firstName} ${player.lastName}`.trim().toLowerCase()}`
  }))

  const playersToImport: Omit<Player, 'id'>[] = []
  for (const player of uniqueImportedPlayers) {
    if (existingImportKeys.has(player.importKey)) {
      skippedRows.push({
        row: player.sourceRow,
        reason: 'Already exists in entries table',
        name: `${player.firstName} ${player.lastName}${player.usbc ? ` [${player.usbc}]` : ''}`.trim(),
      })
      continue
    }
    const { sourceRow: _sourceRow, normalizedName: _normalizedName, importKey: _importKey, ...payload } = player
    playersToImport.push(payload)
  }

  return { skippedRows, playersToImport }
}
