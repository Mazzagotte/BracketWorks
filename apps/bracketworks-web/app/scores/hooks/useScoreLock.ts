'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Tournament, Squad } from '../../lib/types'
import { storage } from '../../lib/storage'
import { getPayoutUnlockKey, getScoresLockKey } from '../../lib/storageKeys'

type AddToast = (args: { message: string; type: 'success' | 'warning' | 'error'; duration?: number }) => void

export interface UseScoreLockResult {
  isScoresLocked: boolean
  unlockScoresTable: () => void
  unlockPayoutsAndGo: () => void
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
    if (!lockKey) { setIsScoresLocked(false); return }
    setIsScoresLocked(storage.getItem(lockKey) === '1')
  }, [tournament, selectedSquad])

  const unlockPayoutsAndGo = useCallback(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null

    if (tournamentId) {
      const unlockKey = getPayoutUnlockKey(tournamentId, squadId)
      const lockKey = getScoresLockKey(tournamentId, squadId)
      if (unlockKey) storage.setItem(unlockKey, '1')
      if (lockKey) storage.setItem(lockKey, '1')
      setIsScoresLocked(true)
    }

    sessionStorage.setItem('payouts_unlocked', '1')
    router.push('/payouts')
  }, [router, selectedSquad, tournament])

  const unlockScoresTable = useCallback(() => {
    const tournamentId = tournament?.id ?? null
    const squadId = selectedSquad?.id ?? null
    if (!tournamentId) return

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
