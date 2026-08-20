import { CircleCheck, ClipboardCheck, Clock3, Coins, Star, Trophy, Users, WalletCards } from 'lucide-react'

import badgeStyles from '../../styles/badges.module.css'
import cardStyles from '../../styles/cards.module.css'
import { formatCurrency } from '../../lib/formatters'
import { PayoutSummary } from '../hooks/usePayouts'
import { SidePotSummary } from '../hooks/useSidePotAccounting'
import styles from '../payouts.module.css'

type PayoutsSummaryCardProps = {
  payoutData: PayoutSummary
  programSummaries: PayoutSummary['program_summaries']
  sidePotSummaries: SidePotSummary[]
  displayedTotalPrizePool: number
  paidCount: number
  totalUniqueWinners: number
  remainingAmount: number
}

export default function PayoutsSummaryCard({
  programSummaries,
  sidePotSummaries,
  displayedTotalPrizePool,
  paidCount,
  totalUniqueWinners,
  remainingAmount,
}: PayoutsSummaryCardProps) {
  const dueCount = Math.max(totalUniqueWinners - paidCount, 0)
  const sidePotPool = sidePotSummaries.reduce((sum, summary) => sum + summary.pool, 0)

  return (
    <div className={`${cardStyles.card} surface-card ${styles.summaryCard}`}>
      <div className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${styles.summaryHeader}`}>
        <div className={`${cardStyles.cardHeaderRow} ${styles.summaryTitleWrap}`}>
          <h3 className={`${cardStyles.cardTitle} ${styles.summaryTitle}`}>
            <Coins aria-hidden="true" />
            Payout Summary
          </h3>
          <p className={styles.summarySubtitle}>Live totals for prize pools and payout completion.</p>
        </div>
        <div className={styles.summaryPaymentStrip}>
          <span className={`${badgeStyles.badge} ${badgeStyles.success}`}>
            <CircleCheck aria-hidden="true" />
            {paidCount} Paid
          </span>
          <span className={`${badgeStyles.badge} ${dueCount > 0 ? badgeStyles.warning : badgeStyles.muted}`}>
            <Clock3 aria-hidden="true" />
            {dueCount} Due
          </span>
          <span className={`${badgeStyles.badge} ${remainingAmount > 0 ? badgeStyles.accent : badgeStyles.muted}`}>
            <WalletCards aria-hidden="true" />
            {formatCurrency(remainingAmount)} Outstanding
          </span>
        </div>
      </div>
      <div className={styles.summaryGrid}>
        <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
          <span className={styles.statIconRing}><Trophy aria-hidden="true" className={styles.statIcon} /></span>
          <div className={styles.statContent}>
            <div className={`${cardStyles.statValue} ${styles.statValue}`}>{formatCurrency(displayedTotalPrizePool)}</div>
            <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Final Prize Pool</div>
            {sidePotPool > 0 && (
              <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>Includes {formatCurrency(sidePotPool)} in side pots</div>
            )}
          </div>
        </div>

        {programSummaries.map((program) => (
          <div key={program.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
            <span className={styles.statIconRing}>
              {program.name.toLowerCase().includes('scratch') ? (
                <Star aria-hidden="true" className={styles.statIcon} />
              ) : (
                <Users aria-hidden="true" className={styles.statIcon} />
              )}
            </span>
            <div className={styles.statContent}>
              <div className={`${cardStyles.statValue} ${styles.statValue}`}>{formatCurrency(program.total_prize_pool)}</div>
              <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{program.name} Pool</div>
              <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>
                {program.total_brackets} bracket{program.total_brackets !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        ))}

        {sidePotSummaries.map((pot) => (
          <div key={pot.key} className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
            <span className={styles.statIconRing}><Coins aria-hidden="true" className={styles.statIcon} /></span>
            <div className={styles.statContent}>
              <div className={`${cardStyles.statValue} ${styles.statValue}`}>{formatCurrency(pot.pool)}</div>
              <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>{pot.name} Pool</div>
              <div className={`${cardStyles.statDetail} ${styles.statDetail}`}>
                {pot.entryCount} side pot entr{pot.entryCount === 1 ? 'y' : 'ies'}
              </div>
            </div>
          </div>
        ))}

        <div className={`${cardStyles.statTile} ${cardStyles.statTileCompact} ${styles.statBox}`}>
          <span className={styles.statIconRing}><ClipboardCheck aria-hidden="true" className={styles.statIcon} /></span>
          <div className={styles.statContent}>
            <div className={`${cardStyles.statValue} ${styles.statValue}`}>{paidCount} / {totalUniqueWinners}</div>
            <div className={`${cardStyles.statLabel} ${styles.statLabel}`}>Marked Paid</div>
            {totalUniqueWinners > 0 && (
              <div className={styles.progressBarRow}>
                <progress className={styles.progressMeter} value={paidCount} max={totalUniqueWinners} />
              </div>
            )}
            {remainingAmount > 0 && (
              <div className={`${cardStyles.statDetail} ${styles.remainingLabel}`}>
                {formatCurrency(remainingAmount)} remaining to mark paid
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
