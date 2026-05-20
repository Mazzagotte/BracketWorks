'use client'

import React from 'react'
import CloseControl from '../../components/CloseControl'
import styles from '../brackets/styles/explain-brackets-modal.module.css'
import { disableScroll, enableScroll } from '../utils/modalUtils'

interface ExplainScoresModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainScoresModal({ isOpen, onClose }: ExplainScoresModalProps) {
  React.useEffect(() => {
    return () => { enableScroll() }
  }, [])

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      disableScroll()
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      enableScroll()
      document.removeEventListener('keydown', handleEscape)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Scores Guide</h2>
          <CloseControl onClick={onClose} label="Close modal" />
        </div>

        <div className={styles.content}>

          <section className={styles.section}>
            <h3>Entering Scores</h3>
            <p>
              Click any score cell in the table to enter a scratch score for that game.
              Scores save automatically a moment after you stop typing.
              You can also use the arrow keys to navigate between cells without lifting your hands off the keyboard.
            </p>
            <p>
              Only scratch scores are entered manually. Handicap totals are calculated automatically based on each bowler&apos;s handicap pins.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Score Columns</h3>
            <p>Each row shows the following columns for every bowler:</p>
            <ul>
              <li><strong>G1 / G2 / G3</strong> - Scratch score for each game</li>
              <li><strong>+H columns</strong> - Each game&apos;s scratch score plus the bowler&apos;s handicap pins</li>
              <li><strong>Scratch Total</strong> - Sum of all three scratch games</li>
              <li><strong>Handicap Total</strong> - Sum of all three handicap-adjusted games</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3>Locking Scores</h3>
            <p>
              Clicking Calculate Payouts locks the scores table to prevent accidental edits after payouts have been recorded.
              If you need to correct a score afterward, use the Unlock Scores button that appears in its place.
              Unlocking does not delete any payout data.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Excel Export and Import</h3>
            <p>
              Use Export to Excel to download a spreadsheet pre-filled with bowler names and any scores already entered.
              Fill in or correct scores in the file, then use Import from Excel to load them back.
              The import matches rows by bowler name, so the column order does not matter as long as the headers are intact.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Offline Support</h3>
            <p>
              If your internet connection drops while entering scores, changes are held in a pending queue.
              A Sync Offline Scores button appears showing how many saves are waiting.
              Tap it once you are back online to push all pending scores to the server at once.
            </p>
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
