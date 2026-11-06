import { Badge, StatGroup } from '@bracketworks/ui'

import { BracketProgramDefinition } from '../../lib/types'
import { getBracketProgramLabel, summarizeEntries } from '../../lib/bracketPrograms'
import styles from './EntriesPanels.module.css'

type ProgramSummary = ReturnType<typeof summarizeEntries>['programSummaries'][number]

type SidePotSummary = {
  key: string
  name: string
  count: number
  fee: number
}

type PaymentSummary = {
  paidCount: number
  dueCount: number
  outstandingAmount: number
}

interface EntriesSummaryProps {
  entryTotals: {
    totalEntries: number
    totalPlayers: number
    totalRevenue: number
  }
  orderedProgramSummaries: ProgramSummary[]
  sidePotSummaries: SidePotSummary[]
  paymentSummary: PaymentSummary
  entryFee: number
}

/** The entries page's key numbers: one StatGroup plus a payment status line. */
export default function EntriesSummary({
  entryTotals,
  orderedProgramSummaries,
  sidePotSummaries,
  paymentSummary,
  entryFee,
}: EntriesSummaryProps) {
  return (
    <div className={styles.summary}>
      <StatGroup
        label="Entry totals"
        items={[
          { label: 'Total entries', value: String(entryTotals.totalEntries), detail: `${entryTotals.totalPlayers} players` },
          { label: 'Entry revenue', value: `$${entryTotals.totalRevenue.toLocaleString()}`, detail: `${entryTotals.totalEntries} entries x $${Number(entryFee).toLocaleString()}` },
          ...orderedProgramSummaries.map(program => ({
            id: program.key,
            label: getBracketProgramLabel(program as BracketProgramDefinition),
            value: String(program.totalEntries),
            detail: program.refunds > 0
              ? `${program.expectedBrackets} brackets · ${program.refunds} overflow`
              : `${program.expectedBrackets} brackets projected`,
          })),
          ...sidePotSummaries.map(pot => ({
            id: pot.key,
            label: pot.name,
            value: String(pot.count),
            detail: pot.fee > 0 ? `$${(pot.count * pot.fee).toLocaleString()} pot` : undefined,
          })),
        ]}
      />
      <p className={styles.paymentLine} aria-label="Payment status">
        <Badge tone="success">{paymentSummary.paidCount} paid</Badge>
        <Badge tone={paymentSummary.dueCount > 0 ? 'warning' : 'neutral'}>{paymentSummary.dueCount} due</Badge>
        <Badge tone={paymentSummary.outstandingAmount > 0 ? 'warning' : 'neutral'}>${paymentSummary.outstandingAmount.toLocaleString()} outstanding</Badge>
      </p>
    </div>
  )
}
