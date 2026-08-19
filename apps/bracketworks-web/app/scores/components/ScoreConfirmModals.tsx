import { useRouter } from 'next/navigation'

interface CalcPayoutsModalProps {
  open: boolean
  missingScoreNames: string[]
  playerCount: number
  onClose: () => void
  onProceed: () => void
}

/**
 * Shown when the user clicks "Calculate Payouts".
 * Warns about missing scores or confirms when all scores are present.
 */
export function CalcPayoutsModal({
  open,
  missingScoreNames,
  playerCount,
  onClose,
  onProceed,
}: CalcPayoutsModalProps) {
  if (!open) return null

  return (
    <div className="bw-scores-calc-overlay">
      <div className="bw-scores-calc-modal bw-scores-calc-modal-brand">
        {missingScoreNames.length > 0 ? (
          <>
            <div className="bw-scores-calc-head bw-scores-calc-head-brand">
              <h2 className="bw-scores-calc-title bw-scores-calc-title-warning">Missing Scores</h2>
            </div>
            <p className="bw-scores-calc-text bw-scores-calc-text-tight">
              The following{' '}
              {missingScoreNames.length === 1 ? 'bowler is' : `${missingScoreNames.length} bowlers are`}{' '}
              missing one or more game scores. All scores must be entered and finalized before calculating
              payouts to ensure accurate results.
            </p>
            <div className="bw-scores-calc-missing-list">
              {missingScoreNames.map((name, i) => (
                <div
                  key={i}
                  className={`bw-scores-calc-missing-item ${i < missingScoreNames.length - 1 ? 'bw-scores-calc-missing-item-border' : ''}`}
                >
                  {name}
                </div>
              ))}
            </div>
            <div className="bw-scores-calc-actions">
              <button className="bw-scores-calc-btn bw-scores-calc-btn-secondary" onClick={onClose}>
                Go Back &amp; Enter Scores
              </button>
              <button className="bw-scores-calc-btn bw-scores-calc-btn-primary bw-scores-calc-btn-warning" onClick={onProceed}>
                Proceed Anyway
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bw-scores-calc-head bw-scores-calc-head-brand">
              <h2 className="bw-scores-calc-title">All Scores Complete</h2>
            </div>
            <p className="bw-scores-calc-text">
              All {playerCount} bowler{playerCount !== 1 ? 's' : ''} have scores for all 3 games. Confirm
              these scores are final before calculating payouts. Winners will be determined from these results.
            </p>
            <div className="bw-scores-calc-actions">
              <button className="bw-scores-calc-btn bw-scores-calc-btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button className="bw-scores-calc-btn bw-scores-calc-btn-primary" onClick={onProceed}>
                Confirm &amp; Calculate Payouts
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface BracketMismatchModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Shown when bracket entry counts are out of date before proceeding to payouts.
 */
export function BracketMismatchModal({ open, onClose }: BracketMismatchModalProps) {
  const router = useRouter()
  if (!open) return null

  return (
    <div className="bw-scores-calc-overlay">
      <div className="bw-scores-calc-modal bw-scores-calc-modal-brand">
        <div className="bw-scores-calc-head bw-scores-calc-head-brand">
          <h2 className="bw-scores-calc-title bw-scores-calc-title-warning">Brackets Out of Date</h2>
        </div>
        <p className="bw-scores-calc-text">
          Entries have changed since brackets were generated. Please go to the Brackets page and
          regenerate brackets before calculating payouts.
        </p>
        <div className="bw-scores-calc-actions">
          <button className="bw-scores-calc-btn bw-scores-calc-btn-secondary" onClick={onClose}>
            Go Back
          </button>
          <button
            className="bw-scores-calc-btn bw-scores-calc-btn-primary"
            onClick={() => { onClose(); router.push('/brackets') }}
          >
            Go to Brackets
          </button>
        </div>
      </div>
    </div>
  )
}
