import { GitFork } from 'lucide-react'
import styles from '../brackets.module.css'

interface BracketSummaryCardProps {
  totalBracketCount: number
  totalPlayersAtGeneration: number
}

/**
 * Read-only stats card: format, player count, bracket count, generation status.
 */
export function BracketSummaryCard({ totalBracketCount, totalPlayersAtGeneration }: BracketSummaryCardProps) {
  return (
    <article className={styles.bracketStatsCard}>
      <h2 className={styles.bracketStatsTitle}>
        <GitFork aria-hidden="true" />
        Bracket Summary
      </h2>
      <div className={styles.bracketStatsGrid}>
        <div>
          <span>Format</span>
          <strong>Single Elimination</strong>
        </div>
        <div>
          <span>Players</span>
          <strong>{totalPlayersAtGeneration}</strong>
        </div>
        <div>
          <span>Brackets</span>
          <strong>{totalBracketCount}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong className={styles.bracketStatusGood}>{totalBracketCount > 0 ? 'Generated' : 'Pending'}</strong>
        </div>
      </div>
    </article>
  )
}
