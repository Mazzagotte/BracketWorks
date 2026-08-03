'use client'

import React from 'react'
import { createPortal } from 'react-dom'
import CloseControl from '../../components/CloseControl'
import styles from '../brackets/styles/explain-brackets-modal.module.css'
import modalStyles from '../styles/modals.module.css'
import { disableScroll, enableScroll } from '../utils/modalUtils'
import HelpGuideFooter from '../components/HelpGuideFooter'

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
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <div className={modalStyles.overlay} onClick={onClose}>
      <div className={modalStyles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={modalStyles.header}>
          <div><p className={modalStyles.kicker}>BracketWorks Help</p><h2>Scores Overview</h2></div>
          <CloseControl onClick={onClose} position="absolute" label="Close modal" className={modalStyles.closeButton} />
        </div>

        <div className={`${modalStyles.content} ${styles.content}`}>

          <section className={styles.section}>
            <h3>Entering Scores</h3>
            <p>
              Click any score cell to enter a scratch score.
              Scores save automatically shortly after you stop typing.
              You can also use arrow keys to move across cells quickly.
            </p>
            <p>
              You only enter scratch scores by hand.
              Handicap totals are calculated automatically from each bowler&apos;s handicap pins.
            </p>
          </section>
          <section className={styles.section}>
            <h3>Score Columns</h3>
            <p>Each row shows these columns for each bowler:</p>
            <ul>
              <li><strong>G1 / G2 / G3</strong> - Scratch score for each game</li>
              <li><strong>+H columns</strong> - Scratch plus handicap pins for each game</li>
              <li><strong>Scratch Total</strong> - Sum of all three scratch games</li>
              <li><strong>Handicap Total</strong> - Sum of all three handicap-adjusted games</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h3>Locking Scores</h3>
            <p>
              When you click Calculate Payouts, the scores table locks to prevent accidental edits.
              If you need to make a correction later, click Unlock Scores.
              Unlocking does not erase payout data.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Excel Export and Import</h3>
            <p>
              Use Export to Excel to download a sheet with bowler names and any existing scores.
              Update scores in the file, then import it back into BracketWorks.
              Import matches rows by bowler name, so column order can vary as long as headers are still present.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Offline Support</h3>
            <p>
              If your connection drops while entering scores, changes are kept in a pending queue.
              You will see a Sync Offline Scores button with a count of unsent saves.
              Click it once you are online again to send everything at once.
            </p>
          </section>
          <HelpGuideFooter section="scores" />

        </div>

      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
