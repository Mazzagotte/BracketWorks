import { describe, expect, it } from 'vitest'

import { buildPayoutExportRows, buildSidePotByPlayer } from './payoutExportRows'

describe('payoutExportRows', () => {
  it('groups side-pot pools by winner id', () => {
    const byPlayer = buildSidePotByPlayer([
      {
        name: 'High Game',
        pool: 120,
        status: 'complete',
        winners: [{ playerId: '11' }],
      },
      {
        name: 'High Series',
        pool: 80,
        status: 'complete',
        winners: [{ playerId: '11' }],
      },
      {
        name: 'Clean Game',
        pool: 50,
        status: 'complete',
        winners: [{ playerId: '22' }],
      },
      {
        name: 'Tied Pot',
        pool: 25,
        status: 'tied',
        winners: [{ playerId: '11' }, { playerId: '22' }],
      },
      { name: 'Pending Pot', pool: 15, status: 'pending', winners: [] },
    ])

    expect(byPlayer['11']).toEqual([
      { name: 'High Game', pool: 120 },
      { name: 'High Series', pool: 80 },
    ])
    expect(byPlayer['22']).toEqual([{ name: 'Clean Game', pool: 50 }])
    expect(byPlayer.null).toBeUndefined()
  })

  it('builds payout rows with rounded totals and program win counts', () => {
    const rows = buildPayoutExportRows(
      [
        {
          player_id: 11,
          player_name: 'Alex Lane',
          total_won: 134.7,
          winnings: [
            { bracket_name: 'Scratch A', position: '1st', payout_amount: 80, payout_percentage: 60 },
            { bracket_name: 'Handicap A', position: '2nd', payout_amount: 54.7, payout_percentage: 40 },
            { bracket_name: 'Open Bonus', position: '1st', payout_amount: 0, payout_percentage: 0 },
          ],
        },
      ],
      {
        '11': [
          { name: 'High Game', pool: 49.5 },
          { name: 'High Series', pool: 50.4 },
        ],
      },
      new Set(['11']),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      rank: 1,
      playerName: 'Alex Lane',
      bracketTotal: 135,
      sidePotTotal: 100,
      totalWon: 235,
      scratchCount: 1,
      handicapCount: 1,
      otherCount: 1,
      isPaid: true,
    })
  })
})
