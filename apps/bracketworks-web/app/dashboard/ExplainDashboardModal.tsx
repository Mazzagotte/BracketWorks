'use client'

import HelpGuideModal from '../components/HelpGuideModal'

interface ExplainDashboardModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainDashboardModal({ isOpen, onClose }: ExplainDashboardModalProps) {
  return (
    <HelpGuideModal open={isOpen} onClose={onClose} title="Dashboard guide" section="setup">
      <section>
        <h3>Where the workflow begins</h3>
        <p>
          The dashboard is the home for an event. It shows the active tournament and squad, summarizes progress,
          and opens tournament details, squad times, settings, and public sharing.
        </p>
      </section>
      <section>
        <h3>Tournaments</h3>
        <p>
          A tournament holds one event. Create a new one for each event, or load an existing one to keep working.
          Each tournament keeps its own settings, squads, and entries.
        </p>
      </section>
      <section>
        <h3>Squads</h3>
        <p>
          Squads are sessions inside one tournament, like a morning and an afternoon squad.
          Each squad has its own date, time, and brackets. Choose the squad you are working on from the dashboard.
        </p>
      </section>
      <section>
        <h3>Bracket settings</h3>
        <p>These control how brackets are built and how prize money is split.</p>
        <h4>Bracket size</h4>
        <p>How many bowlers go in each bracket. BracketWorks supports 8-bowler single-elimination brackets.</p>
        <h4>Entry fee</h4>
        <p>The cost of one bracket entry, used to calculate the prize pot.</p>
        <h4>1st and 2nd place</h4>
        <p>Fixed payouts for the winner and runner-up. The house take is the bracket size times the entry fee, minus both prizes.</p>
        <h4>Handicap</h4>
        <p>Set the percentage (for example 80%) and base score (for example 200). Handicap is the base minus the average, times the percentage.</p>
        <h4>Allow byes</h4>
        <p>Lets brackets run with fewer than a full field. Empty spots become byes that advance automatically and never meet each other.</p>
      </section>
      <section>
        <h3>Bracket programs</h3>
        <p>Programs are the bracket types you offer. Turn each one on or off; each is entered and scored separately.</p>
        <ul>
          <li><strong>Scratch</strong>: scores are used as bowled</li>
          <li><strong>Handicap</strong>: scores are adjusted by average so mixed-skill groups stay competitive</li>
          <li><strong>Women&apos;s, Seniors, and Juniors</strong>: optional programs in scratch and handicap versions</li>
        </ul>
      </section>
      <section>
        <h3>Side pots</h3>
        <p>
          Side pots are optional extras outside the bracket pool, like High game scratch or High series handicap.
          Set an entry fee and prize, and pay them out on the Payouts page.
        </p>
      </section>
    </HelpGuideModal>
  )
}
