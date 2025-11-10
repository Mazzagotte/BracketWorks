'use client'

import React from 'react'
import styles from '../styles/explain-brackets-modal.module.css'

interface ExplainBracketsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainBracketsModal({ isOpen, onClose }: ExplainBracketsModalProps) {
  if (!isOpen) return null

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

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
              BracketWorks uses a single-elimination format where 8 players compete through 3 rounds. 
              Winners advance to the next round, while losers are eliminated (with some exceptions for ties).
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
                <strong>Round 1 &amp; 2 Ties - Both Players Advance</strong>
              </div>
              <p>
                When two players tie in Round 1 or Round 2, both advance to the next round. 
                The player who scores lower in the next round is then eliminated, and their 
                opponent is declared the winner of the tied match.
              </p>
              <div className={styles.example}>
                <strong>Example:</strong> Player A and Player B tie in Round 1. Both advance to Round 2. 
                In Round 2, Player A scores 220 and Player B scores 180. Player B is eliminated, 
                and Player A wins the original Round 1 match.
              </div>
            </div>

            <div className={styles.tieRule}>
              <div className={styles.tieHeader}>
                <span className={styles.splitBadge}>SPLIT</span>
                <strong>Round 3 (Finals) Ties - Split Pot</strong>
              </div>
              <p>
                When the finals match ends in a tie, both finalists share the prize pot equally. 
                No further rounds are played.
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
                Scores are adjusted based on each player's average to level the playing field. 
                Lower-average players receive bonus points, making competition more balanced.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Match Progression</h3>
            <p>
              Players are seeded into the bracket based on their tournament performance. 
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
