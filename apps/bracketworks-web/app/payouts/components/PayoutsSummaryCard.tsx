import { StatGroup } from '@bracketworks/ui'

import { formatCurrency } from '../../lib/formatters'
import { PayoutSummary } from '../hooks/usePayouts'
import { SidePotSummary } from '../hooks/useSidePotAccounting'

type PayoutsSummaryCardProps = {
  programSummaries: PayoutSummary['program_summaries']
  sidePotSummaries: SidePotSummary[]
  displayedTotalPrizePool: number
  paidCount: number
  totalUniqueWinners: number
  remainingAmount: number
}

/** The payouts page's key numbers in one StatGroup. */
export default function PayoutsSummaryCard({
  programSummaries,
  sidePotSummaries,
  displayedTotalPrizePool,
  paidCount,
  totalUniqueWinners,
  remainingAmount,
}: PayoutsSummaryCardProps) {
  const sidePotPool = sidePotSummaries.reduce((sum, summary) => sum + summary.pool, 0)

  return (
    <StatGroup
      label="Payout totals"
      items={[
        {
          label: 'Prize pool',
          value: formatCurrency(displayedTotalPrizePool),
          detail: sidePotPool > 0 ? `Includes ${formatCurrency(sidePotPool)} in side pots` : undefined,
        },
        ...programSummaries.map(program => ({
          id: program.key,
          label: `${program.name} pool`,
          value: formatCurrency(program.total_prize_pool),
          detail: `${program.total_brackets} bracket${program.total_brackets !== 1 ? 's' : ''}`,
        })),
        ...sidePotSummaries.map(pot => ({
          id: pot.key,
          label: `${pot.name} pool`,
          value: formatCurrency(pot.pool),
          detail: `${pot.entryCount} entr${pot.entryCount === 1 ? 'y' : 'ies'}`,
        })),
        {
          label: 'Marked paid',
          value: `${paidCount} of ${totalUniqueWinners}`,
          detail: totalUniqueWinners === 0 ? undefined : remainingAmount > 0 ? `${formatCurrency(remainingAmount)} still to pay` : 'Everyone is paid',
        },
      ]}
    />
  )
}
