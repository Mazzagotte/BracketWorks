'use client'

import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardDivider,
  CardHeader,
  ConfirmDialog,
  ICON_SIZE,
  Modal,
  Notice,
  TextAreaField,
  TextField,
} from '@bracketworks/ui'

import { apiClient } from '../../lib/api'
import { handleApiError } from '../../lib/errors'
import { ApiError } from '../../lib/errors'
import { formatCurrency } from '../../lib/formatters'
import { useToast } from '../../components/Toast'
import styles from './Payouts.module.css'

interface Reconciliation {
  entries: { count: number; missing_averages: number; unpaid: number; duplicates: number }
  brackets: { count: number; generated: boolean; entries_match: boolean }
  scores: { complete: number; total: number; all_complete: boolean; locked: boolean }
  payouts: {
    calculated: boolean
    collected: number
    expected_payout: number
    house_retained: number
    difference: number
  }
  public_results_ready: boolean
  blocking_errors: string[]
  warnings: string[]
  ready_to_finalize: boolean
}

interface Lifecycle {
  status: string
  finalized_at: string | null
}

type SavedPayout = { id: number; player_name: string; bracket_name: string; payout_amount: number }

interface SavedPayoutHistory {
  payouts: SavedPayout[]
  adjustments: Array<{ id: number; old_amount: number | null; new_amount: number | null; reason: string; adjusted_by: string; created_at: string }>
}

export default function TournamentFinalReview({ tournamentId, tournamentName, squadId }: { tournamentId: number; tournamentName: string; squadId: number | null }) {
  const { addToast } = useToast()
  const [review, setReview] = useState<Reconciliation | null>(null)
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [finalizing, setFinalizing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [history, setHistory] = useState<SavedPayoutHistory | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false)
  const [reopenOpen, setReopenOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [adjusting, setAdjusting] = useState<SavedPayout | null>(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      const query = squadId ? `?squad_id=${squadId}` : ''
      setHistory(await apiClient.get<SavedPayoutHistory>(`/api/v1/payouts/history/${tournamentId}${query}`, false))
    } catch (error) {
      if (!(error instanceof ApiError && error.statusCode === 404)) throw error
      setHistory(null)
    }
  }, [squadId, tournamentId])

  const loadReview = useCallback(async () => {
    setLoading(true)
    try {
      const [nextReview, nextLifecycle] = await Promise.all([
        apiClient.get<Reconciliation>(`/api/v1/tournament-reconciliation/${tournamentId}`, false),
        apiClient.get<Lifecycle>(`/api/v1/tournament-lifecycle/${tournamentId}`, false),
      ])
      setReview(nextReview)
      setLifecycle(nextLifecycle)
      await loadHistory()
    } catch (error) {
      addToast({ type: 'error', title: 'Final review unavailable', message: handleApiError(error).message })
    } finally {
      setLoading(false)
    }
  }, [addToast, loadHistory, tournamentId])

  useEffect(() => { void loadReview() }, [loadReview])

  const isFinalized = Boolean(lifecycle?.finalized_at)

  const finalize = async () => {
    if (!review?.ready_to_finalize || isFinalized) return
    setFinalizing(true)
    try {
      const nextLifecycle = await apiClient.post<Lifecycle>(`/api/v1/tournament-lifecycle/${tournamentId}/finalize`, {
        reason: 'Finalized from tournament final review',
      })
      setLifecycle(nextLifecycle)
      setConfirmFinalizeOpen(false)
      await loadReview()
      addToast({ type: 'success', title: 'Tournament finalized', message: 'Scores and tournament records are now read-only.' })
    } catch (error) {
      addToast({ type: 'error', title: 'Could not finalize tournament', message: handleApiError(error).message })
    } finally {
      setFinalizing(false)
    }
  }

  const reopen = async () => {
    const reason = reopenReason.trim()
    if (!isFinalized || !reason) return
    setReopening(true)
    try {
      const result = await apiClient.post<{ results_may_be_affected: boolean }>(`/api/v1/payouts/${tournamentId}/reopen`, { reason })
      setReopenOpen(false)
      await loadReview()
      addToast({
        type: 'warning',
        title: 'Payouts reopened',
        message: result.results_may_be_affected ? 'Scores remain locked. Published results may be affected by adjustments.' : 'Scores remain locked while payouts are reviewed.',
      })
    } catch (error) {
      addToast({ type: 'error', title: 'Could not reopen payouts', message: handleApiError(error).message })
    } finally {
      setReopening(false)
    }
  }

  const openAdjustment = (payout: SavedPayout) => {
    setAdjusting(payout)
    setAdjustAmount(payout.payout_amount.toFixed(2))
    setAdjustReason('')
  }

  const newAmount = Number(adjustAmount)
  const amountError = adjustAmount.trim() === '' || !Number.isFinite(newAmount) || newAmount < 0 ? 'Enter an amount of zero or more.' : undefined

  const saveAdjustment = async () => {
    const reason = adjustReason.trim()
    if (!adjusting || amountError || !reason) return
    setIsSavingAdjustment(true)
    try {
      await apiClient.patch(`/api/v1/payouts/${tournamentId}/items/${adjusting.id}`, { new_amount: newAmount, reason })
      await Promise.all([loadReview(), loadHistory()])
      addToast({ type: 'success', title: 'Payout adjusted', message: `${adjusting.player_name}'s payout was updated and recorded.` })
      setAdjusting(null)
    } catch (error) {
      addToast({ type: 'error', title: 'Could not adjust payout', message: handleApiError(error).message })
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  const statusBadge = isFinalized
    ? <Badge tone="success">Finalized</Badge>
    : review?.ready_to_finalize
      ? <Badge tone="success">Ready</Badge>
      : review ? <Badge tone="warning">Needs attention</Badge> : null

  return (
    <Card aria-labelledby="final-review-title">
      <CardHeader
        title={<span id="final-review-title">Final review</span>}
        description="Confirm entries, brackets, scores, and money before closing the tournament."
        actions={statusBadge}
      />

      {loading && !review ? <p className={styles.status} role="status">Checking tournament records...</p> : null}

      {review ? (
        <div className={styles.reviewBody}>
          <dl className={styles.reviewFacts}>
            <div><dt>Entries</dt><dd>{review.entries.count}</dd></div>
            <div><dt>Brackets</dt><dd>{review.brackets.count}</dd></div>
            <div><dt>Scores complete</dt><dd>{review.scores.complete} of {review.scores.total}</dd></div>
            <div><dt>Public results</dt><dd>{review.public_results_ready ? 'Ready' : 'Not ready'}</dd></div>
          </dl>

          <CardDivider />

          <dl className={styles.moneyRows}>
            <div><dt>Collected</dt><dd>{formatCurrency(review.payouts.collected)}</dd></div>
            <div><dt>Expected payout</dt><dd>{formatCurrency(review.payouts.expected_payout)}</dd></div>
            <div><dt>House retained</dt><dd>{formatCurrency(review.payouts.house_retained)}</dd></div>
            <div><dt>Difference</dt><dd className={styles.moneyEmphasis}>{formatCurrency(review.payouts.difference)}</dd></div>
          </dl>

          {review.blocking_errors.length > 0 ? (
            <Notice tone="danger">
              <strong>Resolve before finalizing</strong>
              <ul className={styles.noticeList}>{review.blocking_errors.map(item => <li key={item}>{item}</li>)}</ul>
            </Notice>
          ) : null}
          {review.warnings.length > 0 ? (
            <Notice tone="warning">
              <strong>Review before finalizing</strong>
              <ul className={styles.noticeList}>{review.warnings.map(item => <li key={item}>{item}</li>)}</ul>
            </Notice>
          ) : null}

          <div className={styles.reviewActions}>
            {isFinalized ? (
              <Button size="sm" variant="ghost-danger" className={styles.pushStart} disabled={reopening} onClick={() => { setReopenReason(''); setReopenOpen(true) }}>
                Reopen payouts
              </Button>
            ) : null}
            <Button variant="secondary" icon={<RefreshCw size={ICON_SIZE.md} aria-hidden="true" />} disabled={loading || finalizing} onClick={() => { void loadReview() }}>
              Refresh review
            </Button>
            <Button
              variant="primary"
              disabled={!review.ready_to_finalize || finalizing || isFinalized}
              onClick={() => setConfirmFinalizeOpen(true)}
            >
              {isFinalized ? 'Tournament finalized' : 'Finalize tournament'}
            </Button>
          </div>

          {history && history.payouts.length > 0 ? (
            <>
              <CardDivider />
              <div className={styles.historyHeader}>
                <h3 className={styles.subsectionTitle}>Payout history and adjustments</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowHistory(current => !current)} aria-expanded={showHistory}>
                  {showHistory ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showHistory ? (
                <>
                  <ul className={styles.historyList}>
                    {history.payouts.map(payout => (
                      <li key={payout.id} className={styles.historyRow}>
                        <span className={styles.resultIdentity}>
                          <span className={styles.resultName}>{payout.player_name}</span>
                          <span className={styles.meta}>{payout.bracket_name}</span>
                        </span>
                        <span className={styles.historyAmount}>{formatCurrency(payout.payout_amount)}</span>
                        <Button size="sm" variant="ghost" disabled={isFinalized} onClick={() => openAdjustment(payout)} aria-label={`Adjust payout for ${payout.player_name}`}>
                          Adjust
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {history.adjustments.length > 0 ? (
                    <ul className={styles.historyList}>
                      {history.adjustments.slice(0, 10).map(item => (
                        <li key={item.id} className={styles.adjustmentRow}>
                          <span className={styles.resultName}>
                            {item.old_amount == null ? 'Reopened payouts' : `${formatCurrency(item.old_amount)} to ${formatCurrency(item.new_amount ?? 0)}`}
                          </span>
                          <span className={styles.meta}>Reason: {item.reason} · {item.adjusted_by}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmFinalizeOpen}
        title={`Finalize ${tournamentName}?`}
        description="Scores and tournament records become read-only."
        confirmLabel="Finalize tournament"
        busy={finalizing}
        busyLabel="Finalizing..."
        onConfirm={() => { void finalize() }}
        onCancel={() => setConfirmFinalizeOpen(false)}
      />

      <Modal
        open={reopenOpen}
        onClose={() => setReopenOpen(false)}
        dismissible={!reopening}
        title="Reopen finalized payouts?"
        description={`Published results for ${tournamentName} may change. The reason is recorded.`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReopenOpen(false)} disabled={reopening}>Cancel</Button>
            <Button variant="danger" onClick={() => { void reopen() }} disabled={reopening || !reopenReason.trim()}>
              {reopening ? 'Reopening...' : 'Reopen payouts'}
            </Button>
          </>
        )}
      >
        <TextAreaField label="Reason" value={reopenReason} onChange={event => setReopenReason(event.target.value)} rows={3} autoFocus />
      </Modal>

      <Modal
        open={adjusting !== null}
        onClose={() => setAdjusting(null)}
        dismissible={!isSavingAdjustment}
        title="Adjust payout"
        description={adjusting ? `${adjusting.player_name} · ${adjusting.bracket_name}. The change and reason are recorded.` : undefined}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setAdjusting(null)} disabled={isSavingAdjustment}>Cancel</Button>
            <Button variant="primary" onClick={() => { void saveAdjustment() }} disabled={isSavingAdjustment || Boolean(amountError) || !adjustReason.trim()}>
              {isSavingAdjustment ? 'Saving...' : 'Save adjustment'}
            </Button>
          </>
        )}
      >
        <div className={styles.modalFields}>
          <TextField
            label="New amount"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={adjustAmount}
            onChange={event => setAdjustAmount(event.target.value)}
            error={adjustAmount.trim() !== '' ? amountError : undefined}
            autoFocus
          />
          <TextAreaField label="Reason" value={adjustReason} onChange={event => setAdjustReason(event.target.value)} rows={3} />
        </div>
      </Modal>
    </Card>
  )
}
