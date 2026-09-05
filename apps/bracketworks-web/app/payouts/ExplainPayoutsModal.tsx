'use client'

import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import CloseControl from '../../components/CloseControl'
import styles from '../brackets/styles/explain-brackets-modal.module.css'
import modalStyles from '../styles/modals.module.css'
import { useModalBehavior } from '../hooks/useModalBehavior'
import HelpGuideFooter from '../components/HelpGuideFooter'

interface ExplainPayoutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainPayoutsModal({ isOpen, onClose }: ExplainPayoutsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { onOverlayClick } = useModalBehavior({ open: isOpen, onClose, dialogRef })

  if (!isOpen) return null

  const modalContent = (
    <div className={modalStyles.overlay} onClick={onOverlayClick}>
      <div ref={dialogRef} className={modalStyles.modal} role="dialog" aria-modal="true" aria-label="Payouts overview" tabIndex={-1}>
        <div className={modalStyles.header}>
          <div><p className={modalStyles.kicker}>BracketWorks Help</p><h2>Payouts Overview</h2></div>
          <CloseControl onClick={onClose} position="absolute" label="Close modal" className={modalStyles.closeButton} />
        </div>

        <div className={`${modalStyles.content} ${styles.content}`}>

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
          <HelpGuideFooter section="payouts" />

        </div>

      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
