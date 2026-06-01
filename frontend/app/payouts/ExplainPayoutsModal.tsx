'use client'

import React from 'react'
import CloseControl from '../../components/CloseControl'
import styles from '../brackets/styles/explain-brackets-modal.module.css'
import { disableScroll, enableScroll } from '../utils/modalUtils'

interface ExplainPayoutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainPayoutsModal({ isOpen, onClose }: ExplainPayoutsModalProps) {
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

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Payouts Guide</h2>
          <CloseControl onClick={onClose} label="Close modal" />
        </div>

        <div className={styles.content}>

          <section className={styles.section}>
            <h3>How Payouts Are Configured</h3>
            <p>
              Payout amounts are set directly on the dashboard in Bracket Settings.
              The 1st place and 2nd place dollar amounts are fixed values you enter,
              and the house fee is the remainder of what was collected.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tied Finals (Split Pot)</h3>
            <p>
              If two bowlers tie through all rounds of a bracket, the pot is split evenly between them.
              Each player receives the 1st place prize plus the 2nd place prize divided by two.
              For example, if 1st pays $8 and 2nd pays $6, each tied bowler receives $7.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Marking Winners as Paid</h3>
            <p>
              Each winner row has a Paid button. Tap it to mark that bowler as paid and dim their row.
              Paid status is saved locally on this device and persists until the tournament is cleared.
              Tap Paid again to undo.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Exporting Results</h3>
            <p>
              Use Export to Excel to download a spreadsheet of all winners and payout amounts.
              Use Export to PDF to generate a print-ready payout sheet you can hand out or post at the desk.
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
