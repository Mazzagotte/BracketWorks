import { BracketProgramDefinition } from '../../lib/types'
import { getBracketProgramLabel, summarizeEntries } from '../../lib/bracketPrograms'
import styles from '../entries.module.css'
import cardStyles from '../../styles/cards.module.css'
import badgeStyles from '../../styles/badges.module.css'
import { ChartNoAxesCombined, CircleCheck, CircleDollarSign, Clock3, Layers3, Trophy, UsersRound, WalletCards } from 'lucide-react'

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

export default function EntriesSummary({
  entryTotals,
  orderedProgramSummaries,
  sidePotSummaries,
  paymentSummary,
  entryFee,
}: EntriesSummaryProps) {
  return (
    <div className={`${cardStyles.card} ${styles.summaryCard}`}>
      <div className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.summaryHeader}`}>
        <div className={`${cardStyles.cardHeaderRow} ${styles.summaryTitleWrap}`}>
          <h3 className={`${cardStyles.cardTitle} ${styles.summaryTitle}`}>
            <ChartNoAxesCombined aria-hidden="true" />
            Tournament Summary
          </h3>
          <p className={styles.summarySubtitle}>Live totals for entries, revenue, and active pots.</p>
        </div>
        <div className={styles.summaryPaymentStrip}>
          <span className={`${badgeStyles.badge} ${badgeStyles.success}`}><CircleCheck aria-hidden="true" />{paymentSummary.paidCount} Paid</span>
          <span className={`${badgeStyles.badge} ${paymentSummary.dueCount > 0 ? badgeStyles.warning : badgeStyles.muted}`}><Clock3 aria-hidden="true" />{paymentSummary.dueCount} Due</span>
          <span className={`${badgeStyles.badge} ${paymentSummary.outstandingAmount > 0 ? badgeStyles.accent : badgeStyles.muted}`}><WalletCards aria-hidden="true" />${paymentSummary.outstandingAmount.toLocaleString()} Outstanding</span>
        </div>
      </div>
      <div className={styles.summaryGrid}>
        <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
          <span className={styles.statIconRing}><UsersRound className={styles.statIcon} aria-hidden="true" /></span>
          <div className={styles.statCopy}>
            <div className={`${cardStyles.statValue} ${styles.statValue}`}>{entryTotals.totalEntries}</div>
            <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Total Entries</div>
            <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>{entryTotals.totalPlayers} players</div>
          </div>
        </div>
        <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
          <span className={styles.statIconRing}><CircleDollarSign className={styles.statIcon} aria-hidden="true" /></span>
          <div className={styles.statCopy}>
            <div className={`${cardStyles.statValue} ${styles.statValue}`}>${entryTotals.totalRevenue.toLocaleString()}</div>
            <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Entry Revenue</div>
            <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>{entryTotals.totalEntries} entries × ${Number(entryFee).toLocaleString()}</div>
          </div>
        </div>
        {orderedProgramSummaries.map((program, programIndex) => (
          <div key={program.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
            <span className={styles.statIconRing}>
              {programIndex === 0 ? <Layers3 className={styles.statIcon} aria-hidden="true" /> : <Trophy className={styles.statIcon} aria-hidden="true" />}
            </span>
            <div className={styles.statCopy}>
              <div className={`${cardStyles.statValue} ${styles.statValue}`}>{program.totalEntries}</div>
              <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{getBracketProgramLabel(program as BracketProgramDefinition)}</div>
              <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>Projected {program.expectedBrackets} brackets</div>
              {program.refunds > 0 && <div className={styles.statRefund}>{program.refunds} overflow entries</div>}
            </div>
          </div>
        ))}
        {sidePotSummaries.map(pot => (
          <div key={pot.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
            <span className={styles.statIconRing}><Trophy className={styles.statIcon} aria-hidden="true" /></span>
            <div className={styles.statCopy}>
              <div className={`${cardStyles.statValue} ${styles.statValue}`}>{pot.count}</div>
              <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{pot.name}</div>
              {pot.fee > 0 && <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>Pot Total: ${(pot.count * pot.fee).toLocaleString()}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
