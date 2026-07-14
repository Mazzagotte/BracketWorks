import { PayoutExportRow } from './payoutExportRows'

type BuildPayoutExcelBufferArgs = {
  rows: PayoutExportRow[]
  programs: string
  totalBrackets: number
  totalEntries: number
  tournamentName: string
  squadLabel: string
  generatedAt: string
}

export async function buildPayoutExcelBuffer({
  rows,
  programs,
  totalBrackets,
  totalEntries,
  tournamentName,
  squadLabel,
  generatedAt,
}: BuildPayoutExcelBufferArgs): Promise<ArrayBuffer> {
  const hasSidePotCol = rows.some(row => row.sidePotTotal > 0)
  const totalBracketsAmt = rows.reduce((sum, row) => sum + row.bracketTotal, 0)
  const totalSidePotsAmt = rows.reduce((sum, row) => sum + row.sidePotTotal, 0)
  const totalAll = totalBracketsAmt + totalSidePotsAmt
  const paidCount = rows.filter(row => row.isPaid).length

  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const ws = workbook.addWorksheet('Payouts')

  const C_ORANGE = 'FFFF7A00'
  const C_ORANGE_DK = 'FF9A4A00'
  const C_INK = 'FF111827'
  const C_MUTED = 'FF4B5563'
  const C_LINE = 'FFD6DAE1'
  const C_SOFT = 'FFF7F8FA'
  const C_WHITE = 'FFFFFFFF'
  const C_SUCCESS_FG = 'FF166534'
  const C_ALT = 'FFFAFAFA'
  const C_PAID_SOFT = 'FFF8FAFC'

  const numCols = hasSidePotCol ? 6 : 4
  ws.getColumn(1).width = 6
  ws.getColumn(2).width = 30
  if (hasSidePotCol) {
    ws.getColumn(3).width = 14
    ws.getColumn(4).width = 14
    ws.getColumn(5).width = 14
    ws.getColumn(6).width = 10
  } else {
    ws.getColumn(3).width = 14
    ws.getColumn(4).width = 10
  }

  let r = 1
  const merge = (row: number, c1: number, c2: number) => {
    if (c2 > c1) ws.mergeCells(row, c1, row, c2)
  }

  const orangeRailBorder = {
    left: { style: 'medium' as const, color: { argb: C_ORANGE } },
    bottom: { style: 'thin' as const, color: { argb: C_LINE } },
  }

  merge(r, 1, numCols)
  const titleCell = ws.getRow(r).getCell(1)
  titleCell.value = 'BracketWorks - Payout Distribution'
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: C_INK } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_WHITE } }
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' }
  titleCell.border = {
    left: { style: 'medium', color: { argb: C_ORANGE } },
    bottom: { style: 'medium', color: { argb: C_ORANGE } },
  }
  ws.getRow(r).height = 28
  r++

  merge(r, 1, numCols)
  const nameCell = ws.getRow(r).getCell(1)
  nameCell.value = tournamentName
  nameCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: C_INK } }
  nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
  nameCell.alignment = { horizontal: 'left', vertical: 'middle' }
  nameCell.border = orangeRailBorder
  ws.getRow(r).height = 22
  r++

  merge(r, 1, numCols)
  const squadCell = ws.getRow(r).getCell(1)
  squadCell.value = squadLabel
  squadCell.font = { name: 'Calibri', size: 10, color: { argb: C_MUTED } }
  squadCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
  squadCell.alignment = { horizontal: 'left', vertical: 'middle' }
  squadCell.border = orangeRailBorder
  ws.getRow(r).height = 18
  r++

  merge(r, 1, numCols)
  const genCell = ws.getRow(r).getCell(1)
  genCell.value = `Generated: ${generatedAt}`
  genCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C_MUTED } }
  genCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
  genCell.alignment = { horizontal: 'left', vertical: 'middle' }
  genCell.border = orangeRailBorder
  ws.getRow(r).height = 16
  r++

  ws.getRow(r).height = 6
  r++

  const detailData: [string, string][] = [
    ['Programs', programs],
    ['Total Brackets', String(totalBrackets)],
    ['Total Entries', String(totalEntries)],
    ['Prize Pool', `$${totalAll.toLocaleString()}`],
    ['Winners', String(rows.length)],
    ['Total Payout', `$${totalAll.toLocaleString()}`],
    ['Paid', `${paidCount} / ${rows.length}`],
  ]

  for (const [label, value] of detailData) {
    merge(r, 1, 2)
    merge(r, 3, numCols)
    const labelCell = ws.getRow(r).getCell(1)
    const valueCell = ws.getRow(r).getCell(3)
    labelCell.value = label
    labelCell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: C_MUTED } }
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
    labelCell.alignment = { horizontal: 'right', vertical: 'middle' }
    labelCell.border = {
      left: { style: 'medium', color: { argb: C_ORANGE } },
      bottom: { style: 'hair', color: { argb: C_LINE } },
    }
    valueCell.value = value
    valueCell.font = { name: 'Calibri', size: 10, color: { argb: C_INK } }
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_SOFT } }
    valueCell.alignment = { horizontal: 'left', vertical: 'middle' }
    valueCell.border = { bottom: { style: 'hair', color: { argb: C_LINE } } }
    ws.getRow(r).height = 18
    r++
  }

  ws.getRow(r).height = 6
  r++

  const headers = hasSidePotCol
    ? ['#', 'Player Name', 'Brackets', 'Side Pots', 'Amount', 'Paid']
    : ['#', 'Player Name', 'Amount', 'Paid']
  const headerRow = ws.getRow(r)
  headers.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: C_ORANGE_DK } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C_WHITE } }
    cell.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'medium', color: { argb: C_ORANGE } },
      ...(i === 0 ? { left: { style: 'medium' as const, color: { argb: C_ORANGE } } } : {}),
    }
  })
  headerRow.height = 20
  r++

  const usdFmt = '$#,##0'
  rows.forEach((row, idx) => {
    const dataRow = ws.getRow(r)
    const rowBg = row.isPaid ? C_PAID_SOFT : idx % 2 === 1 ? C_ALT : C_WHITE
    const values: Array<string | number> = hasSidePotCol
      ? [row.rank, row.playerName, row.bracketTotal, row.sidePotTotal, row.totalWon, row.isPaid ? 'Paid' : '']
      : [row.rank, row.playerName, row.totalWon, row.isPaid ? 'Paid' : '']

    values.forEach((value, i) => {
      const cell = dataRow.getCell(i + 1)
      cell.value = value
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
      cell.border = {
        bottom: { style: 'hair', color: { argb: C_LINE } },
        ...(i === 0 ? { left: { style: 'medium' as const, color: { argb: C_ORANGE } } } : {}),
      }

      const isCurrencyCol = hasSidePotCol ? i >= 2 && i <= 4 : i === 2
      if (isCurrencyCol && typeof value === 'number') {
        cell.numFmt = usdFmt
        cell.font = { name: 'Calibri', size: 10, color: { argb: C_INK } }
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else if ((hasSidePotCol && i === 5) || (!hasSidePotCol && i === 3)) {
        cell.font = { name: 'Calibri', size: 10, bold: row.isPaid, color: { argb: row.isPaid ? C_SUCCESS_FG : C_MUTED } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      } else {
        cell.font = { name: 'Calibri', size: 10, color: { argb: C_INK } }
        cell.alignment = { horizontal: i === 1 ? 'left' : 'center', vertical: 'middle' }
      }
    })
    dataRow.height = 18
    r++
  })

  r++
  merge(r, 1, numCols)
  const footerCell = ws.getRow(r).getCell(1)
  footerCell.value = 'BracketWorks  ·  bracketworks.app'
  footerCell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: C_MUTED } }
  footerCell.alignment = { horizontal: 'center' }

  return workbook.xlsx.writeBuffer()
}
