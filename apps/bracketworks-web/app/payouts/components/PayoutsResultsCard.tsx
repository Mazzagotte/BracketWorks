import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, ICON_SIZE } from '@bracketworks/ui'

import { formatCurrency } from '../../lib/formatters'
import { AggregatedWinner, SidePotByPlayer } from '../utils/payoutExportRows'
import styles from './Payouts.module.css'

type PayoutsResultsCardProps = {
  displayedTotalPrizePool: number
  winners: AggregatedWinner[]
  paidKeys: Set<string>
  expandedKeys: Set<string>
  sidePotByPlayer: SidePotByPlayer
  onToggleExpanded: (key: string) => void
  onTogglePaid: (key: string) => void
  onClearSearch: () => void
}

function groupWinnings(winnings: AggregatedWinner['winnings']) {
  const grouped: Record<string, AggregatedWinner['winnings']> = {}
  for (const payout of winnings) {
    const type = payout.bracket_name.replace(/ Bracket \d+$/, '').trim()
    if (!grouped[type]) grouped[type] = []
    grouped[type].push(payout)
  }
  return Object.entries(grouped)
}

/** Payout results as divider rows: place, bowler, amount, and one action (Mark paid). */
export default function PayoutsResultsCard({
  displayedTotalPrizePool,
  winners,
  paidKeys,
  expandedKeys,
  sidePotByPlayer,
  onToggleExpanded,
  onTogglePaid,
  onClearSearch,
}: PayoutsResultsCardProps) {
  return (
    <Card padding="flush" aria-label="Payout results">
      <CardHeader title="Payout results" description={`Total payouts ${formatCurrency(displayedTotalPrizePool)}`} />
      {winners.length === 0 ? (
        <EmptyState
          icon={<Search size={ICON_SIZE['2xl']} aria-hidden="true" />}
          title="No matching winners"
          description="Try a different first or last name."
          action={<Button variant="secondary" onClick={onClearSearch}>Clear search</Button>}
        />
      ) : (
        <ol className={styles.resultList}>
          {winners.map((winner, index) => {
            const winnerKey = String(winner.player_id ?? winner.player_name)
            const isPaid = paidKeys.has(winnerKey)
            const isExpanded = expandedKeys.has(winnerKey)
            const sidePots = sidePotByPlayer[String(winner.player_id)] ?? []
            const detailsId = `payout-details-${winnerKey}`
            const meta = [
              `${winner.winnings.length} bracket${winner.winnings.length !== 1 ? 's' : ''} won`,
              ...sidePots.map(pot => pot.name),
            ].join(' · ')

            return (
              <li key={winnerKey} className={styles.resultRow}>
                <div className={styles.resultMain}>
                  <Badge tone="neutral">{index + 1}</Badge>
                  <div className={styles.resultIdentity}>
                    <span className={styles.resultName}>{winner.player_name}</span>
                    <span className={styles.meta}>{meta}</span>
                  </div>
                  <span className={styles.resultAmount}>{formatCurrency(winner.total_won)}</span>
                  <div className={styles.resultActions}>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={isExpanded ? <ChevronUp size={ICON_SIZE.md} aria-hidden="true" /> : <ChevronDown size={ICON_SIZE.md} aria-hidden="true" />}
                      aria-label={`${isExpanded ? 'Hide' : 'Show'} payouts for ${winner.player_name}`}
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      onClick={() => onToggleExpanded(winnerKey)}
                    />
                    {isPaid ? (
                      <button
                        type="button"
                        className={styles.paidToggle}
                        onClick={() => onTogglePaid(winnerKey)}
                        aria-label={`Mark ${winner.player_name} as unpaid`}
                      >
                        <Badge tone="success">Paid</Badge>
                      </button>
                    ) : (
                      <Button size="sm" variant="accent-outline" onClick={() => onTogglePaid(winnerKey)} aria-label={`Mark ${winner.player_name} as paid`}>
                        Mark paid
                      </Button>
                    )}
                  </div>
                </div>

                {isExpanded ? (
                  <div id={detailsId} className={styles.resultDetails}>
                    {groupWinnings(winner.winnings).map(([type, payouts]) => (
                      <div key={type} className={styles.resultGroup}>
                        <span className={styles.resultGroupTitle}>{type}</span>
                        {payouts.map(payout => (
                          <span key={payout.bracket_name} className={styles.meta}>
                            {[
                              payout.bracket_name.replace(/^.* (Bracket \d+)$/, '$1'),
                              payout.position,
                              `${formatCurrency(payout.payout_amount)}${payout.split_pot ? ' (split)' : ''}`,
                            ].join(' · ')}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </Card>
  )
}
