'use client'

import type { BowlerHistoryProfile } from '../hooks/useBowlerHistorySearch'
import { ICON_SIZE } from '@bracketworks/ui'
import { ArrowRight } from 'lucide-react'
import styles from './PlayerForm.module.css'

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
    <section className={styles.suggestions} aria-label="Saved bowler matches" aria-live="polite">
      {isHistorySearching ? (
        <p className={styles.suggestionsNote}>Searching saved bowlers...</p>
      ) : historyResults.length > 0 ? (
        <div>
          <div className={styles.suggestionsHeader}>
            <span>Matching bowlers</span>
            <span>{historyResults.length}</span>
          </div>
          <div className={styles.suggestionList}>
            {historyResults.map(profile => (
              <button
                key={profile.id}
                type="button"
                className={styles.suggestion}
                aria-label={`Use ${profile.first_name} ${profile.last_name}`}
                title={`Use ${profile.first_name} ${profile.last_name}`}
                onClick={() => onUseBowler(profile)}
              >
                <span>
                  <span className={styles.suggestionName}>{profile.first_name} {profile.last_name}</span>
                  <span className={styles.suggestionMeta}>
                    {profile.usbc_number ? `USBC ${profile.usbc_number}` : 'No USBC'}
                    {profile.average != null ? ` · Average ${profile.average}` : ''}
                  </span>
                </span>
                <span aria-hidden="true">
                  <ArrowRight size={ICON_SIZE.md} />
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : hasSubmittedSearch ? (
        <p className={styles.suggestionsNote}>No saved bowler matches. Continue with these details to add a new bowler.</p>
      ) : null}
    </section>
  )
}