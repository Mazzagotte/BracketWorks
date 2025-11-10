'use client'

import React, { useRef, useState } from 'react'
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
  isMobile?: boolean
  onMatchClick?: (match: Match, roundName: string, bracketType: 'scratch' | 'handicap') => void
  bracketType?: 'scratch' | 'handicap'
}

/**
 * BracketTreeView - Grid-based tournament bracket visualization
 * Uses CSS Grid for precise alignment of cards and connectors
 */
export function BracketTreeView({
  rounds,
  isMobile = false,
  onMatchClick,
  bracketType = 'scratch'
}: BracketTreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null)

  if (!rounds || rounds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No bracket rounds available</p>
      </div>
    )
  }

  // Show first 3 rounds in bracket tree format
  const displayRounds = rounds.slice(0, 3)
  
  // Grid configuration
  // Each match occupies 2 rows (for the card height)
  // Connectors occupy the rows between matches
  const totalRows = displayRounds[0]?.matches.length * 3 || 12 // 3 rows per match (2 for card, 1 for spacing)

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
            const completedMatches = round.matches.filter(m => m.winner).length
            const totalMatches = round.matches.length
            const progressPercent = (completedMatches / totalMatches) * 100
            
            return (
              <div key={roundIndex} className={styles.roundHeader}>
                <div className={styles.roundBadgeContainer}>
                  <div className={styles.roundBadge}>{roundIndex + 1}</div>
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
            gridTemplateRows: `repeat(${totalRows}, 1fr)`,
            gridTemplateColumns: 'repeat(9, auto)' // 3 rounds × 3 columns each (match, h-connector, v-connector)
          }}
        >
          {/* Round 1 - 4 matches */}
          {displayRounds[0]?.matches.map((match, matchIndex) => {
            const status = match.matchStatus || getMatchStatus(match)
            const gridRow = matchIndex * 3 + 1 // Rows: 1, 4, 7, 10
            
            // Handle both old (match_score_a) and new (scoreA) field names for backwards compatibility
            const scoreA = (match as any).scoreA ?? (match as any).match_score_a
            const scoreB = (match as any).scoreB ?? (match as any).match_score_b
            
            // Check if this match is in the highlighted player's path
            const isInPath = highlightedPlayer && (
              match.playerA === highlightedPlayer || 
              match.playerB === highlightedPlayer
            )
            const playerAHighlighted = match.playerA === highlightedPlayer
            const playerBHighlighted = match.playerB === highlightedPlayer
            
            return (
              <React.Fragment key={`r0-m${matchIndex}`}>
                {/* Match Card - spans 2 rows for height */}
                <div 
                  className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''}`}
                  style={{
                    gridColumn: '1',
                    gridRow: `${gridRow} / span 2`,
                    cursor: onMatchClick ? 'pointer' : 'default'
                  }}
                  onClick={() => onMatchClick && onMatchClick(match, displayRounds[0]?.name || 'Round 1', bracketType)}
                >
                  {/* Tie indicator - both advance */}
                  {match.both_advance && (
                    <div className={styles.tieIndicator} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>
                      TIE
                    </div>
                  )}
                  {/* Tie indicator - split pot */}
                  {match.split_pot && (
                    <div className={styles.splitPotIndicator} title="Finals tie - pot split evenly">
                      SPLIT
                    </div>
                  )}
                  <div 
                    className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''} ${playerAHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={(e) => { e.stopPropagation(); setHighlightedPlayer(highlightedPlayer === match.playerA ? null : match.playerA); }}
                  >
                    <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                    <span className={styles.playerScore}>
                      {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                    </span>
                  </div>
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
            const scoreA = (match as any).scoreA ?? (match as any).match_score_a
            const scoreB = (match as any).scoreB ?? (match as any).match_score_b
            
            const isInPath = highlightedPlayer && (
              match.playerA === highlightedPlayer || 
              match.playerB === highlightedPlayer
            )
            const playerAHighlighted = match.playerA === highlightedPlayer
            const playerBHighlighted = match.playerB === highlightedPlayer
            
            return (
              <React.Fragment key={`r1-m${matchIndex}`}>
                {/* Match Card */}
                <div 
                  className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''}`}
                  style={{
                    gridColumn: '4',
                    gridRow: `${gridRow} / span 2`,
                    cursor: onMatchClick ? 'pointer' : 'default'
                  }}
                  onClick={() => onMatchClick && onMatchClick(match, displayRounds[1]?.name || 'Round 2', bracketType)}
                >
                  {/* Tie indicator - both advance */}
                  {match.both_advance && (
                    <div className={styles.tieIndicator} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>
                      TIE
                    </div>
                  )}
                  {/* Tie indicator - split pot */}
                  {match.split_pot && (
                    <div className={styles.splitPotIndicator} title="Finals tie - pot split evenly">
                      SPLIT
                    </div>
                  )}
                  <div 
                    className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''} ${playerAHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={(e) => { e.stopPropagation(); setHighlightedPlayer(highlightedPlayer === match.playerA ? null : match.playerA); }}
                  >
                    <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                    <span className={styles.playerScore}>
                      {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                    </span>
                  </div>
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

          {/* Round 3 - 1 match (Finals) */}
          {displayRounds[2]?.matches.map((match, matchIndex) => {
            const status = match.matchStatus || getMatchStatus(match)
            const gridRow = 5 // Centered vertically (middle of 12 rows)
            
            // Handle both old (match_score_a) and new (scoreA) field names for backwards compatibility
            const scoreA = (match as any).scoreA ?? (match as any).match_score_a
            const scoreB = (match as any).scoreB ?? (match as any).match_score_b
            
            const isInPath = highlightedPlayer && (
              match.playerA === highlightedPlayer || 
              match.playerB === highlightedPlayer
            )
            const playerAHighlighted = match.playerA === highlightedPlayer
            const playerBHighlighted = match.playerB === highlightedPlayer
            
            return (
              <div 
                key={`r2-m${matchIndex}`}
                className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''}`}
                style={{
                  gridColumn: '7',
                  gridRow: `${gridRow} / span 2`,
                  cursor: onMatchClick ? 'pointer' : 'default'
                }}
                onClick={() => onMatchClick && onMatchClick(match, displayRounds[2]?.name || 'Round 3', bracketType)}
              >
                {/* Tie indicator - both advance */}
                {match.both_advance && (
                  <div className={styles.tieIndicator} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>
                    TIE
                  </div>
                )}
                {/* Tie indicator - split pot */}
                {match.split_pot && (
                  <div className={styles.splitPotIndicator} title="Finals tie - pot split evenly">
                    SPLIT
                  </div>
                )}
                <div 
                  className={`${styles.player} ${match.winner === 'A' ? styles.winner : ''} ${playerAHighlighted ? styles.highlightedPlayer : ''}`}
                  onClick={(e) => { e.stopPropagation(); setHighlightedPlayer(highlightedPlayer === match.playerA ? null : match.playerA); }}
                >
                  <span className={styles.playerName}>{match.playerA || 'TBD'}</span>
                  <span className={styles.playerScore}>
                    {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                  </span>
                </div>
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
            )
          })}
        </div>
      </div>
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
