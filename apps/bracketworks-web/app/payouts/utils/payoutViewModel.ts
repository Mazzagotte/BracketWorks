import { AggregatedWinner } from './payoutExportRows'

export type WinnerRecord = {
  player_id: number
  player_name: string
  bracket_name: string
  position: string
  payout_amount: number
  payout_percentage: number
  split_pot?: boolean
}

export type PaymentSummary = {
  totalUniqueWinners: number
  paidCount: number
  remainingAmount: number
}

export function aggregateWinnersByPlayer(winners: WinnerRecord[]): AggregatedWinner[] {
  const byPlayer: Record<string, AggregatedWinner> = {}

  for (const winner of winners) {
    const playerKey = String(winner.player_id ?? winner.player_name)

    if (!byPlayer[playerKey]) {
      byPlayer[playerKey] = {
        player_id: winner.player_id,
        player_name: winner.player_name,
        total_won: 0,
        winnings: [],
      }
    }

    byPlayer[playerKey].total_won += winner.payout_amount
    byPlayer[playerKey].winnings.push({
      bracket_name: winner.bracket_name,
      position: winner.position,
      payout_amount: winner.payout_amount,
      payout_percentage: winner.payout_percentage,
      split_pot: winner.split_pot,
    })
  }

  return Object.values(byPlayer).sort((a, b) => b.total_won - a.total_won)
}

export function buildPaymentSummary(winners: AggregatedWinner[], paidKeys: Set<string>): PaymentSummary {
  const paidCount = winners.filter((winner) => paidKeys.has(String(winner.player_id ?? winner.player_name))).length
  const remainingAmount = winners
    .filter((winner) => !paidKeys.has(String(winner.player_id ?? winner.player_name)))
    .reduce((sum, winner) => sum + winner.total_won, 0)

  return {
    totalUniqueWinners: winners.length,
    paidCount,
    remainingAmount,
  }
}

export function filterWinnersByName(
  winners: AggregatedWinner[],
  searchFirstName: string,
  searchLastName: string,
): AggregatedWinner[] {
  const firstNameTerm = searchFirstName.trim().toLowerCase()
  const lastNameTerm = searchLastName.trim().toLowerCase()
  const hasSearch = Boolean(firstNameTerm || lastNameTerm)

  if (!hasSearch) {
    return winners
  }

  return winners.filter((winner) => {
    const normalized = winner.player_name.toLowerCase()
    const firstMatches = !firstNameTerm || normalized.includes(firstNameTerm)
    const lastMatches = !lastNameTerm || normalized.includes(lastNameTerm)
    return firstMatches && lastMatches
  })
}
