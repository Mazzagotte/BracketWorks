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
              Generate a QR code bowlers can scan to open the live public scoreboard for the current tournament.
              It works well on a flyer or at the front desk so everyone can follow along.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Tournaments</h3>
            <p>
              Think of a tournament as the home for one event.
              Create a new one for each event, or reopen an existing one to keep working.
              Each tournament keeps its own settings, squads, and entries.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Squads</h3>
            <p>
              Squads let you run multiple sessions inside the same tournament, like a morning squad and an afternoon squad.
              Each squad has its own date, time, and bracket set.
              Use the squad pills at the top to choose which squad you are working on.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Bracket Settings</h3>
            <p>
              These settings control how brackets are built and how prize money is split for the selected tournament.
            </p>

            <div className={styles.bracketType}>
              <strong>Bracket Size</strong>
              <p>How many bowlers go into each bracket. Right now BracketWorks supports 8-player single-elimination brackets.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>Entry Fee</strong>
              <p>How much one bracket entry costs. This is used to calculate the prize pot.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>1st &amp; 2nd Place Prizes</strong>
              <p>
                Set the fixed payouts for the winner and runner-up.
                House fee is calculated automatically as: <em>(Bracket Size × Entry Fee) − 1st Place − 2nd Place</em>.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Handicap</strong>
              <p>
                For handicap brackets, set the percentage (for example 80%) and base score (for example 200).
                BracketWorks uses those values to calculate bonus pins with: Handicap = (Base − Average) × Percentage.
              </p>
            </div>

            <div className={styles.bracketType}>
              <strong>Allow Byes</strong>
              <p>
                Turn this on if you want brackets to run with fewer than a full field.
                Empty spots become bye slots that auto-advance and are never matched against each other.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Bracket Programs</h3>
            <p>
              Programs are the bracket types you want to offer in this tournament.
              Turn each one on or off as needed. Each program is tracked and scored separately.
            </p>

            <div className={styles.bracketType}>
              <strong>Scratch</strong>
              <p>Bowler scores are used as-is, with no handicap adjustment.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>Handicap</strong>
              <p>Scores are adjusted by average so mixed-skill groups stay competitive.</p>
            </div>

            <div className={styles.bracketType}>
              <strong>Women&apos;s / Seniors / Juniors</strong>
              <p>Optional category programs with their own entries and standings, available in scratch and handicap versions.</p>
            </div>
          </section>

          <section className={styles.section}>
            <h3>Side Pots</h3>
            <p>
              Side pots are optional add-ons outside the main bracket pool, like High Game Scratch or High Series Handicap.
              Set an entry fee and payout for each pot you enable.
              You can manage side pot payouts on the Payouts page.
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
