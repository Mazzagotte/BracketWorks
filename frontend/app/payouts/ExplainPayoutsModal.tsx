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
              Payout values are set on the Dashboard under Bracket Settings.
              You define fixed amounts for 1st and 2nd place,
              and the house fee is whatever remains from total collected entry fees.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tied Finals (Split Pot)</h3>
            <p>
              If two bowlers stay tied through the finals, the pot is split evenly.
              Each bowler gets half of the combined 1st and 2nd place payouts.
              Example: if 1st is $8 and 2nd is $6, each bowler gets $7.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Marking Winners as Paid</h3>
            <p>
              Each winner row includes a Paid button.
              Click it to mark that bowler as paid and dim the row.
              Paid status is saved locally on this device until that tournament is cleared.
              Click Paid again to undo it.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Exporting Results</h3>
            <p>
              Use Export to Excel for a spreadsheet of winners and payout amounts.
              Use Export to PDF for a print-ready payout sheet you can hand out or post at the desk.
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
