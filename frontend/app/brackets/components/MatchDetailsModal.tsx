'use client'

import React from 'react'
import styles from '../styles/match-details-modal.module.css'
import { Match } from './BracketTreeView'

interface MatchDetailsModalProps {
  match: Match | null
  onClose: () => void
  roundName?: string
  bracketType?: 'scratch' | 'handicap'
  playerADetails?: {
    fullName?: string
    usbcNumber?: string
    average?: number
    handicap?: number
    tournamentRecord?: string
  }
  playerBDetails?: {
    fullName?: string
    usbcNumber?: string
    average?: number
    handicap?: number
    tournamentRecord?: string
  }
  laneAssignment?: number
  matchTime?: string
  matchDate?: string
}

/**
 * MatchDetailsModal - Detailed match information popup
 * Shows player stats, qualifying scores, lane assignment, schedule
 */
export function MatchDetailsModal({
  onClose,
  match,
  roundName,
  bracketType = 'scratch',
  playerADetails,
  playerBDetails,
  laneAssignment,
  matchTime,
  matchDate
}: MatchDetailsModalProps) {
  if (!match) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getStatusLabel = () => {
    if (match.winner) return 'Completed'
    if (match.scoreA !== undefined || match.scoreB !== undefined) return 'In Progress'
    if (!match.playerA || !match.playerB || match.playerA === 'TBD' || match.playerB === 'TBD') return 'Pending'
    return 'Scheduled'
  }

  const statusLabel = getStatusLabel()

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContainer}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Match Details</h2>
            {roundName && (
              <p className={styles.roundName}>{roundName}</p>
            )}
          </div>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Status Badge */}
        <div className={styles.statusBadgeContainer}>
          <span className={`${styles.statusBadge} ${styles[statusLabel.toLowerCase().replace(' ', '_')]}`}>
            {statusLabel}
          </span>
          <span className={styles.bracketTypeBadge}>
            {bracketType.charAt(0).toUpperCase() + bracketType.slice(1)} Bracket
          </span>
          {match.both_advance && (
            <span className={styles.tieResolutionBadge} title={match.elimination_notes || 'Both players advance - lower next round score will be eliminated'}>
              BOTH ADVANCE
            </span>
          )}
          {match.split_pot && (
            <span className={styles.tieResolutionBadge} title="Finals tie - pot split evenly">
              SPLIT POT
            </span>
          )}
        </div>

        {/* Match Info */}
        {(laneAssignment || matchTime || matchDate) && (
          <div className={styles.matchInfo}>
            {laneAssignment && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Lane</span>
                <span className={styles.infoValue}>#{laneAssignment}</span>
              </div>
            )}
            {matchDate && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Date</span>
                <span className={styles.infoValue}>{matchDate}</span>
              </div>
            )}
            {matchTime && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Time</span>
                <span className={styles.infoValue}>{matchTime}</span>
              </div>
            )}
          </div>
        )}

        {/* Players Comparison */}
        <div className={styles.playersComparison}>
          {/* Player A */}
          <div className={`${styles.playerCard} ${match.winner === 'A' ? styles.winnerCard : ''}`}>
            <div className={styles.playerCardHeader}>
              {match.winner === 'A' && <span className={styles.winnerBadge}>🏆 Winner</span>}
            </div>
            
            <h3 className={styles.playerName}>
              {playerADetails?.fullName || match.playerA || 'TBD'}
            </h3>

            {playerADetails?.usbcNumber && (
              <div className={styles.usbcNumber}>
                USBC: {playerADetails.usbcNumber}
              </div>
            )}

            <div className={styles.playerStats}>
              {playerADetails?.average !== undefined && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Average</span>
                  <span className={styles.statValue}>{playerADetails.average}</span>
                </div>
              )}
              {playerADetails?.handicap !== undefined && bracketType === 'handicap' && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Handicap</span>
                  <span className={styles.statValue}>{playerADetails.handicap}</span>
                </div>
              )}
              {match.qualifying_score_a !== undefined && match.qualifying_score_a !== null && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Qualifying</span>
                  <span className={styles.statValue}>{match.qualifying_score_a}</span>
                </div>
              )}
            </div>

            <div className={styles.matchScore}>
              <span className={styles.scoreLabel}>Match Score</span>
              <span className={`${styles.scoreValue} ${match.winner === 'A' ? styles.winnerScore : ''}`}>
                {match.scoreA !== undefined && match.scoreA !== null ? match.scoreA : '-'}
              </span>
            </div>

            {playerADetails?.tournamentRecord && (
              <div className={styles.tournamentRecord}>
                Record: {playerADetails.tournamentRecord}
              </div>
            )}
          </div>

          {/* VS Divider */}
          <div className={styles.vsDivider}>
            <span className={styles.vsText}>VS</span>
            {match.scoreA !== undefined && match.scoreB !== undefined && 
             match.scoreA !== null && match.scoreB !== null && (
              <div className={styles.marginIndicator}>
                Margin: {Math.abs(match.scoreA - match.scoreB)}
              </div>
            )}
          </div>

          {/* Player B */}
          <div className={`${styles.playerCard} ${match.winner === 'B' ? styles.winnerCard : ''}`}>
            <div className={styles.playerCardHeader}>
              {match.winner === 'B' && <span className={styles.winnerBadge}>🏆 Winner</span>}
            </div>
            
            <h3 className={styles.playerName}>
              {playerBDetails?.fullName || match.playerB || 'TBD'}
            </h3>

            {playerBDetails?.usbcNumber && (
              <div className={styles.usbcNumber}>
                USBC: {playerBDetails.usbcNumber}
              </div>
            )}

            <div className={styles.playerStats}>
              {playerBDetails?.average !== undefined && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Average</span>
                  <span className={styles.statValue}>{playerBDetails.average}</span>
                </div>
              )}
              {playerBDetails?.handicap !== undefined && bracketType === 'handicap' && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Handicap</span>
                  <span className={styles.statValue}>{playerBDetails.handicap}</span>
                </div>
              )}
              {match.qualifying_score_b !== undefined && match.qualifying_score_b !== null && (
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Qualifying</span>
                  <span className={styles.statValue}>{match.qualifying_score_b}</span>
                </div>
              )}
            </div>

            <div className={styles.matchScore}>
              <span className={styles.scoreLabel}>Match Score</span>
              <span className={`${styles.scoreValue} ${match.winner === 'B' ? styles.winnerScore : ''}`}>
                {match.scoreB !== undefined && match.scoreB !== null ? match.scoreB : '-'}
              </span>
            </div>

            {playerBDetails?.tournamentRecord && (
              <div className={styles.tournamentRecord}>
                Record: {playerBDetails.tournamentRecord}
              </div>
            )}
          </div>
        </div>

        {/* Upset Indicator */}
        {((match.winner === 'A' && match.seedA !== null && match.seedB !== null && match.seedA > match.seedB) ||
          (match.winner === 'B' && match.seedA !== null && match.seedB !== null && match.seedB > match.seedA)) && (
          <div className={styles.upsetAlert}>
            ⚡ <strong>UPSET!</strong> Lower seed defeated higher seed
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.modalActions}>
          <button 
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
