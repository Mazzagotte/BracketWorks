import { ListChecks } from 'lucide-react'

import badgeStyles from '../../styles/badges.module.css'
import buttonStyles from '../../styles/buttons.module.css'
import cardStyles from '../../styles/cards.module.css'
import { formatCurrency } from '../../lib/formatters'
import { AggregatedWinner, SidePotByPlayer } from '../utils/payoutExportRows'
import styles from '../payouts.module.css'

type PayoutsResultsCardProps = {
  displayedTotalPrizePool: number
  winners: AggregatedWinner[]
  paidKeys: Set<string>
  expandedKeys: Set<string>
  sidePotByPlayer: SidePotByPlayer
  onToggleExpanded: (key: string) => void
  onTogglePaid: (key: string) => void
}

function placeBadgeClass(place: number): string {
  if (place === 1) {
    return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.placeFirst} ${styles.placementBadge}`
  }
  if (place === 2) {
    return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.placeSecond} ${styles.placementBadge}`
  }
  if (place === 3) {
    return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.placeThird} ${styles.placementBadge}`
  }
  return `${badgeStyles.badge} ${badgeStyles.placement} ${badgeStyles.muted} ${styles.placementBadge}`
}

export default function PayoutsResultsCard({
  displayedTotalPrizePool,
  winners,
  paidKeys,
  expandedKeys,
  sidePotByPlayer,
  onToggleExpanded,
  onTogglePaid,
}: PayoutsResultsCardProps) {
  return (
    <div className={`${cardStyles.card} ${styles.tableCard}`}>
      <div className={`${cardStyles.cardHeader} ${cardStyles.cardHeaderDense} ${cardStyles.cardHeaderRow} ${styles.tableCardHeader}`}>
        <span className={styles.sectionTitle}><ListChecks aria-hidden="true" />Payout Results</span>
        <span className={styles.headerPool}>Total Payouts: {formatCurrency(displayedTotalPrizePool)}</span>
      </div>
      <div className={styles.bracketGroup}>
        {winners.length === 0 ? (
          <div className={`${cardStyles.card} ${cardStyles.emptyStateCard} ${styles.emptyState}`}>
            <div className={styles.emptyTitle}>No results</div>
            <div className={styles.emptyMessage}>No players match your search.</div>
          </div>
        ) : (
          winners.map((winner, index) => {
            const winnerKey = String(winner.player_id ?? winner.player_name)
            const isPaid = paidKeys.has(winnerKey)

            return (
              <div
                key={winnerKey}
                className={`${styles.winnerRow} ${index === 0 ? styles.firstPlace : ''} ${isPaid ? styles.isPaid : ''}`}
              >
                <div className={placeBadgeClass(index + 1)}>{index + 1}</div>

                <div className={styles.winnerInfo}>
                  <div className={styles.winnerName}>
                    {winner.player_name}
                    <span className={styles.bracketCount}>
                      {winner.winnings.length} bracket{winner.winnings.length !== 1 ? 's' : ''} won
                    </span>
                    <button
                      className={styles.toggleDetailsBtn}
                      onClick={() => onToggleExpanded(winnerKey)}
                      aria-label={expandedKeys.has(winnerKey) ? 'Hide details' : 'Show details'}
                    >
                      {expandedKeys.has(winnerKey) ? 'Hide details' : 'Show details'}
                    </button>
                    {(sidePotByPlayer[String(winner.player_id)] ?? []).map((pot) => (
                      <span key={pot.name} className={styles.sidePotPill}>{pot.name}</span>
                    ))}
                  </div>

                  {expandedKeys.has(winnerKey) && (() => {
                    const grouped: Record<string, typeof winner.winnings> = {}

                    for (const payout of winner.winnings) {
                      const type = payout.bracket_name.replace(/ Bracket \d+$/, '').trim()
                      if (!grouped[type]) {
                        grouped[type] = []
                      }
                      grouped[type].push(payout)
                    }

                    return (
                      <div className={styles.winnerMeta}>
                        {Object.entries(grouped).map(([type, payouts]) => (
                          <div key={type} className={styles.winnerMetaGroup}>
                            <div className={styles.winnerMetaGroupLabel}>{type}</div>
                            {payouts.map((payout) => {
                              const bracketShort = payout.bracket_name.replace(/^.* (Bracket \d+)$/, '$1')
                              return (
                                <div key={payout.bracket_name} className={styles.winnerMetaRow}>
                                  {bracketShort} — {payout.position} — {formatCurrency(payout.payout_amount)}{payout.split_pot ? ' (split)' : ''}
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                <div className={styles.payoutCol}>
                  <div className={styles.payoutAmount}>{formatCurrency(winner.total_won)}</div>
                  {winner.winnings.length > 1 && (
                    <div className={styles.payoutPct}>{winner.winnings.length} brackets</div>
                  )}
                </div>

                {isPaid ? (
                  <button
                    className={`${badgeStyles.badge} ${badgeStyles.success} ${styles.paidBadge}`}
                    onClick={() => onTogglePaid(winnerKey)}
                  >
                    Paid
                  </button>
                ) : (
                  <button
                    className={`${buttonStyles.button} ${buttonStyles.small} ${buttonStyles.primary} ${styles.markPaidBtn}`}
                    onClick={() => onTogglePaid(winnerKey)}
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
