import { describe, expect, it } from 'vitest'

import { aggregateWinnersByPlayer, buildPaymentSummary, filterWinnersByName } from './payoutViewModel'

describe('payoutViewModel', () => {
  it('aggregates winners by player and sorts by total descending', () => {
    const winners = aggregateWinnersByPlayer([
      {
        player_id: 22,
        player_name: 'Player Two',
        bracket_name: 'Scratch Bracket 1',
        position: '1st',
        payout_amount: 90,
        payout_percentage: 60,
      },
      {
        player_id: 11,
        player_name: 'Player One',
        bracket_name: 'Scratch Bracket 2',
        position: '1st',
        payout_amount: 120,
        payout_percentage: 60,
      },
      {
        player_id: 22,
        player_name: 'Player Two',
        bracket_name: 'Handicap Bracket 1',
        position: '2nd',
        payout_amount: 55,
        payout_percentage: 40,
      },
    ])

    expect(winners).toHaveLength(2)
    expect(winners[0]?.player_name).toBe('Player Two')
    expect(winners[0]?.total_won).toBe(145)
    expect(winners[0]?.winnings).toHaveLength(2)
    expect(winners[1]?.player_name).toBe('Player One')
    expect(winners[1]?.total_won).toBe(120)
  })

  it('builds paid summary and remaining amount from paid keys', () => {
    const summary = buildPaymentSummary(
      [
        { player_id: 1, player_name: 'A', total_won: 100, winnings: [] },
        { player_id: 2, player_name: 'B', total_won: 50, winnings: [] },
      ],
      new Set(['1']),
    )

    expect(summary).toEqual({
      totalUniqueWinners: 2,
      paidCount: 1,
      remainingAmount: 50,
    })
  })

  it('filters winners by first and last name fragments', () => {
    const filtered = filterWinnersByName(
      [
        { player_id: 1, player_name: 'Alex Johnson', total_won: 100, winnings: [] },
        { player_id: 2, player_name: 'Bailey Smith', total_won: 80, winnings: [] },
      ],
      'alex',
      'john',
    )

    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.player_name).toBe('Alex Johnson')
  })
})
