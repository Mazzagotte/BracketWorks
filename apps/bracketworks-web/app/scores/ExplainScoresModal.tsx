'use client'

import HelpGuideModal from '../components/HelpGuideModal'

interface ExplainScoresModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainScoresModal({ isOpen, onClose }: ExplainScoresModalProps) {
  return (
    <HelpGuideModal open={isOpen} onClose={onClose} title="Scores guide" section="scores">
      <section>
        <h3>Entering scores</h3>
        <p>
          Click any score cell to enter a scratch score. Scores save shortly after you stop typing,
          and the arrow keys move between cells.
        </p>
        <p>You only enter scratch scores. Handicap totals are calculated from each bowler&apos;s handicap pins.</p>
      </section>
      <section>
        <h3>Score columns</h3>
        <ul>
          <li><strong>Scratch</strong>: the scratch score for each game</li>
          <li><strong>Total</strong>: scratch plus handicap pins for each game</li>
          <li><strong>Scratch total</strong>: the three scratch games added together</li>
          <li><strong>Final total</strong>: the three handicap totals added together</li>
        </ul>
      </section>
      <section>
        <h3>Locking scores</h3>
        <p>
          Calculate payouts locks the scores so they are not changed by accident.
          To make a correction later, choose Unlock scores and give a reason. Unlocking does not erase payout data.
        </p>
      </section>
      <section>
        <h3>Excel export and import</h3>
        <p>
          Export to Excel downloads a sheet with bowler names and any existing scores.
          Update scores in the file, then import it back. Rows are matched by bowler name, so column order can change as long as the headers stay.
        </p>
      </section>
      <section>
        <h3>Working offline</h3>
        <p>
          If your connection drops while you enter scores, changes wait in a queue on this device.
          Sync offline scores shows how many are waiting. Choose it once you are back online to send them all.
        </p>
      </section>
    </HelpGuideModal>
  )
}
