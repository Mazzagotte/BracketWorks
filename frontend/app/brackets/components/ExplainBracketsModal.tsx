'use client'

import React from 'react'
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

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

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
  }, [isOpen, onClose, enableScroll, disableScroll])

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>How Brackets Work</h2>
          <button 
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3>Single-Elimination Tournament</h3>
            <p>
              BracketWorks uses a single-elimination format, where the number of players defined on the dashboard determines the bracket structure.
              For example, with 8 players, the bracket consists of three rounds. Winners advance to the next round, while losers are eliminated — with a few exceptions in the case of ties.
            </p>
            <div className={styles.roundStructure}>
              <div className={styles.round}>
                <strong>Round 1 (Quarterfinals)</strong>
                <span>8 players → 4 winners</span>
              </div>
              <div className={styles.round}>
                <strong>Round 2 (Semifinals)</strong>
                <span>4 players → 2 winners</span>
              </div>
              <div className={styles.round}>
                <strong>Round 3 (Finals)</strong>
                <span>2 players → 1 champion</span>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Tie Resolution System</h3>
            <p>
              BracketWorks features a unique tie handling system that gives players a second chance:
            </p>
            
            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.tieBadge}>TIE</span>
                <strong>Round 1 &amp; 2 Ties — Both Players Advance</strong>
              </div>
              <p>
                When two players tie in Round 1 or Round 2, both advance to the next round.
                In that next round, their scores are compared against each other — the lower-scoring player is eliminated, and the higher-scoring player is declared the winner of the original tied match.
              </p>
              <div className={styles.example}>
                <strong>Example:</strong> Player A and Player B tie in Round 1 (both score 210), so both advance to Round 2.
                In Round 2, Player A scores 220 and Player B scores 180.
                Player B is eliminated, and Player A is declared the Round 1 winner and advances to the Finals.
              </div>
            </div>

            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.tieBadge}>TIE</span>
                <strong>Cascading Ties — Carried Forward Until Resolved</strong>
              </div>
              <p>
                If two players who tied in Round 1 are <em>also</em> tied in Round 2, both continue advancing to Round 3.
                Their Round 3 scores then resolve all previous ties — the higher scorer wins, the lower scorer is eliminated.
                Tying across all three games is extremely unlikely, but if it happens, the pot is split.
              </p>
              <div className={styles.example}>
                <strong>Example:</strong> Player A and Player B tie in both Round 1 and Round 2 (scores 210 and 215).
                Both advance to the Finals. Player A scores 240 in Round 3, Player B scores 220.
                Player A wins the bracket. Player B is eliminated.
              </div>
            </div>

            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.splitBadge}>SPLIT</span>
                <strong>Finals Tie — Split Pot</strong>
              </div>
              <p>
                If the Finals match ends in a tie (and there are no unresolved carry-over ties from earlier rounds), both finalists split the prize pot evenly.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Bracket Types</h3>
            
            <div className={styles.bracketType}>
              <strong>Scratch Brackets</strong>
              <p>
                Players compete using their actual bowling scores without any adjustments. 
                The player with the higher score wins each match.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Handicap Brackets</strong>
              <p>
                Scores are adjusted according to each player&apos;s average to level the playing field. Players with lower averages receive bonus pins, creating a more balanced competition.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Match Progression</h3>
            <p>
              Players are randomly placed into brackets. The system can optionally avoid rematches from previous tournaments if match history tracking is enabled.
              Each match displays:
            </p>
            <ul>
              <li><strong>Player names</strong> - Click to view player details</li>
              <li><strong>Scores</strong> - Game scores for each player</li>
              <li><strong>Status badges</strong> - TIE or SPLIT indicators when applicable</li>
              <li><strong>Winner highlight</strong> - Green border around the winning player</li>
            </ul>
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.closeButtonFooter} onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}
