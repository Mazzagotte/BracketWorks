'use client'

import React from 'react'
import styles from '../styles/round-navigator.module.css'

interface RoundNavigatorProps {
  rounds: { name: string; isActive?: boolean; isCompleted?: boolean }[]
  currentRound: number
  onRoundSelect: (roundIndex: number) => void
}

/**
 * RoundNavigator - Quick jump navigation for rounds
 * Features: Round selection, breadcrumb navigation, active/completed indicators
 */
export function RoundNavigator({
  rounds,
  currentRound,
  onRoundSelect
}: RoundNavigatorProps) {
  return (
    <div className={styles.navigator}>
      <div className={styles.breadcrumbs}>
        {rounds.map((round, index) => (
          <React.Fragment key={index}>
            <button
              className={`${styles.roundButton} ${
                index === currentRound ? styles.active : ''
              } ${round.isCompleted ? styles.completed : ''}`}
              onClick={() => onRoundSelect(index)}
              aria-current={index === currentRound ? 'step' : undefined}
            >
              <span className={styles.roundNumber}>{index + 1}</span>
              <span className={styles.roundName}>{round.name}</span>
            </button>
            {index < rounds.length - 1 && <span className={styles.separator} aria-hidden="true" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}
