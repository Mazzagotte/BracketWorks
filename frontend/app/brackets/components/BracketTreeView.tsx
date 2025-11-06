'use client'

import React, { useState, useRef, useEffect } from 'react'
import styles from '../styles/bracket-tree.module.css'
import { BracketRound, Match as BaseMatch } from '../../hooks/useBrackets'

// Extend Match to include additional fields used in display
export interface Match extends BaseMatch {
  qualifying_score_a?: number
  qualifying_score_b?: number
  matchStatus?: 'pending' | 'in_progress' | 'completed' | 'next_up'
}

export interface TournamentRound extends BracketRound {
  matches: Match[]
  isCompleted?: boolean
  roundNumber?: number
  roundName?: string
}

interface BracketTreeViewProps {
  rounds: TournamentRound[]
  onMatchClick?: (roundIndex: number, matchIndex: number) => void
  selectedMatch?: { round: number; match: number } | null
  isMobile?: boolean
}

/**
 * BracketTreeView - Tournament bracket visualization with connecting lines
 * Features: NCAA-style tree, animated transitions, responsive design
 */
export function BracketTreeView({
  rounds,
  onMatchClick,
  selectedMatch,
  isMobile = false
}: BracketTreeViewProps) {
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)

  if (!rounds || rounds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No bracket rounds available</p>
      </div>
    )
  }

  const currentRound = rounds[selectedRoundIndex]
  const isRoundComplete = currentRound.matches.every(m => m.winner)
  const isFinalRound = selectedRoundIndex === rounds.length - 1

  return (
    <div 
      ref={containerRef}
      className={`${styles.bracketTreeContainer} ${isMobile ? styles.mobile : styles.desktop}`}
    >
      {/* Tournament Stepper */}
      <div className={styles.tournamentStepper}>
        {rounds.map((round, index) => {
          const isActive = index === selectedRoundIndex
          const isCompleted = round.matches.every(m => m.winner)
          const isPast = index < selectedRoundIndex
          const isFuture = index > selectedRoundIndex
          const completedCount = round.matches.filter(m => m.winner).length
          const totalMatches = round.matches.length

          return (
            <React.Fragment key={index}>
              <div 
                className={`${styles.stepperItem} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''} ${isPast ? styles.past : ''} ${isFuture ? styles.future : ''}`}
                onClick={() => setSelectedRoundIndex(index)}
              >
                <div className={styles.stepperIcon}>
                  {isCompleted ? (
                    <span className={styles.checkIcon}>✓</span>
                  ) : (
                    <span className={styles.stepNumber}>{index + 1}</span>
                  )}
                </div>
                <div className={styles.stepperContent}>
                  <div className={styles.stepperLabel}>{round.roundName || `Round ${index + 1}`}</div>
                  <div className={styles.stepperSubtext}>
                    {completedCount}/{totalMatches} completed
                  </div>
                </div>
              </div>

              {/* Connector Line */}
              {index < rounds.length - 1 && (
                <div className={`${styles.stepperConnector} ${isCompleted ? styles.completed : ''}`}></div>
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Round Details Section */}
      <div className={styles.roundDetails}>
        <div className={styles.roundDetailsHeader}>
          <h2 className={styles.roundDetailsTitle}>{currentRound.roundName || `Round ${selectedRoundIndex + 1}`}</h2>
          <div className={styles.roundProgress}>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${(currentRound.matches.filter(m => m.winner).length / currentRound.matches.length) * 100}%` }}
              ></div>
            </div>
            <span className={styles.progressText}>
              {currentRound.matches.filter(m => m.winner).length} of {currentRound.matches.length} matches complete
            </span>
          </div>
        </div>

        {/* Matches Grid */}
        <div className={styles.matchesGrid}>
          {currentRound.matches.map((match, matchIndex) => {
            const isSelected = selectedMatch?.round === selectedRoundIndex && selectedMatch?.match === matchIndex
            const status = match.matchStatus || getMatchStatus(match)
            const winner = match.winner === 'A' ? match.playerA : match.winner === 'B' ? match.playerB : null

            return (
              <div
                key={matchIndex}
                className={`${styles.matchCard} ${styles[status]} ${isSelected ? styles.selected : ''}`}
                onClick={() => onMatchClick?.(selectedRoundIndex, matchIndex)}
              >
                {/* Match Number */}
                <div className={styles.matchNumber}>
                  Match {matchIndex + 1}
                </div>

                {/* Player A */}
                <div className={`${styles.playerRow} ${match.winner === 'A' ? styles.winner : ''}`}>
                  <div className={styles.playerInfo}>
                    {match.winner === 'A' && <span className={styles.trophy}>🏆</span>}
                    <span className={styles.playerName}>
                      {match.playerA || 'TBD'}
                    </span>
                  </div>
                  <div className={styles.scoreContainer}>
                    <span className={`${styles.score} ${match.winner === 'A' ? styles.winnerScore : ''}`}>
                      {match.scoreA !== undefined && match.scoreA !== null ? match.scoreA : '-'}
                    </span>
                  </div>
                </div>

                <div className={styles.vs}>vs</div>

                {/* Player B */}
                <div className={`${styles.playerRow} ${match.winner === 'B' ? styles.winner : ''}`}>
                  <div className={styles.playerInfo}>
                    {match.winner === 'B' && <span className={styles.trophy}>🏆</span>}
                    <span className={styles.playerName}>
                      {match.playerB || 'TBD'}
                    </span>
                  </div>
                  <div className={styles.scoreContainer}>
                    <span className={`${styles.score} ${match.winner === 'B' ? styles.winnerScore : ''}`}>
                      {match.scoreB !== undefined && match.scoreB !== null ? match.scoreB : '-'}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                {status === 'completed' && winner && (
                  <div className={styles.completedBadge}>
                    <span className={styles.winnerLabel}>Winner:</span> {winner}
                  </div>
                )}
                {status === 'next_up' && (
                  <div className={styles.nextUpBadge}>Ready to Play</div>
                )}
                {status === 'pending' && (
                  <div className={styles.pendingBadge}>Waiting for Players</div>
                )}

                {/* Upset Indicator */}
                {isUpset(match) && (
                  <div className={styles.upsetBadge}>⚡ UPSET</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Championship Banner */}
      {isFinalRound && isRoundComplete && currentRound.matches[0]?.winner && (
        <div className={styles.championshipBanner}>
          <div className={styles.championTrophy}>🏆</div>
          <div className={styles.championText}>
            <div className={styles.championLabel}>Tournament Champion</div>
            <div className={styles.championName}>
              {currentRound.matches[0].winner === 'A' 
                ? currentRound.matches[0].playerA 
                : currentRound.matches[0].playerB}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Helper function to determine match status based on data
 */
function getMatchStatus(match: Match): 'pending' | 'in_progress' | 'completed' | 'next_up' {
  if (match.winner) return 'completed'
  if (match.scoreA !== undefined || match.scoreB !== undefined) return 'in_progress'
  if (!match.playerA || !match.playerB || match.playerA === 'TBD' || match.playerB === 'TBD') return 'pending'
  return 'next_up' // Both players assigned, no scores yet
}

/**
 * Helper function to detect upsets (lower seed beating higher seed)
 */
function isUpset(match: Match): boolean {
  if (!match.winner) return false
  
  // Upset if lower seed (higher number) beats higher seed (lower number)
  if (match.winner === 'A' && match.seedA > match.seedB) return true
  if (match.winner === 'B' && match.seedB > match.seedA) return true
  
  return false
}
