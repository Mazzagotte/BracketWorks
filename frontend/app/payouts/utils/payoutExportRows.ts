export type AggregatedWinner = {
  player_id: number
  player_name: string
  total_won: number
  winnings: Array<{
    bracket_name: string
    position: string
    payout_amount: number
    payout_percentage: number
    split_pot?: boolean
  }>
}

export type SidePotByPlayer = Record<string, Array<{ name: string; pool: number }>>

export type PayoutExportRow = {
  rank: number
  playerName: string
  bracketTotal: number
  sidePotTotal: number
  totalWon: number
  scratchCount: number
  handicapCount: number
  otherCount: number
  isPaid: boolean
}

export function buildSidePotByPlayer(
  summaries: Array<{ name: string; pool: number; winnerId: string | number | null }>,
): SidePotByPlayer {
  const map: SidePotByPlayer = {}
  for (const pot of summaries) {
    if (pot.winnerId == null) continue
    const key = String(pot.winnerId)
    if (!map[key]) map[key] = []
    map[key].push({ name: pot.name, pool: pot.pool })
  }
  return map
}

export function buildPayoutExportRows(
  winners: AggregatedWinner[],
  sidePotByPlayer: SidePotByPlayer,
  paidKeys: Set<string>,
): PayoutExportRow[] {
  return winners.map((winner, index) => {
    const key = String(winner.player_id ?? winner.player_name)
    const sidePotWins = sidePotByPlayer[String(winner.player_id)] ?? []
    const sidePotTotal = sidePotWins.reduce((sum, pot) => sum + pot.pool, 0)
    const scratchWins = winner.winnings.filter(w => w.bracket_name?.toLowerCase().includes('scratch'))
    const handicapWins = winner.winnings.filter(w => w.bracket_name?.toLowerCase().includes('handicap'))
    const otherWins = winner.winnings.filter(w =>
      !w.bracket_name?.toLowerCase().includes('scratch') &&
      !w.bracket_name?.toLowerCase().includes('handicap'),
    )

    const bracketTotal = Math.round(winner.total_won)
    const roundedSidePotTotal = Math.round(sidePotTotal)

    return {
      rank: index + 1,
      playerName: winner.player_name,
      bracketTotal,
      sidePotTotal: roundedSidePotTotal,
      totalWon: bracketTotal + roundedSidePotTotal,
      scratchCount: scratchWins.length,
      handicapCount: handicapWins.length,
      otherCount: otherWins.length,
      isPaid: paidKeys.has(key),
    }
  })
}
