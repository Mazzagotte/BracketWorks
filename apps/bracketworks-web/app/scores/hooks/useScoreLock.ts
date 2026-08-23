'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Tournament, Squad } from '../../lib/types'
import { storage } from '../../lib/storage'
import { getPayoutUnlockKey, getScoresLockKey } from '../../lib/storageKeys'
import { apiClient } from '../../lib/api'
import { handleApiError } from '../../lib/errors'

type AddToast = (args: { message: string; type: 'success' | 'warning' | 'error'; duration?: number }) => void

export interface UseScoreLockResult {
  isScoresLocked: boolean
  unlockScoresTable: () => Promise<void>
  unlockPayoutsAndGo: () => Promise<void>
}

/**
 * Owns scores-lock state and payout navigation.
 * Lock is stored in localStorage so it survives navigation between
 * the scores and payouts pages within the same session.
 */
export function useScoreLock(
  tournament: Tournament | null,
  selectedSquad: Squad | null,
  addToast: AddToast,
): UseScoreLockResult {
  const router = useRouter()
  const [isScoresLocked, setIsScoresLocked] = useState(false)

  // Re-evaluate lock on tournament/squad change
  useEffect(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    const lockKey = getScoresLockKey(tournamentId, squadId)
    if (!lockKey || !tournamentId) { setIsScoresLocked(false); return }
    let active = true
    apiClient.get<{ scores_locked: boolean }>(`/api/v1/tournament-lifecycle/${tournamentId}`, false)
      .then(result => {
        if (!active) return
        setIsScoresLocked(result.scores_locked)
        if (result.scores_locked) storage.setItem(lockKey, '1'); else storage.removeItem(lockKey)
      })
      .catch(() => { if (active) setIsScoresLocked(storage.getItem(lockKey) === '1') })
    return () => { active = false }
  }, [tournament, selectedSquad])

  const unlockPayoutsAndGo = useCallback(async () => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null

    if (tournamentId) {
      try {
        await apiClient.post(`/api/v1/scores/${tournamentId}/lock`, { reason: 'Scores confirmed for payout calculation' })
      } catch (error) {
        addToast({ message: handleApiError(error).message, type: 'error', duration: 5000 })
        return
      }
      const unlockKey = getPayoutUnlockKey(tournamentId, squadId)
      const lockKey = getScoresLockKey(tournamentId, squadId)
      if (unlockKey) storage.setItem(unlockKey, '1')
      if (lockKey) storage.setItem(lockKey, '1')
      setIsScoresLocked(true)
    }

    sessionStorage.setItem('payouts_unlocked', '1')
    router.push('/payouts')
  }, [addToast, router, selectedSquad, tournament])

  const unlockScoresTable = useCallback(async () => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    if (!tournamentId) return

    if (!window.confirm('Unlock scores? Existing payouts may be invalidated and score changes will be audited.')) return
    const reason = window.prompt('Reason for unlocking scores:')?.trim()
    if (!reason) {
      addToast({ message: 'A reason is required to unlock scores.', type: 'warning', duration: 3500 })
      return
    }
    try {
      await apiClient.post(`/api/v1/scores/${tournamentId}/unlock`, { reason })
    } catch (error) {
      addToast({ message: handleApiError(error).message, type: 'error', duration: 5000 })
      return
    }

    const lockKey = getScoresLockKey(tournamentId, squadId)
    const payoutKey = getPayoutUnlockKey(tournamentId, squadId)
    if (lockKey) storage.removeItem(lockKey)
    if (payoutKey) storage.removeItem(payoutKey)
    sessionStorage.removeItem('payouts_unlocked')
    setIsScoresLocked(false)

    addToast({
      message: 'Scores unlocked. Payout access revoked until Calculate Payouts is clicked again.',
      type: 'success',
      duration: 4000,
    })
  }, [addToast, selectedSquad, tournament])

  return { isScoresLocked, unlockScoresTable, unlockPayoutsAndGo }
}
