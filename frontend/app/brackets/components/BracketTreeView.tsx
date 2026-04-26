'use client'

import React, { useRef, useState, useMemo, useEffect } from 'react'
import styles from '../styles/bracket-tree.module.css'
import { BracketRound, Match as BaseMatch } from '../../hooks/useBrackets'

// Extend Match to include additional fields used in display
export interface Match extends BaseMatch {
  qualifying_score_a?: number;
  qualifying_score_b?: number;
  match_score_a?: number; // Legacy field name
  match_score_b?: number; // Legacy field name
  matchStatus?: 'pending' | 'in_progress' | 'completed' | 'next_up' | 'tied' | 'both_advance';
}

export interface TournamentRound extends BracketRound {
  matches: Match[]
  isCompleted?: boolean
  roundNumber?: number
  roundName?: string
}

interface BracketTreeViewProps {
  rounds: TournamentRound[]
  isMobile?: boolean
  bracketType?: 'scratch' | 'handicap'
  searchTerm?: string
  statusFilter?: string
}

/**
 * BracketTreeView - Grid-based tournament bracket visualization
 * Uses CSS Grid for precise alignment of cards and connectors
 * Optimized with React.memo to prevent unnecessary re-renders
 */
const BracketTreeViewComponent = ({
  rounds,
  isMobile = false,
  bracketType = 'scratch',
  searchTerm = '',
  statusFilter = 'all'
}: BracketTreeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null)

  // Clear click-highlight when user starts searching
  useEffect(() => {
    if (searchTerm) setHighlightedPlayer(null)
  }, [searchTerm])

  const isPlayerHighlighted = (name: string | undefined): boolean => {
    if (!name) return false
    if (searchTerm) return name.toLowerCase().includes(searchTerm.toLowerCase())
    return highlightedPlayer === name
  }

  const isMatchDimmed = (match: Match): boolean => {
    const status = match.matchStatus || getMatchStatus(match)
    if (statusFilter !== 'all' && status !== statusFilter) return true
    if (searchTerm && !isPlayerHighlighted(match.playerA) && !isPlayerHighlighted(match.playerB)) return true
    return false
  }

  // Show first 3 rounds in bracket tree format
  const displayRounds = (rounds ?? []).slice(0, 3)
  
  // Memoize round statistics to avoid recalculating on every render
  const roundStats = useMemo(() => {
    return displayRounds.map(round => {
      const completedMatches = round.matches.filter(m => m.winner || m.split_pot || m.both_advance).length
      const totalMatches = round.matches.length
      const progressPercent = (completedMatches / totalMatches) * 100
      return { completedMatches, totalMatches, progressPercent }
    })
  }, [displayRounds])

  if (!rounds || rounds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No bracket rounds available</p>
      </div>
    )
  }
  
  // Grid configuration
  // Each match occupies 2 rows (for the card height)
  // Connectors occupy the rows between matches
  const totalRows = (displayRounds[0]?.matches.length * 3 - 1) || 11 // -1 to avoid trailing empty row

  return (
    <div 
      ref={containerRef}
      className={`${styles.bracketTreeContainer} ${isMobile ? styles.mobile : styles.desktop}`}
    >
      {/* Card wrapper for the entire bracket */}
      <div className={styles.bracketCard}>
        {/* Round Headers with Numbered Badges */}
        <div className={styles.headerRow}>
          {displayRounds.map((round, roundIndex) => {
            const { completedMatches, totalMatches, progressPercent } = roundStats[roundIndex]
            
            return (
              <div key={roundIndex} className={styles.roundHeader}>
                <div className={styles.roundBadgeContainer}>
                  <div className={`${styles.roundBadge} ${styles[`roundBadge${roundIndex + 1}`] || ''}`}>{roundIndex + 1}</div>
                  <div className={styles.roundInfo}>
                    <h3 className={styles.roundTitle}>{round.roundName || `Round ${roundIndex + 1}`}</h3>
                    <span className={styles.roundProgress}>
                      {completedMatches}/{totalMatches} Complete
                    </span>
                  </div>
                </div>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Grid-based bracket layout */}
        <div 
          className={styles.bracketGrid}
          style={{
            gridTemplateRows: `repeat(${totalRows}, auto)`,
            gridTemplateColumns: 'repeat(9, auto)' // 3 rounds × 3 columns each (match, h-connector, v-connector)
          }}
        >
          {/* Round 1 - 4 matches */}
          {displayRounds[0]?.matches.map((match, matchIndex) => {
            const status = match.matchStatus || getMatchStatus(match)
            const gridRow = matchIndex * 3 + 1 // Rows: 1, 4, 7, 10

            // Handle both old (match_score_a) and new (scoreA) field names for backwards compatibility
            const scoreA = match.scoreA ?? match.match_score_a;
            const scoreB = match.scoreB ?? match.match_score_b;

            const isInPath = isPlayerHighlighted(match.playerA) || isPlayerHighlighted(match.playerB)
            const playerAHighlighted = isPlayerHighlighted(match.playerA)
            const playerBHighlighted = isPlayerHighlighted(match.playerB)
            
            return (
              <React.Fragment key={`r0-m${matchIndex}`}>
                {/* Match Card - spans 2 rows for height */}
                <div
                  className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''} ${isMatchDimmed(match) ? styles.dimmed : ''}`}
                  style={{
                    gridColumn: '1',
                    gridRow: `${gridRow} / span 2`
                  }}
                >
                  <div className={styles.matchLabel}>
                    Match {matchIndex + 1}
                    {match.both_advance && (
                      <span className={styles.tieIndicator} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>TIE</span>
                    )}
                    {match.split_pot && (
                      <span className={styles.splitPotIndicator} title="Finals tie - pot split evenly">SPLIT</span>
                    )}
                  </div>
                  <div 
                    className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''} ${playerAHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerA ? null : match.playerA)}
                  >
                    <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                    <span className={styles.playerScore}>
                      {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                    </span>
                  </div>
                  <div className={styles.vsRow}>vs</div>
                  <div 
                    className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''} ${playerBHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={(e) => { e.stopPropagation(); setHighlightedPlayer(highlightedPlayer === match.playerB ? null : match.playerB); }}
                  >
                    <span className={styles.playerName}>{match.playerB || 'TBD'}</span>
                    <span className={styles.playerScore}>
                      {scoreB !== undefined && scoreB !== null ? scoreB : '-'}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            )
          })}

          {/* Round 2 - 2 matches */}
          {displayRounds[1]?.matches.map((match, matchIndex) => {
            const status = match.matchStatus || getMatchStatus(match)
            const gridRow = matchIndex * 6 + 2 // Rows: 2, 8 (centered between R1 pairs)

            // Handle both old (match_score_a) and new (scoreA) field names for backwards compatibility
            const scoreA = match.scoreA ?? match.match_score_a;
            const scoreB = match.scoreB ?? match.match_score_b;

            const isInPath = isPlayerHighlighted(match.playerA) || isPlayerHighlighted(match.playerB)
            const playerAHighlighted = isPlayerHighlighted(match.playerA)
            const playerBHighlighted = isPlayerHighlighted(match.playerB)
            
            return (
              <React.Fragment key={`r1-m${matchIndex}`}>
                {/* Match Card */}
                <div
                  className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''} ${isMatchDimmed(match) ? styles.dimmed : ''}`}
                  style={{
                    gridColumn: '4',
                    gridRow: `${gridRow} / span 2`
                  }}
                >
                  <div className={styles.matchLabel}>
                    Semifinal {matchIndex + 1}
                    {match.both_advance && (
                      <span className={styles.tieIndicator} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>TIE</span>
                    )}
                    {match.split_pot && (
                      <span className={styles.splitPotIndicator} title="Finals tie - pot split evenly">SPLIT</span>
                    )}
                  </div>
                  <div 
                    className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''} ${playerAHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerA ? null : match.playerA)}
                  >
                    <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                    <span className={styles.playerScore}>
                      {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                    </span>
                  </div>
                  <div className={styles.vsRow}>vs</div>
                  <div 
                    className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''} ${playerBHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerB ? null : match.playerB)}
                  >
                    <span className={styles.playerName}>{match.playerB || 'TBD'}</span>
                    <span className={styles.playerScore}>
                      {scoreB !== undefined && scoreB !== null ? scoreB : '-'}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            )
          })}

          {/* Round 3 - 1 match (Finals) */}
          {displayRounds[2]?.matches.map((match, matchIndex) => {
            const status = match.matchStatus || getMatchStatus(match)
            const gridRow = 5 // Centered vertically (middle of 12 rows)

            // Handle both old (match_score_a) and new (scoreA) field names for backwards compatibility
            const scoreA = match.scoreA ?? match.match_score_a;
            const scoreB = match.scoreB ?? match.match_score_b;

            const isInPath = isPlayerHighlighted(match.playerA) || isPlayerHighlighted(match.playerB)
            const playerAHighlighted = isPlayerHighlighted(match.playerA)
            const playerBHighlighted = isPlayerHighlighted(match.playerB)
            
            return (
              <div
                key={`r2-m${matchIndex}`}
                className={`${styles.matchCard} ${styles.finals} ${styles[status]} ${isInPath ? styles.highlighted : ''} ${isMatchDimmed(match) ? styles.dimmed : ''}`}
                style={{
                  gridColumn: '7',
                  gridRow: `${gridRow} / span 2`
                }}
              >
                <div className={styles.matchLabel}>
                  Final
                  {match.both_advance && (
                    <span className={styles.tieIndicator} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>TIE</span>
                  )}
                  {match.split_pot && (
                    <span className={styles.splitPotIndicator} title="Finals tie - pot split evenly">SPLIT</span>
                  )}
                </div>
                <div 
                  className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''} ${playerAHighlighted ? styles.highlightedPlayer : ''}`}
                  onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerA ? null : match.playerA)}
                >
                  <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                  <span className={styles.playerScore}>
                    {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                  </span>
                </div>
                <div className={styles.vsRow}>vs</div>
                <div 
                  className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''} ${playerBHighlighted ? styles.highlightedPlayer : ''}`}
                  onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerB ? null : match.playerB)}
                >
                  <span className={styles.playerName}>{match.playerB || 'TBD'}</span>
                  <span className={styles.playerScore}>
                    {scoreB !== undefined && scoreB !== null ? scoreB : '-'}
                  </span>
                </div>
              </div>
            )
          })}

          {/* ── Connectors R1 → R2 ── */}
          {displayRounds[1]?.matches.map((_, i) => (
            <React.Fragment key={`conn-r1r2-${i}`}>
              {/* Bracket ] shape: borders at midpoint of each R1 pair */}
              <div
                className={styles.connectorBracket}
                style={{ gridColumn: '2', gridRow: `${i * 6 + 2} / ${i * 6 + 5}` }}
              />
              {/* Horizontal arm → R2 match */}
              <div
                className={styles.connectorArm}
                style={{ gridColumn: '3', gridRow: `${i * 6 + 2} / ${i * 6 + 4}` }}
              />
            </React.Fragment>
          ))}

          {/* ── Connectors R2 → R3 ── */}
          {displayRounds[2]?.matches?.length > 0 && (
            <>
              <div
                className={styles.connectorBracket}
                style={{ gridColumn: '5', gridRow: '3 / 9' }}
              />
              <div
                className={styles.connectorArm}
                style={{ gridColumn: '6', gridRow: '5 / 7' }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Helper function to determine match status based on data
 */
function getMatchStatus(match: Match): 'pending' | 'in_progress' | 'completed' | 'next_up' {
  if (match.winner || match.split_pot || match.both_advance) return 'completed'
  if (match.scoreA !== undefined || match.scoreB !== undefined) return 'in_progress'
  if (!match.playerA || !match.playerB || match.playerA === 'TBD' || match.playerB === 'TBD') return 'pending'
  return 'next_up' // Both players assigned, no scores yet
}

// Export memoized component for better performance
export const BracketTreeView = React.memo(BracketTreeViewComponent)
export default BracketTreeView
