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

type SidePotSummaryForExport = {
  name: string
  pool: number
  status?: 'empty' | 'pending' | 'complete' | 'tied'
  winners?: Array<{
    playerId?: string
    player_id?: number
  }>
  winnerId?: string | number | null
}

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
  summaries: SidePotSummaryForExport[],
): SidePotByPlayer {
  const map: SidePotByPlayer = {}
  for (const pot of summaries) {
    const winnerIds: string[] = []

    if (pot.status === 'complete' && Array.isArray(pot.winners) && pot.winners.length === 1) {
      const winner = pot.winners[0]
      const resolvedId = winner?.playerId ?? winner?.player_id
      if (resolvedId != null) {
        winnerIds.push(String(resolvedId))
      }
    } else if (!pot.status && pot.winnerId != null) {
      // Backward compatibility with legacy payloads.
      winnerIds.push(String(pot.winnerId))
    }

    if (winnerIds.length === 0) continue

    const key = winnerIds[0]
    if (!key) continue
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
