import { describe, expect, it, vi } from 'vitest'

import { buildPayoutPdfHtml } from './payoutPdfExport'
import type { PayoutExportRow } from './payoutExportRows'

const buildRows = (count: number): PayoutExportRow[] =>
  Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    playerName: `Winner ${index + 1}`,
    bracketTotal: 100 + index,
    sidePotTotal: index === 0 ? 36 : 0,
    totalWon: 100 + index + (index === 0 ? 36 : 0),
    scratchCount: 1,
    handicapCount: 0,
    otherCount: 0,
    isPaid: index === 0,
  }))

const buildHtml = (rows: PayoutExportRow[]) => buildPayoutPdfHtml({
  rows,
  tournamentName: 'Brass Monkey Idaho State Championship With A Long Name',
  squadLabel: 'May 30, 2026 | 10:00 AM',
  generatedAt: 'Sep 11, 2026, 3:57 PM',
  paidStampDate: 'Sep 11, 2026',
  logoUrl: '/logo_no_text.svg',
  programs: "Handicap | Scratch | Reverse Scratch | Women's Handicap | High Game Scratch",
  totalBrackets: 37,
  totalEntries: 296,
})

describe('buildPayoutPdfHtml', () => {
  it('renders the payout document summary, checkboxes, and verification fields', () => {
    const html = buildHtml(buildRows(3))

    expect(html).toContain('PENDING VERIFICATION')
    expect(html).toContain('Official Tournament Payout Sheet')
    expect(html).toContain('37')
    expect(html).toContain('Brackets')
    expect(html).toContain('296')
    expect(html).toContain('Entries')
    expect(html).toContain('3')
    expect(html).toContain('Winners')
    expect(html).toContain('1 / 3')
    expect(html).toContain('Bracket Payouts')
    expect(html).toContain('Side Pots')
    expect(html).toContain('Total Payout')
    expect(html).toContain('&#9745;')
    expect(html).toContain('&#9744;')
    expect(html).toContain('Commissioner / Tournament Director Signature')
    expect(html).toContain('Final Paid Count')
  })

  it('uses continuation sheets for larger payout lists', () => {
    const html = buildHtml(buildRows(51))

    expect(html.match(/class="sheet(?:\s|")/g)).toHaveLength(3)
    expect(html.match(/Payout Distribution &mdash; Continued/g)).toHaveLength(2)
    expect(html).not.toContain('class="sheet verification-sheet')
  })

  it('keeps short payout lists and verification on one sheet', () => {
    const html = buildHtml(buildRows(1))

    expect(html.match(/class="sheet(?:\s|")/g)).toHaveLength(1)
    expect(html).toContain('Final Paid Count')
    expect(html).toContain('______ / 1')
  })

  it('moves verification to a dedicated page when the final payout page is full', () => {
    const html = buildHtml(buildRows(20))

    expect(html.match(/class="sheet(?:\s|")/g)).toHaveLength(2)
    expect(html).toContain('class="sheet verification-sheet continuation-sheet"')
    expect(html).toContain('Payout Distribution &mdash; Continued')
  })

  it('logs a development warning when row totals do not reconcile', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    buildHtml([{ ...buildRows(1)[0]!, totalWon: 999 }])

    expect(warnSpy).toHaveBeenCalledWith('Payout export totals do not reconcile.', expect.objectContaining({
      bracketPayouts: 100,
      sidePotPayouts: 36,
      totalPayout: 999,
      reconciledTotal: 136,
    }))

    warnSpy.mockRestore()
  })
})