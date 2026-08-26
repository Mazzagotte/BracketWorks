'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../../lib/api'
import { handleApiError } from '../../lib/errors'
import { ApiError } from '../../lib/errors'
import { formatCurrency } from '../../lib/formatters'
import { useToast } from '../../components/Toast'
import cardStyles from '../../styles/cards.module.css'
import buttonStyles from '../../styles/buttons.module.css'
import styles from '../payouts.module.css'

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

interface SavedPayoutHistory {
  payouts: Array<{ id: number; player_name: string; bracket_name: string; payout_amount: number }>
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
  const [adjustingId, setAdjustingId] = useState<number | null>(null)

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

  const finalize = async () => {
    if (!review?.ready_to_finalize || lifecycle?.finalized_at) return
    if (!window.confirm(`Finalize ${tournamentName}? Scores and tournament records will become read-only.`)) return
    setFinalizing(true)
    try {
      const nextLifecycle = await apiClient.post<Lifecycle>(`/api/v1/tournament-lifecycle/${tournamentId}/finalize`, {
        reason: 'Finalized from tournament final review',
      })
      setLifecycle(nextLifecycle)
      await loadReview()
      addToast({ type: 'success', title: 'Tournament finalized', message: 'Scores and tournament records are now read-only.' })
    } catch (error) {
      addToast({ type: 'error', title: 'Could not finalize tournament', message: handleApiError(error).message })
    } finally {
      setFinalizing(false)
    }
  }

  const isFinalized = Boolean(lifecycle?.finalized_at)

  const reopen = async () => {
    if (!isFinalized) return
    if (!window.confirm(`Reopen finalized payouts for ${tournamentName}? Published results may change.`)) return
    const reason = window.prompt('Reason for reopening finalized payouts:')?.trim()
    if (!reason) {
      addToast({ type: 'warning', title: 'Reason required', message: 'Finalized payouts cannot be reopened without a reason.' })
      return
    }
    setReopening(true)
    try {
      const result = await apiClient.post<{ results_may_be_affected: boolean }>(`/api/v1/payouts/${tournamentId}/reopen`, { reason })
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

  const adjustPayout = async (payout: SavedPayoutHistory['payouts'][number]) => {
    if (isFinalized) {
      addToast({ type: 'warning', title: 'Reopen payouts first', message: 'Finalized payout values cannot be overwritten.' })
      return
    }
    const amountText = window.prompt(`New payout amount for ${payout.player_name}:`, payout.payout_amount.toFixed(2))
    if (amountText === null) return
    const newAmount = Number(amountText)
    if (!Number.isFinite(newAmount) || newAmount < 0) {
      addToast({ type: 'error', title: 'Invalid amount', message: 'Enter a valid payout amount of zero or more.' })
      return
    }
    const reason = window.prompt('Reason for this payout adjustment:')?.trim()
    if (!reason) {
      addToast({ type: 'warning', title: 'Reason required', message: 'Payout adjustments require a reason.' })
      return
    }
    setAdjustingId(payout.id)
    try {
      await apiClient.patch(`/api/v1/payouts/${tournamentId}/items/${payout.id}`, { new_amount: newAmount, reason })
      await Promise.all([loadReview(), loadHistory()])
      addToast({ type: 'success', title: 'Payout adjusted', message: `${payout.player_name}'s payout was updated and recorded.` })
    } catch (error) {
      addToast({ type: 'error', title: 'Could not adjust payout', message: handleApiError(error).message })
    } finally {
      setAdjustingId(null)
    }
  }

  return (
    <section className={`${cardStyles.card} ${styles.finalReviewCard}`} aria-labelledby="final-review-title">
      <div className={styles.finalReviewHeader}>
        <div>
          <h2 id="final-review-title" className={styles.finalReviewTitle}>Tournament Final Review</h2>
          <p className={styles.finalReviewIntro}>Confirm entries, brackets, scores, and money before closing the tournament.</p>
        </div>
        <span className={isFinalized ? styles.reviewReady : review?.ready_to_finalize ? styles.reviewReady : styles.reviewWarning}>
          {isFinalized ? 'Finalized' : review?.ready_to_finalize ? 'Ready' : 'Needs attention'}
        </span>
      </div>

      {loading && <p className={styles.finalReviewMessage}>Checking tournament records…</p>}

      {!loading && review && (
        <>
          <div className={styles.reviewGrid}>
            <div><strong>{review.entries.count}</strong><span>Entries</span></div>
            <div><strong>{review.brackets.count}</strong><span>Brackets</span></div>
            <div><strong>{review.scores.complete}/{review.scores.total}</strong><span>Scores complete</span></div>
            <div><strong>{review.public_results_ready ? 'Ready' : 'Not ready'}</strong><span>Public results</span></div>
          </div>

          <dl className={styles.moneyReview}>
            <div><dt>Collected</dt><dd>{formatCurrency(review.payouts.collected)}</dd></div>
            <div><dt>Expected payout</dt><dd>{formatCurrency(review.payouts.expected_payout)}</dd></div>
            <div><dt>House retained</dt><dd>{formatCurrency(review.payouts.house_retained)}</dd></div>
            <div><dt>Difference</dt><dd>{formatCurrency(review.payouts.difference)}</dd></div>
          </dl>

          {review.blocking_errors.length > 0 && (
            <div className={styles.reviewWarnings}>
              <strong>Resolve before finalizing</strong>
              <ul>{review.blocking_errors.map(error => <li key={error}>{error}</li>)}</ul>
            </div>
          )}
          {review.warnings.length > 0 && (
            <div className={styles.reviewNotices}>
              <strong>Review notices</strong>
              <ul>{review.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}

          <div className={styles.finalReviewActions}>
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}
              disabled={!review.ready_to_finalize || finalizing || isFinalized}
              onClick={() => { void finalize() }}
            >
              {isFinalized ? 'Tournament Finalized' : finalizing ? 'Finalizing…' : 'Finalize Tournament'}
            </button>
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`} disabled={loading || finalizing} onClick={() => { void loadReview() }}>
              Refresh Review
            </button>
            {isFinalized && (
              <button type="button" className={`${buttonStyles.button} ${buttonStyles.danger} ${buttonStyles.medium}`} disabled={reopening} onClick={() => { void reopen() }}>
                {reopening ? 'Reopening…' : 'Reopen Payouts'}
              </button>
            )}
          </div>

          {history && history.payouts.length > 0 && (
            <details className={styles.adjustmentDetails}>
              <summary>Payout adjustments and history</summary>
              <div className={styles.adjustmentRows}>
                {history.payouts.map(payout => (
                  <div key={payout.id}>
                    <span><strong>{payout.player_name}</strong><small>{payout.bracket_name}</small></span>
                    <span>{formatCurrency(payout.payout_amount)}</span>
                    <button type="button" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.small}`} disabled={adjustingId === payout.id || isFinalized} onClick={() => { void adjustPayout(payout) }}>
                      Adjust
                    </button>
                  </div>
                ))}
              </div>
              {history.adjustments.length > 0 && (
                <ul className={styles.adjustmentHistory}>
                  {history.adjustments.slice(0, 10).map(item => (
                    <li key={item.id}>{item.old_amount == null ? 'Reopened payouts' : `${formatCurrency(item.old_amount)} → ${formatCurrency(item.new_amount ?? 0)}`} — {item.reason} · {item.adjusted_by}</li>
                  ))}
                </ul>
              )}
            </details>
          )}
        </>
      )}
    </section>
  )
}
