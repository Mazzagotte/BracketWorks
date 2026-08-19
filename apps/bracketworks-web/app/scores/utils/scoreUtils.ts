import { Player, Squad, Tournament } from '../../lib/types'
import type { PlayerScoreStatus, ScoreValidation } from '../types'

// ─── Excel helpers ────────────────────────────────────────────────────────────

export function buildSafeFileName(
  tournamentName: string | undefined,
  squad: Squad | null | undefined,
  suffix: string,
): string {
  const safeTournament = (tournamentName || suffix)
    .replace(/[^a-zA-Z0-9\-_ ]+/g, '')
    .trim()
    .replace(/\s+/g, '_') || suffix
  const safeSquad = squad
    ? `${squad.date || ''}_${squad.time || ''}`.replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_')
    : 'all_squads'
  const dateStamp = new Date().toISOString().slice(0, 10)
  return `${safeTournament}_${safeSquad}_${suffix}_${dateStamp}.xlsx`
}

export async function buildScoresExcelBuffer(
  players: Player[],
  tournament: Tournament | null,
  squad: Squad | null,
): Promise<{ buffer: ArrayBuffer; fileName: string; rowCount: number }> {
  const { Workbook } = await import('exceljs')
  const rows = players.map(player => ({
    'Player ID': player.id,
    'First Name': player.firstName || '',
    'Last Name': player.lastName || '',
    'Lane': player.lane || '',
    'Average': Number(player.average || 0),
    'Handicap': Number(player.handicap || 0),
    'Game 1 Scratch': player.scores?.game1_scratch ?? '',
    'Game 2 Scratch': player.scores?.game2_scratch ?? '',
    'Game 3 Scratch': player.scores?.game3_scratch ?? '',
    'Total Scratch': calculateTotalScratch(player),
    'Total With Handicap': calculateDisplayTotal(player),
  }))

  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Scores')
  if (rows.length > 0 && rows[0]) {
    worksheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key }))
    worksheet.addRows(rows)
  }

  const buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer
  const fileName = buildSafeFileName(tournament?.name, squad, 'scores')
  return { buffer, fileName, rowCount: rows.length }
}

export type ParsedScoreRow = {
  playerId?: number
  firstName: string
  lastName: string
  game1_scratch?: number
  game2_scratch?: number
  game3_scratch?: number
}

export async function parseScoresExcelFile(file: File): Promise<ParsedScoreRow[]> {
  const { Workbook } = await import('exceljs')
  const buffer = await file.arrayBuffer()
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []

  const headers: string[] = []
  const rawRows: Record<string, unknown>[] = []
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = (row.values as unknown[]).slice(1)
    if (rowNumber === 1) {
      cells.forEach(cell => headers.push(String(cell ?? '')))
    } else {
      const obj: Record<string, unknown> = {}
      headers.forEach((header, i) => { obj[header] = cells[i] ?? '' })
      rawRows.push(obj)
    }
  })

  return rawRows.map(rawRow => {
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawRow)) {
      normalized[normalizeHeader(key)] = value
    }

    const fullName = String(normalized.name || normalized.bowlername || '').trim()
    let firstName = String(normalized.firstname || normalized.first || '').trim()
    let lastName = String(normalized.lastname || normalized.last || '').trim()
    if ((!firstName || !lastName) && fullName) {
      const parts = fullName.split(/\s+/).filter(Boolean)
      firstName = firstName || parts[0] || ''
      lastName = lastName || parts.slice(1).join(' ')
    }

    return {
      playerId: parsePlayerId(normalized.playerid || normalized.id || normalized.bowlerid),
      firstName,
      lastName,
      game1_scratch: parseScoreNumber(normalized.game1scratch),
      game2_scratch: parseScoreNumber(normalized.game2scratch),
      game3_scratch: parseScoreNumber(normalized.game3scratch),
    }
  })
}

// ─── Score math ───────────────────────────────────────────────────────────────


export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s\-#]+/g, '')
}

export function parseScoreNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim()
  if (raw === '') return undefined
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.round(parsed)
  if (rounded < 0 || rounded > 300) return undefined
  return rounded
}

export function parsePlayerId(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  const raw = String(value).trim()
  if (raw === '') return undefined
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined
  return parsed
}

export function calculateTotalScratch(player: Player): number {
  const scores = player.scores || {}
  return (scores.game1_scratch || 0) + (scores.game2_scratch || 0) + (scores.game3_scratch || 0)
}

export function calculateTotalWithHandicap(player: Player): number {
  const scores = player.scores || {}
  const scratch = (scores.game1_scratch || 0) + (scores.game2_scratch || 0) + (scores.game3_scratch || 0)
  const gamesPlayed = [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch].filter(
    s => s !== undefined && s !== null,
  ).length
  return scratch + ((player.handicap ?? 0) * gamesPlayed)
}

export function getGameTotal(scratchScore: number | undefined, handicap: number | undefined): string {
  const handicapValue = handicap ?? 0
  if (scratchScore === undefined || scratchScore === null) {
    return handicapValue > 0 ? `+${handicapValue} handicap` : ''
  }
  return `${scratchScore + handicapValue} total`
}

export function calculateDisplayTotal(player: Player): string | number {
  const scores = player.scores || {}
  const games = [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch]
  const played = games.filter(s => s !== undefined && s !== null)
  if (played.length === 0) return ''
  const scratch = played.reduce((sum, s) => sum + (s || 0), 0)
  return scratch + ((player.handicap ?? 0) * played.length)
}

// ─── Validation helpers ───────────────────────────────────────────────────────

export function validateScore(score: number | undefined): ScoreValidation {
  if (score === undefined || score === null) return { isValid: true, message: '' }
  if (score < 0) return { isValid: false, message: 'Score cannot be negative' }
  if (score > 300) return { isValid: false, message: 'Score cannot exceed 300' }
  return { isValid: true, message: '' }
}

export function getScoreInputClass(score: number | undefined): string {
  const validation = validateScore(score)
  if (!validation.isValid) return 'score-input invalid'
  if (score === 300) return 'score-input perfect'
  return 'score-input'
}

export function hasMissingScore(player: Player): boolean {
  const scores = player.scores || {}
  return scores.game1_scratch == null || scores.game2_scratch == null || scores.game3_scratch == null
}

export function needsReviewScore(player: Player): boolean {
  const scores = player.scores || {}
  return [scores.game1_scratch, scores.game2_scratch, scores.game3_scratch].some(score => (score || 0) >= 250)
}

export function getPlayerScoreStatus(player: Player): PlayerScoreStatus {
  const gameScores = [
    player.scores?.game1_scratch,
    player.scores?.game2_scratch,
    player.scores?.game3_scratch,
  ]
  const enteredGames = gameScores.filter(score => score != null).length
  if (enteredGames === gameScores.length) return { label: 'Complete', tone: 'complete' }
  if (enteredGames > 0) return { label: 'In Progress', tone: 'progress' }
  return { label: 'Not Started', tone: 'pending' }
}
