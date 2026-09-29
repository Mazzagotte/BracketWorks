'use client'

import type { BowlerHistoryProfile } from '../hooks/useBowlerHistorySearch'
import styles from '../entries.module.css'

interface BowlerHistoryResultsProps {
  historyResults: BowlerHistoryProfile[]
  isHistorySearching: boolean
  hasHistorySearchInput: boolean
  hasSubmittedSearch: boolean
  onUseBowler: (profile: BowlerHistoryProfile) => void
}

export default function BowlerHistoryResults({
  historyResults,
  isHistorySearching,
  hasHistorySearchInput,
  hasSubmittedSearch,
  onUseBowler,
}: BowlerHistoryResultsProps) {
  if (!hasHistorySearchInput && !isHistorySearching) return null

  return (
    <section className={styles.findExistingBowlerPanel} aria-label="Saved bowler matches" aria-live="polite">
      {isHistorySearching ? (
        <p className={styles.historyMeta}>Searching saved bowlers...</p>
      ) : historyResults.length > 0 ? (
        <div className={styles.historyResults}>
          <p className={styles.historyMeta}>{historyResults.length} {historyResults.length === 1 ? 'saved bowler' : 'saved bowlers'}</p>
          <div className={styles.historyResultsList}>
            {historyResults.map(profile => (
              <button key={profile.id} type="button" className={styles.historyResultButton} onClick={() => onUseBowler(profile)}>
                <span className={styles.historyResultName}>{profile.first_name} {profile.last_name}</span>
                <span className={styles.historyResultUsbc}>{profile.usbc_number ? `USBC ${profile.usbc_number}` : 'No USBC on file'}</span>
                <span className={styles.historyResultAction}>Use Bowler</span>
              </button>
            ))}
          </div>
        </div>
      ) : hasSubmittedSearch ? (
        <p className={styles.historyMeta}>No saved bowler matches. Continue with these details to add a new bowler.</p>
      ) : null}
    </section>
  )
}