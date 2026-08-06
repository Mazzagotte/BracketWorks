'use client'

import React, { useRef, useState, useMemo, useEffect } from 'react'
import styles from '../styles/bracket-tree.module.css'
import { Match as BaseMatch } from '../../hooks/useBrackets'

// Extend Match to include additional fields used in display
export interface Match extends Omit<BaseMatch, 'winner'> {
  winner?: 'A' | 'B' | null;
  qualifying_score_a?: number;
  qualifying_score_b?: number;
  match_score_a?: number; // Legacy field name
  match_score_b?: number; // Legacy field name
  matchStatus?: 'pending' | 'in_progress' | 'completed' | 'next_up' | 'tied' | 'both_advance';
}

export interface TournamentRound {
  name: string
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
  bracketTitle?: string
  onCardWidthChange?: (width: number | null) => void
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
  statusFilter = 'all',
  bracketTitle,
  onCardWidthChange,
}: BracketTreeViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [highlightedPlayer, setHighlightedPlayer] = useState<string | null>(null)

  // Clear click-highlight when user starts searching
  useEffect(() => {
    if (searchTerm) setHighlightedPlayer(null)
  }, [searchTerm])

  const isPlayerHighlighted = (name: string | undefined): boolean => {
    if (!name) return false
    if (searchTerm) {
      const normalizedName = name.toLowerCase()
      const terms = searchTerm
        .toLowerCase()
        .split(/\s+/)
        .map(term => term.trim())
        .filter(Boolean)

      if (terms.length === 0) return false
      return terms.every(term => normalizedName.includes(term))
    }
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

  useEffect(() => {
    const container = containerRef.current
    const card = cardRef.current
    const treeContainerScaledClass = styles.bracketTreeContainerScaled
    const cardScaledClass = styles.bracketCardScaled

    if (!container || !card) return

    const resetTreeScale = () => {
      if (treeContainerScaledClass) container.classList.remove(treeContainerScaledClass)
      if (cardScaledClass) card.classList.remove(cardScaledClass)
      container.style.removeProperty('--bw-tree-min-height')
      card.style.removeProperty('--bw-tree-scale')
      card.style.removeProperty('--bw-tree-card-width')
    }

    const applyTreeFit = () => {
      // Reset before measuring natural size.
      resetTreeScale()

      const availableWidth = container.clientWidth
      const naturalWidth = card.scrollWidth
      const naturalHeight = card.scrollHeight
      if (!availableWidth || !naturalWidth || !naturalHeight) return

      if (naturalWidth <= availableWidth) return

      const reservedRightGutter = isMobile ? 0 : 12
      const fittedWidth = Math.max(availableWidth - reservedRightGutter, availableWidth * (isMobile ? 0.9 : 0.75))
      const nextScale = Math.min(1, fittedWidth / naturalWidth)
      if (treeContainerScaledClass) container.classList.add(treeContainerScaledClass)
      if (cardScaledClass) card.classList.add(cardScaledClass)
      container.style.setProperty('--bw-tree-min-height', `${Math.ceil(naturalHeight * nextScale)}px`)
      card.style.setProperty('--bw-tree-scale', String(nextScale))
      card.style.setProperty('--bw-tree-card-width', `${100 / nextScale}%`)
    }

    applyTreeFit()
    window.addEventListener('resize', applyTreeFit)

    return () => {
      window.removeEventListener('resize', applyTreeFit)
      resetTreeScale()
    }
  }, [isMobile, rounds])

  useEffect(() => {
    if (!onCardWidthChange) return undefined

    const card = cardRef.current
    if (!card) {
      onCardWidthChange(null)
      return undefined
    }

    const publishCardWidth = () => {
      const nextWidth = card.getBoundingClientRect().width
      onCardWidthChange(Number.isFinite(nextWidth) && nextWidth > 0 ? Math.ceil(nextWidth) : null)
    }

    publishCardWidth()

    let observer: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        publishCardWidth()
      })
      observer.observe(card)
    }

    window.addEventListener('resize', publishCardWidth)

    return () => {
      window.removeEventListener('resize', publishCardWidth)
      if (observer) observer.disconnect()
      onCardWidthChange(null)
    }
  }, [onCardWidthChange, rounds])

  if (!rounds || rounds.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>No bracket rounds available</p>
      </div>
    )
  }
  
  return (
    <div 
      ref={containerRef}
      className={`${styles.bracketTreeContainer} ${isMobile ? styles.mobile : styles.desktop}`}
    >
      {/* Card wrapper for the entire bracket */}
      <div ref={cardRef} className={styles.bracketCard}>
        {bracketTitle && <div className={styles.bracketTitle}>{bracketTitle}</div>}

        <div className={styles.headerRow} aria-label="Bracket rounds">
          {displayRounds.map((round, roundIndex) => {
            const fallbackTitles = ['Round 1', 'Semifinals', 'Final']
            const title = round.roundName || round.name || fallbackTitles[roundIndex]
            const stats = roundStats[roundIndex]
            return (
              <div className={styles.roundHeader} key={`${title}-${roundIndex}`}>
                <span className={styles.roundTitle}>{title}</span>
                <span className={styles.roundProgress}>
                  {round.matches.length * 2} players · {stats?.completedMatches ?? 0} of {stats?.totalMatches ?? round.matches.length} complete
                </span>
              </div>
            )
          })}
        </div>

        {/* Grid-based bracket layout */}
        <div className={styles.bracketGrid}>
          {/* Round 1 - 4 matches */}
          {displayRounds[0]?.matches.map((match, matchIndex) => {
            const status = match.matchStatus || getMatchStatus(match)

            // Prefer canonical fields; only use legacy fields when canonical keys are absent.
            const scoreA = match.scoreA !== undefined ? match.scoreA : match.match_score_a;
            const scoreB = match.scoreB !== undefined ? match.scoreB : match.match_score_b;

            const isInPath = isPlayerHighlighted(match.playerA) || isPlayerHighlighted(match.playerB)
            const playerAHighlighted = isPlayerHighlighted(match.playerA)
            const playerBHighlighted = isPlayerHighlighted(match.playerB)
            
            return (
              <React.Fragment key={`r0-m${matchIndex}`}>
                {/* Match Card - spans 2 rows for height */}
                <div
                  className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''} ${isMatchDimmed(match) ? styles.dimmed : ''} ${styles[`r1m${matchIndex + 1}`] || ''}`}
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
                    onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerA ? null : (match.playerA ?? null))}
                  >
                    <span className={styles.playerName}>
                      {match.playerA || 'TBD'}
                    </span>
                    <span className={styles.playerScore}>
                      {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                    </span>
                  </div>
                  <div className={styles.vsRow} />
                  <div 
                    className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''} ${playerBHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={(e) => { e.stopPropagation(); setHighlightedPlayer(highlightedPlayer === match.playerB ? null : (match.playerB ?? null)); }}
                  >
                    <span className={styles.playerName}>
                      {match.playerB || 'TBD'}
                    </span>
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

            // Prefer canonical fields; only use legacy fields when canonical keys are absent.
            const scoreA = match.scoreA !== undefined ? match.scoreA : match.match_score_a;
            const scoreB = match.scoreB !== undefined ? match.scoreB : match.match_score_b;

            const isInPath = isPlayerHighlighted(match.playerA) || isPlayerHighlighted(match.playerB)
            const playerAHighlighted = isPlayerHighlighted(match.playerA)
            const playerBHighlighted = isPlayerHighlighted(match.playerB)
            
            return (
              <React.Fragment key={`r1-m${matchIndex}`}>
                {/* Match Card */}
                <div
                  className={`${styles.matchCard} ${styles[status]} ${isInPath ? styles.highlighted : ''} ${isMatchDimmed(match) ? styles.dimmed : ''} ${styles[`r2m${matchIndex + 1}`] || ''}`}
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
                    onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerA ? null : (match.playerA ?? null))}
                  >
                    <span className={styles.playerName}>
                      {match.playerA || 'TBD'}
                    </span>
                    <span className={styles.playerScore}>
                      {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                    </span>
                  </div>
                  <div className={styles.vsRow} />
                  <div 
                    className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''} ${playerBHighlighted ? styles.highlightedPlayer : ''}`}
                    onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerB ? null : (match.playerB ?? null))}
                  >
                    <span className={styles.playerName}>
                      {match.playerB || 'TBD'}
                    </span>
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

            // Prefer canonical fields; only use legacy fields when canonical keys are absent.
            const scoreA = match.scoreA !== undefined ? match.scoreA : match.match_score_a;
            const scoreB = match.scoreB !== undefined ? match.scoreB : match.match_score_b;

            const isInPath = isPlayerHighlighted(match.playerA) || isPlayerHighlighted(match.playerB)
            const playerAHighlighted = isPlayerHighlighted(match.playerA)
            const playerBHighlighted = isPlayerHighlighted(match.playerB)
            
            return (
              <div
                key={`r2-m${matchIndex}`}
                className={`${styles.matchCard} ${styles.finals} ${styles[status]} ${isInPath ? styles.highlighted : ''} ${isMatchDimmed(match) ? styles.dimmed : ''} ${styles.r3m1}`}
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
                  onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerA ? null : (match.playerA ?? null))}
                >
                  <span className={styles.playerNameWrap}>
                    <span className={styles.playerName}>
                      {match.playerA || 'TBD'}
                    </span>
                    {match.winner === 'A' && <span className={styles.championLabel}>Champion</span>}
                  </span>
                  <span className={styles.playerScore}>
                    {scoreA !== undefined && scoreA !== null ? scoreA : '-'}
                  </span>
                </div>
                <div className={styles.vsRow} />
                <div 
                  className={`${styles.player} ${match.winner === 'B' ? styles.winner : ''} ${playerBHighlighted ? styles.highlightedPlayer : ''}`}
                  onClick={() => setHighlightedPlayer(highlightedPlayer === match.playerB ? null : (match.playerB ?? null))}
                >
                  <span className={styles.playerNameWrap}>
                    <span className={styles.playerName}>
                      {match.playerB || 'TBD'}
                    </span>
                    {match.winner === 'B' && <span className={styles.championLabel}>Champion</span>}
                  </span>
                  <span className={styles.playerScore}>
                    {scoreB !== undefined && scoreB !== null ? scoreB : '-'}
                  </span>
                </div>
              </div>
            )
          })}

          {/* Connectors R1 to R2 */}
          {displayRounds[1]?.matches.map((_, i) => (
            <React.Fragment key={`conn-r1r2-${i}`}>
              {/* Bracket ] shape: borders at midpoint of each R1 pair */}
              <div
                className={`${styles.connectorBracket} ${i === 0 ? styles.connR1R2Bracket1 : styles.connR1R2Bracket2}`}
              />
              <div
                className={`${styles.connectorArm} ${i === 0 ? styles.connR1R2Arm1 : styles.connR1R2Arm2}`}
              />
            </React.Fragment>
          ))}

          {/* Connectors R2 to R3 */}
          {(displayRounds[2]?.matches?.length ?? 0) > 0 && (
            <>
              <div
                className={`${styles.connectorBracket} ${styles.connR2R3Bracket}`}
              />
              <div
                className={`${styles.connectorArm} ${styles.connR2R3Arm}`}
              />
            </>
          )}
        </div>
        <div className={styles.bracketLegend} aria-label="Bracket status legend">
          <span><i className={styles.legendWinner} aria-hidden="true" />Winner</span>
          <span><i className={styles.legendPending} aria-hidden="true" />Pending</span>
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
