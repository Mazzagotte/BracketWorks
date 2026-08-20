import { useMemo } from 'react'

import { PayoutSummary } from './usePayouts'

export type SidePotSummary = {
  key: string
  name: string
  entryCount: number
  pool: number
  status: 'empty' | 'pending' | 'complete' | 'tied'
  winningMetric: number | null
  winners: Array<{
    playerId: string
    playerName: string
  }>
  winnerId: string | null
  winnerName: string | null
  winnerMetric: number | null
}

export type SidePotAccounting = {
  totalPool: number
  summaries: SidePotSummary[]
}

const EMPTY_SIDE_POT_ACCOUNTING: SidePotAccounting = {
  totalPool: 0,
  summaries: [],
}

export function useSidePotAccounting(
  payoutData: PayoutSummary | null,
): SidePotAccounting {
  return useMemo(() => {
    const sidePots = payoutData?.side_pots
    if (!sidePots) {
      return EMPTY_SIDE_POT_ACCOUNTING
    }

    const summaries: SidePotSummary[] = (sidePots.summaries ?? []).map((summary) => ({
      key: summary.key,
      name: summary.name,
      entryCount: summary.entry_count,
      pool: summary.pool,
      status: summary.status,
      winningMetric: summary.winning_metric,
      winners: (summary.winners ?? []).map((winner) => ({
        playerId: String(winner.player_id),
        playerName: winner.player_name,
      })),
      winnerId: summary.winner_id != null ? String(summary.winner_id) : null,
      winnerName: summary.winner_name,
      winnerMetric: summary.winner_metric,
    }))

    return {
      totalPool: sidePots.total_pool ?? 0,
      summaries,
    }
  }, [payoutData])
}
