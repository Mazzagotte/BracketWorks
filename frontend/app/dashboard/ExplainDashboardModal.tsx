'use client'

import React from 'react'
import CloseControl from '../../components/CloseControl'
import styles from '../brackets/styles/explain-brackets-modal.module.css'
import { disableScroll, enableScroll } from '../utils/modalUtils'

interface ExplainDashboardModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainDashboardModal({ isOpen, onClose }: ExplainDashboardModalProps) {
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
          <h2>How the Dashboard Works</h2>
          <CloseControl onClick={onClose} label="Close modal" />
        </div>

        <div className={styles.content}>
          <section className={styles.section}>
            <h3>Share QR</h3>
            <p>
              Generate a QR code that bowlers can scan to view the live public scoreboard for the current tournament.
              Great for posting at the lanes so players can follow along in real time.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tournaments</h3>
            <p>
              A tournament is the top-level container for all your bracket activity. Create a new tournament for each bowling event, or load a previous one to continue managing it.
              Each tournament stores its own bracket settings, squads, and registered bowlers.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Squads</h3>
            <p>
              Squads let you run multiple sessions within the same tournament, for example a morning squad and an afternoon squad on different days.
              Each squad has its own date, time, and set of brackets. Select the active squad using the squad pills at the top of the dashboard.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Bracket Settings</h3>
            <p>
              These settings control the structure and financials of every bracket in the selected tournament.
            </p>

            <div className={styles.bracketType}>
              <strong>Bracket Size</strong>
              <p>The number of players per bracket. Currently supports 8-player single-elimination brackets.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>Entry Fee</strong>
              <p>The cost for a bowler to enter one bracket. Used to calculate the total pot.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>1st &amp; 2nd Place Prizes</strong>
              <p>
                The fixed dollar amounts paid out to the bracket winner and runner-up.
                The house fee is automatically calculated as: <em>(Bracket Size × Entry Fee) − 1st Place − 2nd Place</em>.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Handicap</strong>
              <p>
                For handicap brackets, set the percentage (e.g. 80%) and base score (e.g. 200) used to compute each bowler&apos;s bonus pins.
                Handicap = (Base − Average) × Percentage.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Allow Byes</strong>
              <p>
                When enabled, brackets can start with fewer than the full bracket size by filling empty spots with bye slots.
                Byes automatically advance and are never matched against each other.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Bracket Programs</h3>
            <p>
              Programs define which types of brackets are offered. Toggle each one on or off per tournament.
              Each program type is tracked and scored independently.
            </p>

            <div className={styles.bracketType}>
              <strong>Scratch</strong>
              <p>Players compete on raw scores with no adjustments.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>Handicap</strong>
              <p>Scores are adjusted using each bowler&apos;s average to level the field.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>Women&apos;s / Seniors / Juniors</strong>
              <p>Optional programs that restrict entry to bowlers in those categories, each with independent scratch and handicap variants.</p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Side Pots</h3>
            <p>
              Side pots are optional add-on wagers separate from the main bracket prize pool, for example High Game Scratch or High Series Handicap.
              Set an entry fee and prize amount for each pot you enable. Payouts are managed on the Payouts page.
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
