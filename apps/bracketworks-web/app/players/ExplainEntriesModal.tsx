'use client'

import React, { useRef } from 'react'
import { createPortal } from 'react-dom'
import CloseControl from '../../components/CloseControl'
import styles from './ExplainEntriesModal.module.css'
import modalStyles from '../styles/modals.module.css'
import { useModalBehavior } from '../hooks/useModalBehavior'
import HelpGuideFooter from '../components/HelpGuideFooter'

interface ExplainEntriesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainEntriesModal({ isOpen, onClose }: ExplainEntriesModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const { onOverlayClick } = useModalBehavior({ open: isOpen, onClose, dialogRef })

  if (!isOpen) return null

  const modalContent = (
    <div className={modalStyles.overlay} onClick={onOverlayClick}>
      <div ref={dialogRef} className={modalStyles.modal} role="dialog" aria-modal="true" aria-label="Entries overview" tabIndex={-1}>
        <div className={modalStyles.header}>
          <div>
            <p className={modalStyles.kicker}>BracketWorks Help</p>
            <h2>Entries Overview</h2>
          </div>
          <CloseControl onClick={onClose} position="absolute" size="sm" label="Close modal" className={modalStyles.closeButton} />
        </div>

        <div className={`${modalStyles.content} ${styles.content}`}>
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
          <HelpGuideFooter section="entries" />
        </div>

      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modalContent, document.body)
}
