import { BracketProgramDefinition, SidePotsSettings, Tournament } from '../../lib/types'
import { calculatePlayerTotalCost, normalizeDivision, normalizePlayerBracketEntries } from '../../lib/bracketPrograms'
import { Player, Squad } from '../types'

export async function buildEntriesExcelBuffer(
  players: Player[],
  enabledBracketPrograms: BracketProgramDefinition[],
  sidePots: SidePotsSettings | null,
  tournament: Tournament | null,
  squad: Squad | null,
): Promise<{ buffer: ArrayBuffer; fileName: string }> {
  const { Workbook } = await import('exceljs')
  const enabledSidePots = (sidePots?.pots ?? []).filter(pot => pot.enabled)

  const rows = players.map(player => {
    const row: Record<string, string | number> = {
      'USBC': player.usbc || '',
      'First Name': player.firstName || '',
      'Last Name': player.lastName || '',
      'Division': normalizeDivision(player.division),
      'Lane': player.lane?.toString() || '',
      'Average': Number(player.average || 0),
    }
    enabledBracketPrograms.forEach(program => {
      row[program.name] = Number(player.bracketEntries?.[program.key] || 0)
    })
    enabledSidePots.forEach(pot => {
      row[pot.name] = player.sidePotEntries?.[pot.key] ? 'Yes' : 'No'
    })
    const totalEntries = Object.values(player.bracketEntries || {}).reduce((sum, count) => sum + Number(count || 0), 0)
    const needsEntryFee = totalEntries > 0 && player.totalCost <= 0
    const isPaid = !needsEntryFee && player.amountPaid >= player.totalCost
    row['Total Cost'] = Number(player.totalCost || 0)
    row['Status'] = needsEntryFee ? 'SET FEE' : isPaid ? 'PAID' : 'DUE'
    row['Amount Paid'] = Number(player.amountPaid || 0)
    return row
  })

  const workbook = new Workbook()
  const worksheet = workbook.addWorksheet('Entries')
  if (rows.length > 0 && rows[0]) {
    worksheet.columns = Object.keys(rows[0]).map(key => ({ header: key, key }))
    worksheet.addRows(rows)
  }

  const safeTournament = (tournament?.name || 'entries')
    .replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_') || 'entries'
  const safeSquad = squad
    ? `${squad.date || ''}_${squad.time || ''}`.replace(/[^a-zA-Z0-9\-_ ]+/g, '').trim().replace(/\s+/g, '_')
    : 'all_squads'
  const dateStamp = new Date().toISOString().slice(0, 10)
  const fileName = `${safeTournament}_${safeSquad}_entries_${dateStamp}.xlsx`

  const buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer
  return { buffer, fileName }
}

export type ImportablePlayer = Omit<Player, 'id'> & {
  sourceRow: number
  normalizedName: string
  importKey: string
}

export type SkippedImportRow = {
  row: number
  reason: string
  name?: string
}

export function parseNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function getValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key]
  }
  return undefined
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\s\-#]+/g, '')
}

export function buildImportIdentity(firstName: string, lastName: string, usbc: string): string {
  const normalizedUsbc = String(usbc || '').trim().toLowerCase()
  if (normalizedUsbc) {
    return `usbc:${normalizedUsbc}`
  }
  return `name:${`${firstName} ${lastName}`.trim().toLowerCase()}`
}

const importedNameSuffixes = new Set([
  'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v',
  'md', 'm.d.', 'phd', 'ph.d.', 'dds', 'dmd', 'esq', 'esquire',
])

export function parseImportedFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed) return { firstName: '', lastName: '' }

  const stripTrailingMiddleInitial = (firstNameValue: string) => {
    const parts = firstNameValue.split(/\s+/).filter(Boolean)
    if (parts.length <= 1) return firstNameValue.trim()
    const trailingToken = parts[parts.length - 1] ?? ''
    if (/^[a-z]\.??$/i.test(trailingToken)) {
      return parts.slice(0, -1).join(' ').trim()
    }
    return firstNameValue.trim()
  }

  if (trimmed.includes(',')) {
    const segments = trimmed.split(',').map(segment => segment.trim()).filter(Boolean)
    if (segments.length >= 2) {
      const trailingSegment = (segments[segments.length - 1] ?? '').toLowerCase()
      const hasTrailingSuffix = segments.length >= 3 && importedNameSuffixes.has(trailingSegment)
      const rawFirstName = (hasTrailingSuffix ? segments.slice(1, -1) : segments.slice(1)).join(' ').trim()
      return {
        firstName: stripTrailingMiddleInitial(rawFirstName),
        lastName: [segments[0], ...(hasTrailingSuffix ? [segments[segments.length - 1]] : [])].join(' ').trim(),
      }
    }
  }

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' }

  const lastToken = (parts[parts.length - 1] ?? '').toLowerCase()
  if (parts.length >= 3 && importedNameSuffixes.has(lastToken)) {
    return {
      firstName: parts.slice(0, -2).join(' ').trim(),
      lastName: parts.slice(-2).join(' ').trim(),
    }
  }

  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ').trim(),
  }
}

export async function parseExcelPlayers(
  file: File,
  bracketPrograms: BracketProgramDefinition[],
  entryFee: number,
): Promise<{ players: ImportablePlayer[]; skippedRows: SkippedImportRow[] }> {
  const { Workbook } = await import('exceljs')
  const buffer = await file.arrayBuffer()
  const workbook = new Workbook()
  await workbook.xlsx.load(buffer)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return { players: [], skippedRows: [{ row: 1, reason: 'No worksheet found' }] }

  const sheetRows: unknown[][] = []
  worksheet.eachRow({ includeEmpty: true }, row => {
    sheetRows.push((row.values as unknown[]).slice(1).map(v => (v === null || v === undefined ? '' : v)))
  })

  const detectHeaderRowIndex = (rows: unknown[][]): number => {
    for (let index = 0; index < rows.length; index += 1) {
      const normalizedCells = (rows[index] ?? [])
        .map(cell => normalizeHeader(String(cell || '')))
        .filter(Boolean)
      if (normalizedCells.length === 0) continue

      const hasName = normalizedCells.includes('name') || normalizedCells.includes('bowlername')
      const hasSplitName = normalizedCells.includes('firstname') || normalizedCells.includes('lastname')
      const hasAvg = normalizedCells.includes('avg') || normalizedCells.includes('average')

      if ((hasName || hasSplitName) && hasAvg) {
        return index
      }
    }
    return -1
  }

  const headerRowIndex = detectHeaderRowIndex(sheetRows)
  if (headerRowIndex < 0) {
    return {
      players: [],
      skippedRows: [{ row: 1, reason: 'Could not detect header row (expected Name/First/Last and Avg columns)' }],
    }
  }

  const headerCells = (sheetRows[headerRowIndex] || []).map(cell => normalizeHeader(String(cell || '')))
  const players: ImportablePlayer[] = []
  const skippedRows: SkippedImportRow[] = []

  for (let rowIndex = headerRowIndex + 1; rowIndex < sheetRows.length; rowIndex += 1) {
    const sourceRow = rowIndex + 1
    const sourceCells = sheetRows[rowIndex] || []

    if (sourceCells.every(cell => String(cell ?? '').trim() === '')) {
      continue
    }

    const nr: Record<string, unknown> = {}
    for (let colIndex = 0; colIndex < headerCells.length; colIndex += 1) {
      const key = headerCells[colIndex]
      if (!key) continue
      nr[key] = sourceCells[colIndex]
    }

    const fullName = String(getValue(nr, ['name', 'bowlername']) || '').trim()
    let firstName = String(getValue(nr, ['firstname', 'first', 'givenname', 'fname']) || '').trim()
    let lastName = String(getValue(nr, ['lastname', 'last', 'surname', 'familyname', 'lname']) || '').trim()

    if ((!firstName || !lastName) && fullName) {
      const parsedName = parseImportedFullName(fullName)
      firstName = firstName || parsedName.firstName || ''
      lastName = lastName || parsedName.lastName || ''
    }

    if (!firstName || !lastName) {
      skippedRows.push({
        row: sourceRow,
        reason: 'Missing first or last name',
        name: fullName || `${firstName} ${lastName}`.trim() || undefined,
      })
      continue
    }

    const handicap = Math.max(0, Math.floor(parseNumber(getValue(nr, ['handicap', 'handicapentries', 'handicapbrackets']), 0)))
    const scratch = Math.max(0, Math.floor(parseNumber(getValue(nr, ['scratch', 'scratchentries', 'scratchbrackets']), 0)))
    const bracketEntries = normalizePlayerBracketEntries(undefined, handicap, scratch)
    const normalizedName = `${firstName} ${lastName}`.trim().toLowerCase()
    const usbc = String(getValue(nr, ['usbc', 'usbcnumber', 'nationalid']) || '').trim()
    const importKey = buildImportIdentity(firstName, lastName, usbc)

    players.push({
      firstName,
      lastName,
      usbc,
      average: Math.max(0, Math.floor(parseNumber(getValue(nr, ['average', 'avg']), 150))),
      handicap,
      scratch,
      bracketEntries,
      lane: String(getValue(nr, ['lane']) || 'A1').trim() || 'A1',
      amountPaid: Math.max(0, parseNumber(getValue(nr, ['amountpaid', 'paid', 'payment']), 0)),
      totalCost: calculatePlayerTotalCost(bracketEntries, bracketPrograms, entryFee),
      sourceRow,
      normalizedName,
      importKey,
    })
  }

  return { players, skippedRows }
}
