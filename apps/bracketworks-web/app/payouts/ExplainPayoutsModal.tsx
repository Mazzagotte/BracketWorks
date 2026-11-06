'use client'

import HelpGuideModal from '../components/HelpGuideModal'

interface ExplainPayoutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ExplainPayoutsModal({ isOpen, onClose }: ExplainPayoutsModalProps) {
  return (
    <HelpGuideModal open={isOpen} onClose={onClose} title="Payouts guide" section="payouts">
      <section>
        <h3>How payouts are set</h3>
        <p>
          Payout amounts are set in tournament settings under Bracket settings.
          You choose fixed amounts for 1st and 2nd place, and the house take is whatever remains of the entry fees collected.
        </p>
      </section>
      <section>
        <h3>Tied finals (split pot)</h3>
        <p>
          If two bowlers stay tied through the final, the pot is split evenly: each gets half of the 1st and 2nd place payouts combined.
          For example, if 1st is $8 and 2nd is $6, each bowler gets $7.
        </p>
      </section>
      <section>
        <h3>Marking winners as paid</h3>
        <p>
          Each winner has a Mark paid button. Once paid, the row shows a Paid badge; select it to undo.
          Paid status and the time it was marked are saved in this browser for the tournament.
        </p>
      </section>
      <section>
        <h3>Exporting results</h3>
        <p>
          Export to Excel gives a spreadsheet of winners and payout amounts. Export to PDF gives a print-ready payout sheet for the desk.
          Paid rows show their saved payment time in the signature column, and unpaid rows keep a blank signature line.
          Older paid records without a time show &quot;Time not recorded&quot;. Payment records are not synced to other devices.
        </p>
      </section>
    </HelpGuideModal>
  )
}
