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
              Look up bowlers from past tournaments by name or USBC number.
              When you select a result, the form fills in automatically so you do not have to type everything again.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Registering Bowlers</h3>
            <p>
              Use the entry form to add bowlers to the active squad.
              Each entry includes name, USBC number, and average.
              Average is used for handicap calculations in handicap programs.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Bracket Entries</h3>
            <p>
              For each bowler, choose the bracket programs they are entering, like Scratch, Handicap, Women&apos;s, Seniors, or Juniors.
              Entry fees are shown per program, and the total is calculated automatically.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Side Pot Entries</h3>
            <p>
              If side pots are enabled on the Dashboard (for example High Game Scratch or High Series Handicap), you can opt each bowler in one pot at a time.
              Side pots are tracked separately from bracket entries and paid out on the Payouts page.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tournament Summary</h3>
            <p>
              The summary at the top shows total bowlers, entries by program, and collected revenue for the squad.
              Bracket count is an estimate and can change based on final entries.
            </p>
          </section>
        </div>

      </div>
    </div>
  )
}
