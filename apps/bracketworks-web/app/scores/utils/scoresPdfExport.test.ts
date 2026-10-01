import { describe, expect, it } from 'vitest'
import type { Player } from '../../lib/types'
import { buildScoresPdfHtml } from './scoresPdfExport'

const players = [{
  id: 1,
  firstName: 'Jamie',
  lastName: 'Bowlerson',
  lane: 'A1',
  handicap: 12,
  scores: {
    game1_scratch: 180,
    game1_with_handicap: 192,
    game2_scratch: 190,
    game2_with_handicap: 202,
    game3_scratch: 200,
    game3_with_handicap: 212,
  },
}] as unknown as Player[]

const baseArgs = {
  players,
  tournamentName: 'Test Tournament',
  squadLabel: 'Saturday | 10:00 AM',
  location: 'Test Center',
  generatedAt: 'Oct 1, 2026',
  logoUrl: '/logo_no_text.svg',
  scoresLocked: false,
}

describe('buildScoresPdfHtml', () => {
  it('keeps the score report values and verification section by default', () => {
    const html = buildScoresPdfHtml(baseArgs)

    expect(html).toContain('<h1>Score Distribution</h1>')
    expect(html).toContain('>180</td>')
    expect(html).toContain('Commissioner Verification')
  })

  it('creates a blank handwritten score sheet without report-only content', () => {
    const html = buildScoresPdfHtml({ ...baseArgs, blankScoreSheet: true })

    expect(html).toContain('<h1>Blank Score Sheet</h1>')
    expect(html).toContain('class="page blank-score-sheet"')
    expect(html).toContain('<td class="player">Jamie Bowlerson</td>')
    expect(html).toContain('<td class="number">12</td>')
    expect(html).not.toContain('>180</td>')
    expect(html).not.toContain('Commissioner Verification')
    expect(html).not.toContain('stat-card')
  })
})