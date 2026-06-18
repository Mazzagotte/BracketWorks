'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import CloseControl from '../../../components/CloseControl'
import styles from '../styles/explain-brackets-modal.module.css'
import { disableScroll, enableScroll } from '../../utils/modalUtils'

interface ExplainBracketsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainBracketsModal({ isOpen, onClose }: ExplainBracketsModalProps) {
  // Cleanup on mount to ensure document state is clean
  React.useEffect(() => {
    return () => {
      enableScroll()
    }
  }, [])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    if (isOpen) {
      disableScroll()
      document.addEventListener('keydown', handleEscape)
    }
    
    return () => {
      enableScroll()
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2>How Brackets Work</h2>
          <CloseControl onClick={onClose} label="Close modal" />
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3>Single-Elimination Tournament</h3>
            <p>
              BracketWorks runs single-elimination brackets.
              The bracket size you choose on the Dashboard determines the number of rounds.
              With 8 players, there are three rounds. Winners move on and losers are out, except in special tie cases.
            </p>
            <div className={styles.roundStructure}>
              <div className={styles.round}>
                <strong>Round 1 (Quarterfinals)</strong>
                <span>8 players to 4 winners</span>
              </div>
              <div className={styles.round}>
                <strong>Round 2 (Semifinals)</strong>
                <span>4 players to 2 winners</span>
              </div>
              <div className={styles.round}>
                <strong>Round 3 (Finals)</strong>
                <span>2 players to 1 champion</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Tie Resolution System</h3>
            <p>
              Tie handling gives bowlers a fair second chance:
            </p>
            
            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.tieBadge}>TIE</span>
                <strong>Round 1 &amp; 2 Ties: Both Players Advance</strong>
              </div>
              <p>
                If two players tie in Round 1 or Round 2, both move to the next round.
                Their next-round scores are then compared against each other.
                Lower score is eliminated, and the higher score is treated as the winner of the original tied match.
              </p>
              <div className={styles.example}>
                <strong>Example:</strong> Player A and Player B tie in Round 1 at 210, so both advance.
                In Round 2, Player A scores 220 and Player B scores 180.
                Player B is eliminated, and Player A continues as the Round 1 winner.
              </div>
            </div>

            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.tieBadge}>TIE</span>
                <strong>Cascading Ties: Carried Forward Until Resolved</strong>
              </div>
              <p>
                If players tie in one round and then tie again in the next round, both keep advancing until the tie is broken.
                The first round where scores differ resolves the carried tie.
                If they tie all the way through finals, the pot is split.
              </p>
              <div className={styles.example}>
                <strong>Example:</strong> Player A and Player B tie in Round 1 and Round 2.
                In finals, Player A shoots 240 and Player B shoots 220.
                Player A wins the bracket, and Player B is eliminated.
              </div>
            </div>

            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.splitBadge}>SPLIT</span>
                <strong>Finals Tie: Split Pot</strong>
              </div>
              <p>
                If finals ends in a tie and there is no unresolved carry-over tie, both finalists split the prize pot evenly.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Bracket Types</h3>
            
            <div className={styles.bracketType}>
              <strong>Scratch Brackets</strong>
              <p>
                Bowlers compete on raw game scores with no adjustments.
                Higher score wins each match.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Handicap Brackets</strong>
              <p>
                Scores are adjusted by average to level the field.
                Bowlers with lower averages receive bonus pins.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Reverse Brackets</strong>
              <p>
                In a standard bracket, Game 1 decides Round 1, Game 2 decides Round 2, and Game 3 decides finals.
                Reverse brackets flip that order: Game 3, then Game 2, then Game 1.
                Reverse is available for both Scratch and Handicap formats.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Match Progression</h3>
            <p>
              Bowlers are assigned to brackets at random.
              If match history is enabled, BracketWorks can avoid recent rematches.
              Each match card shows:
            </p>
            <ul>
              <li><strong>Player names</strong> - Click to view details</li>
              <li><strong>Scores</strong> - Game scores for each bowler</li>
              <li><strong>Status badges</strong> - TIE or SPLIT when needed</li>
              <li><strong>Winner highlight</strong> - Green border around the winner</li>
            </ul>
          </section>
        </div>

      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
