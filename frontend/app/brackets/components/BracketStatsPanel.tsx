'use client'

import React, { useMemo, useState } from 'react'
import styles from '../styles/bracket-stats.module.css'
import { TournamentRound, Match } from './BracketTreeView'

interface BracketStatsPanelProps {
  rounds: TournamentRound[]
  bracketType?: 'scratch' | 'handicap'
  totalPlayers?: number
  lastUpdated?: Date | null
}

/**
 * BracketStatsPanel - Statistics dashboard for bracket progress
 * Shows: progress, completion time, current round status, active players
 */
export function BracketStatsPanel({
  rounds,
  bracketType = 'scratch',
  totalPlayers,
  lastUpdated
}: BracketStatsPanelProps) {
  
  const [showDetails, setShowDetails] = useState(false)
  
  // Calculate statistics
  const stats = useMemo(() => {
    let totalMatches = 0
    let completedMatches = 0
    let inProgressMatches = 0
    let pendingMatches = 0
    let activePlayers = totalPlayers || 0
    let currentRound = 0
    
    // Bracket Health Stats
    let matchesNeedingScores = 0  // Matches with players but no scores entered
    let matchesWithIssues = 0     // Matches with disputes/issues (TBD implementation)
    let matchesReadyToPlay = 0    // Matches with both players assigned and ready
    let matchesWaitingOnPrevious = 0  // Matches waiting for previous round to complete

    rounds.forEach((round, index) => {
      round.matches.forEach(match => {
        totalMatches++
        
        const hasPlayer1 = match.playerA && match.playerA !== 'TBD'
        const hasPlayer2 = match.playerB && match.playerB !== 'TBD'
        const bothPlayersAssigned = hasPlayer1 && hasPlayer2
        const hasScores = match.scoreA !== undefined || match.scoreB !== undefined
        const hasWinner = !!match.winner
        
        if (hasWinner) {
          completedMatches++
        } else if (hasScores) {
          inProgressMatches++
          currentRound = Math.max(currentRound, index)
        } else if (bothPlayersAssigned) {
          pendingMatches++
        }
        
        // Bracket Health Stats calculations
        if (bothPlayersAssigned && !hasScores && !hasWinner) {
          matchesNeedingScores++  // Has players but needs scores
          matchesReadyToPlay++    // Ready to be played
        }
        
        if (!hasPlayer1 || !hasPlayer2) {
          matchesWaitingOnPrevious++  // Waiting for players from previous round
        }
        
        // NOTE: Basic dispute detection - matches with scores but no winner
        // Future enhancement: Could add explicit dispute status from backend
        if (hasScores && !hasWinner && bothPlayersAssigned) {
          // This could indicate a tie or dispute
          matchesWithIssues++
        }
      })
    })

    // Estimate remaining players
    if (rounds.length > 0) {
      const firstRoundMatches = rounds[0].matches.length
      const playersPerMatch = 2
      activePlayers = firstRoundMatches * playersPerMatch
      
      // Subtract players eliminated in completed rounds
      for (let i = 0; i < rounds.length; i++) {
        const completedInRound = rounds[i].matches.filter(m => m.winner).length
        if (i < currentRound) {
          activePlayers -= completedInRound
        }
      }
    }

    const progressPercentage = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0
    
    // Estimate completion time (assume 20 minutes per match)
    const minutesPerMatch = 20
    const remainingMatches = totalMatches - completedMatches
    const estimatedMinutes = remainingMatches * minutesPerMatch
    const estimatedHours = Math.floor(estimatedMinutes / 60)
    const estimatedRemainingMinutes = estimatedMinutes % 60

    return {
      totalMatches,
      completedMatches,
      inProgressMatches,
      pendingMatches,
      progressPercentage,
      activePlayers,
      currentRound,
      estimatedHours,
      estimatedRemainingMinutes,
      // Bracket Health Stats
      matchesNeedingScores,
      matchesWithIssues,
      matchesReadyToPlay,
      matchesWaitingOnPrevious
    }
  }, [rounds, totalPlayers])

  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return `${seconds} seconds ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    return `${Math.floor(seconds / 86400)} days ago`
  }

  return (
    <div className={styles.statsPanel}>
    </div>
  )
}
