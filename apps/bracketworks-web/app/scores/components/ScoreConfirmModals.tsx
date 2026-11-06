import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button, Modal, TextAreaField } from '@bracketworks/ui'

import styles from './ScoreModals.module.css'

interface CalcPayoutsModalProps {
  open: boolean
  missingScoreNames: string[]
  playerCount: number
  onClose: () => void
  onProceed: () => void
}

/**
 * Shown when the user clicks "Calculate payouts".
 * Warns about missing scores or confirms when all scores are present.
 */
export function CalcPayoutsModal({
  open,
  missingScoreNames,
  playerCount,
  onClose,
  onProceed,
}: CalcPayoutsModalProps) {
  const hasMissing = missingScoreNames.length > 0

  if (hasMissing) {
    return (
      <Modal
        open={open}
        onClose={onClose}
        role="alertdialog"
        title="Missing scores"
        description={`${missingScoreNames.length === 1 ? '1 bowler is' : `${missingScoreNames.length} bowlers are`} missing one or more game scores. Enter every score before calculating payouts so the results are accurate.`}
        footer={(
          <>
            <Button variant="secondary" onClick={onProceed}>Proceed anyway</Button>
            <Button variant="primary" onClick={onClose}>Go back and enter scores</Button>
          </>
        )}
      >
        <ul className={styles.nameList}>
          {missingScoreNames.map((name, index) => (
            <li key={`${name}-${index}`} className={styles.nameRow}>{name}</li>
          ))}
        </ul>
      </Modal>
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      role="alertdialog"
      title="All scores complete"
      description={`All ${playerCount} bowler${playerCount !== 1 ? 's' : ''} have scores for all 3 games. Confirm these scores are final before calculating payouts. Winners are determined from these results.`}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onProceed}>Confirm and calculate payouts</Button>
        </>
      )}
    />
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      role="alertdialog"
      title="Brackets out of date"
      description="Entries have changed since brackets were generated. Regenerate brackets on the Brackets page before calculating payouts."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Go back</Button>
          <Button variant="primary" onClick={() => { onClose(); router.push('/brackets') }}>Go to brackets</Button>
        </>
      )}
    />
  )
}

interface UnlockScoresModalProps {
  open: boolean
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}

export function UnlockScoresModal({
  open,
  isSubmitting,
  onClose,
  onConfirm,
}: UnlockScoresModalProps) {
  const [reason, setReason] = useState('')
  const trimmedReason = reason.trim()

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!isSubmitting}
      title="Unlock scores?"
      description="Existing payouts may no longer be valid, and score changes are recorded. Add a short reason before reopening score entry."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(trimmedReason)} disabled={isSubmitting || !trimmedReason}>
            {isSubmitting ? 'Unlocking...' : 'Unlock scores'}
          </Button>
        </>
      )}
    >
      <TextAreaField
        label="Reason"
        value={reason}
        onChange={event => setReason(event.target.value)}
        helper="For example: correcting a posted game 2 score"
        rows={3}
        autoFocus
      />
    </Modal>
  )
}

interface ScoreCorrectionModalProps {
  request: {
    playerName: string
    field: string
    previousValue: number | null
    nextValue: number | undefined
  } | null
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export function ScoreCorrectionModal({ request, onCancel, onConfirm }: ScoreCorrectionModalProps) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    setReason('')
  }, [request])

  const gameNumber = request?.field.match(/^game([123])_scratch$/)?.[1] || ''
  const previousValue = request?.previousValue ?? 'blank'
  const nextValue = request?.nextValue ?? 'blank'
  const trimmedReason = reason.trim()

  return (
    <Modal
      open={request !== null}
      onClose={onCancel}
      title="Confirm score correction"
      footer={(
        <>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={() => onConfirm(trimmedReason)} disabled={!trimmedReason}>Save correction</Button>
        </>
      )}
    >
      {request ? (
        <div className={styles.body}>
          <p className={styles.text}>
            Change game {gameNumber} for <strong>{request.playerName}</strong> from{' '}
            <strong>{previousValue}</strong> to <strong>{nextValue}</strong>? This correction is recorded.
          </p>
          <TextAreaField
            label="Reason"
            value={reason}
            onChange={event => setReason(event.target.value)}
            helper="For example: correcting a posted game 2 score"
            rows={3}
            autoFocus
          />
        </div>
      ) : null}
    </Modal>
  )
}
