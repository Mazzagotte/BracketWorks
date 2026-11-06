'use client'

import HelpGuideModal from '../components/HelpGuideModal'

interface ExplainEntriesModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainEntriesModal({ isOpen, onClose }: ExplainEntriesModalProps) {
  return (
    <HelpGuideModal open={isOpen} onClose={onClose} title="Entries guide" section="entries">
      <section>
        <h3>Saved bowlers</h3>
        <p>
          Start typing a first or last name in Add bowler to find bowlers from past tournaments.
          Choose a match and the form fills in, so you do not have to type everything again.
        </p>
      </section>
      <section>
        <h3>Registering bowlers</h3>
        <p>
          Use Add bowler to register a bowler for the active squad with their name, USBC number, and average.
          Average is used for handicap calculations in handicap programs.
        </p>
      </section>
      <section>
        <h3>Bracket entries</h3>
        <p>
          Choose how many entries each bowler has in each bracket program, like Scratch, Handicap, Women&apos;s, Seniors, or Juniors.
          Entry fees are shown per program and the total is calculated for you.
        </p>
      </section>
      <section>
        <h3>Side pots</h3>
        <p>
          If side pots are turned on in tournament settings (for example High game scratch or High series handicap), check the pots each bowler enters.
          Side pots are tracked separately from bracket entries and paid out on the Payouts page.
        </p>
      </section>
      <section>
        <h3>Entry totals</h3>
        <p>
          The numbers at the top show total entries, entry revenue, entries per program, and side pots for the squad.
          Bracket counts are projections and can change with final entries.
        </p>
      </section>
    </HelpGuideModal>
  )
}
