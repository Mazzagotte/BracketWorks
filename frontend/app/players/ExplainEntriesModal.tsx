'use client'

import React from 'react'
import CloseControl from '../../components/CloseControl'
import styles from '../brackets/styles/explain-brackets-modal.module.css'
import { disableScroll, enableScroll } from '../utils/modalUtils'

interface ExplainEntriesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainEntriesModal({ isOpen, onClose }: ExplainEntriesModalProps) {
  React.useEffect(() => {
    return () => {
      enableScroll()
    }
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

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>How Entries Work</h2>
          <CloseControl onClick={onClose} label="Close modal" />
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3>History Search</h3>
            <p>
              Search for bowlers who have entered previous tournaments by name or USBC number.
              Selecting a result pre-fills the entry form with their saved information, so no need to re-enter their average or USBC number.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Registering Bowlers</h3>
            <p>
              Use the entry form to add bowlers to the selected squad. Each bowler is registered with their name, USBC number, and average.
              The average is used to calculate handicap scores for any handicap bracket programs.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Bracket Entries</h3>
            <p>
              For each bowler, select which bracket programs they are entering, for example Scratch, Handicap, Women&apos;s, Seniors, or Juniors.
              Each enabled program shows its entry fee. The total cost for the bowler is calculated automatically.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Side Pot Entries</h3>
            <p>
              If side pots are enabled on the Dashboard (e.g., High Game Scratch, High Series Handicap), you can opt each bowler in per pot.
              Side pot entries are tracked separately from bracket entries and are paid out on the Payouts page.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tournament Summary</h3>
            <p>
              The summary at the top of the entries list shows the total players, entries per program, and revenue collected for the squad.
              The bracket count is an estimate, actual brackets may vary.
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
