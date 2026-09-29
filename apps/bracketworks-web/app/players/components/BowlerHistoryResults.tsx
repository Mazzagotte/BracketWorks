'use client'

import type { BowlerHistoryProfile } from '../hooks/useBowlerHistorySearch'
import { ArrowRight } from 'lucide-react'
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
          <div className={styles.historyResultsHeader}>
            <span>Matching bowlers</span>
            <span className={styles.historyMatchCount}>{historyResults.length}</span>
          </div>
          <div className={styles.historyResultsList}>
            {historyResults.map(profile => (
              <button
                key={profile.id}
                type="button"
                className={styles.historyResultButton}
                aria-label={`Use ${profile.first_name} ${profile.last_name}`}
                title={`Use ${profile.first_name} ${profile.last_name}`}
                onClick={() => onUseBowler(profile)}
              >
                <span className={styles.historyResultIdentity}>
                  <span className={styles.historyResultName}>{profile.first_name} {profile.last_name}</span>
                  <span className={styles.historyResultUsbc}>
                    {profile.usbc_number ? `USBC ${profile.usbc_number}` : 'No USBC'}
                    {profile.average != null ? ` · Average ${profile.average}` : ''}
                  </span>
                </span>
                <span className={styles.historyResultAction} aria-hidden="true">
                  <ArrowRight size={16} />
                </span>
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