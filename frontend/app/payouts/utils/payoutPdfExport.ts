import { PayoutExportRow } from './payoutExportRows'

type BuildPayoutPdfHtmlArgs = {
  rows: PayoutExportRow[]
  tournamentName: string
  squadLabel: string
  generatedAt: string
  paidStampDate: string
  logoUrl: string
  programs: string
  totalBrackets: number
  totalEntries: number
}

const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatUsd = (value: number): string => {
  const rounded = Math.round(Number(value) || 0)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded)
}

export function buildPayoutPdfHtml({
  rows,
  tournamentName,
  squadLabel,
  generatedAt,
  paidStampDate,
  logoUrl,
  programs,
  totalBrackets,
  totalEntries,
}: BuildPayoutPdfHtmlArgs): string {
  const hasSidePotCol = rows.some(row => row.sidePotTotal > 0)
  const totalBracketsAmount = rows.reduce((sum, row) => sum + row.bracketTotal, 0)
  const totalSidePotsAmount = rows.reduce((sum, row) => sum + row.sidePotTotal, 0)
  const totalAll = totalBracketsAmount + totalSidePotsAmount
  const paidCount = rows.filter(row => row.isPaid).length
  const useDoubleCol = rows.length > 20

  const buildTableRows = (slice: PayoutExportRow[]): string => {
    return slice
      .map(row => `<tr class="${row.isPaid ? 'isPaidRow' : ''}">
            <td class="rank">${row.rank}</td>
            <td class="player">${escapeHtml(row.playerName)}</td>
            ${hasSidePotCol ? `<td class="amount">${row.bracketTotal > 0 ? formatUsd(row.bracketTotal) : ''}</td>` : ''}
            ${hasSidePotCol ? `<td class="amount${row.sidePotTotal > 0 ? '' : ' empty-cell'}">${row.sidePotTotal > 0 ? formatUsd(row.sidePotTotal) : '&mdash;'}</td>` : ''}
            <td class="amount">${formatUsd(row.totalWon)}</td>
            <td class="signature-cell">${row.isPaid ? `<span class="paidStamp">PAID ${escapeHtml(paidStampDate)}</span>` : '<span class="signature-line"></span>'}</td>
          </tr>`)
      .join('')
  }

  const buildTable = (slice: PayoutExportRow[]): string => `
        <table>
          <thead><tr>
            <th class="rank">#</th>
            <th>Player Name</th>
            ${hasSidePotCol ? '<th class="amount">Brackets</th>' : ''}
            ${hasSidePotCol ? '<th class="amount">Side Pots</th>' : ''}
            <th class="amount">Amount</th>
            <th class="signature-cell">Signature</th>
          </tr></thead>
          <tbody>${buildTableRows(slice)}</tbody>
        </table>`

  let mainSection: string
  if (useDoubleCol) {
    const middle = Math.ceil(rows.length / 2)
    const leftRows = rows.slice(0, middle)
    const rightRows = rows.slice(middle)
    mainSection = `<div class="twoCol">
          <div class="col">${buildTable(leftRows)}</div>
          <div class="col">${buildTable(rightRows)}</div>
        </div>`
  } else {
    mainSection = buildTable(rows)
  }

  const detailRows =
    `<div class="detail-row detail-full"><span class="detail-label">Programs</span><span class="detail-value">${escapeHtml(programs)}</span></div>` +
    [
      ['Total Brackets', String(totalBrackets)],
      ['Total Entries', String(totalEntries)],
      ['Prize Pool', escapeHtml(formatUsd(totalAll))],
    ]
      .map(
        ([label, value]) =>
          `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${value}</span></div>`,
      )
      .join('')

  const statCards = [
    { label: 'Winners', value: String(rows.length) },
    { label: 'Total Payout', value: formatUsd(totalAll) },
    ...(hasSidePotCol
      ? [
          { label: 'Brackets', value: formatUsd(totalBracketsAmount) },
          { label: 'Side Pots', value: formatUsd(totalSidePotsAmount) },
        ]
      : []),
    { label: 'Paid', value: `${paidCount} / ${rows.length}` },
  ]
    .map(
      ({ label, value }) => `<div class="stat-card">
          <div class="stat-label">${label}</div>
          <div class="stat-value">${value}</div>
        </div>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Payout Distribution - ${escapeHtml(tournamentName)}</title>
  <link rel="stylesheet" href="/payouts-print.css" />
</head>
<body>
  <main class="page">
    <header class="brand-header">
      <section class="brand-left">
        <img src="${escapeHtml(logoUrl)}" alt="BracketWorks" class="logo" />
        <div>
          <h2 class="brand-name">BracketWorks</h2>
          <p class="brand-tagline">Bowling Brackets &amp; Side Pots</p>
        </div>
      </section>
      <section class="report-title">
        <h1>Payout Distribution</h1>
        <p>Official tournament payout sheet</p>
      </section>
    </header>
    <section class="event-band">
      <div class="event-band-inner">
        <h2 class="event-name">${escapeHtml(tournamentName)}</h2>
        <p class="event-meta">${escapeHtml(squadLabel)}</p>
      </div>
      <div class="generated">Generated<br />${escapeHtml(generatedAt)}</div>
    </section>
    <div class="details-band">${detailRows}</div>
    <section class="stats">${statCards}</section>
    ${mainSection}
    <div class="commissioner">
      <p class="commissioner-title">Commissioner Verification</p>
      <div class="commissioner-fields">
        <div>
          <div class="field-label">Commissioner / Tournament Director Signature</div>
          <div class="field-line"></div>
        </div>
        <div>
          <div class="field-label">Date</div>
          <div class="field-line"></div>
        </div>
      </div>
    </div>
    <footer class="footer">
      <span><strong>BracketWorks</strong> &bull; bracketworks.app</span>
      <span>Generated by BracketWorks. Payout amounts are based on tournament settings and are subject to commissioner verification. BracketWorks does not collect entry fees, hold funds, distribute winnings, or determine prize structures.</span>
    </footer>
  </main>
</body>
</html>`
}
