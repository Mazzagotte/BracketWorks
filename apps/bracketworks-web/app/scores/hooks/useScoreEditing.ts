'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { MutableRefObject, Dispatch, SetStateAction } from 'react'
import { Player, Squad, Tournament, PendingScoreSave } from '../../lib/types'
import { API, apiFetch } from '../../lib/api'
import { logger } from '../../lib/logger'
import { getSelectedTournamentId, getSelectedSquadId } from '../../lib/selection-session'
import type { RowSaveState, ScoreEditHistory } from '../types'
import { validateScore } from '../utils/scoreUtils'

type AddToast = (args: { message: string; type: 'success' | 'warning' | 'error'; duration?: number }) => void

export interface UseScoreEditingArgs {
  players: Player[]
  setPlayers: Dispatch<SetStateAction<Player[]>>
  playersRef: MutableRefObject<Player[]>
  selectedSquadRef: MutableRefObject<Squad | null>
  tournament: Tournament | null
  isScoresLocked: boolean
  isOnline: boolean
  isMobile: boolean
  sessionToken: string | null
  addToast: AddToast
  pendingSaves: PendingScoreSave[]
  setPendingSaves: Dispatch<SetStateAction<PendingScoreSave[]>>
  paginatedItems: Player[]
}

export interface UseScoreEditingResult {
  rowSaveState: Record<number, RowSaveState>
  lastEdit: ScoreEditHistory | null
  clearGameConfirm: 2 | 3 | null
  setClearGameConfirm: Dispatch<SetStateAction<2 | 3 | null>>
  rowStateCounts: { saving: number; failed: number }
  markRowSaved: (playerId: number) => void
  updateScore: (
    playerId: number,
    field: string,
    value: number | undefined,
    options?: { trackHistory?: boolean; moveNextOnMobile?: boolean }
  ) => Promise<void>
  retryPlayerSave: (player: Player) => Promise<void>
  saveAllVisibleScores: () => Promise<void>
  undoLastEdit: () => void
  clearGameScores: (gameNumber: 2 | 3) => Promise<void>
  requestClearGame: (gameNumber: 2 | 3) => void
  handleKeyDown: (e: React.KeyboardEvent, playerId: number, field: string) => void
  focusNextMobileInput: (playerId: number, field: string) => void
}

const SCORE_SAVE_DEBOUNCE_MS = 500
const SCORE_FIELDS = ['game1_scratch', 'game2_scratch', 'game3_scratch'] as const

/**
 * Owns score-entry state: per-row save status, debounced API saves, undo history,
 * bulk save, and clear-game operations.
 *
 * Save flow: optimistic local state update → debounced API call → mark row as
 * saved/failed. Failed saves surface a toast and keep the entered value so the
 * user can retry without re-entering data.
 */
export function useScoreEditing({
  players,
  setPlayers,
  playersRef,
  selectedSquadRef,
  tournament,
  isScoresLocked,
  isOnline,
  isMobile,
  sessionToken,
  addToast,
  pendingSaves,
  setPendingSaves,
  paginatedItems,
}: UseScoreEditingArgs): UseScoreEditingResult {
  const [rowSaveState, setRowSaveState] = useState<Record<number, RowSaveState>>({})
  const [lastEdit, setLastEdit] = useState<ScoreEditHistory | null>(null)
  const [clearGameConfirm, setClearGameConfirm] = useState<2 | 3 | null>(null)
  const debouncedSavesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const correctionOriginalsRef = useRef<Map<string, number | undefined>>(new Map())

  // Clear pending debounce timers on unmount to avoid state-after-unmount
  useEffect(() => {
    const pendingMap = debouncedSavesRef.current
    return () => {
      pendingMap.forEach(id => clearTimeout(id))
      pendingMap.clear()
    }
  }, [])

  const rowStateCounts = useMemo(() => {
    const values = Object.values(rowSaveState)
    return {
      saving: values.filter(s => s === 'saving').length,
      failed: values.filter(s => s === 'failed').length,
    }
  }, [rowSaveState])

  const markRowSaved = useCallback((playerId: number) => {
    setRowSaveState(prev => ({ ...prev, [playerId]: 'saved' }))
    window.setTimeout(() => {
      setRowSaveState(prev => (prev[playerId] === 'saved' ? { ...prev, [playerId]: 'idle' } : prev))
    }, 1400)
  }, [])

  const focusNextMobileInput = useCallback((playerId: number, field: string) => {
    const fieldIdx = SCORE_FIELDS.indexOf(field as typeof SCORE_FIELDS[number])
    const playerIdx = paginatedItems.findIndex(p => p.id === playerId)

    let nextField: string | null = null
    let nextPlayerId: number | null = null

    if (fieldIdx < SCORE_FIELDS.length - 1) {
      nextField = SCORE_FIELDS[fieldIdx + 1] ?? null
      nextPlayerId = playerId
    } else if (playerIdx >= 0 && playerIdx < paginatedItems.length - 1) {
      nextField = SCORE_FIELDS[0] ?? null
      nextPlayerId = paginatedItems[playerIdx + 1]?.id ?? null
    }

    if (!nextField || !nextPlayerId) return
    const el = document.querySelector(
      `input[data-mobile-player="${nextPlayerId}"][data-mobile-field="${nextField}"]`
    ) as HTMLInputElement | null
    if (el) { el.focus(); el.select() }
  }, [paginatedItems])

  const updateScore = useCallback(async (
    playerId: number,
    field: string,
    value: number | undefined,
    options: { trackHistory?: boolean; moveNextOnMobile?: boolean } = {},
  ) => {
    const { trackHistory = true, moveNextOnMobile = false } = options

    if (isScoresLocked) {
      addToast({ message: 'Scores are locked. Unlock scores to edit.', type: 'warning', duration: 2500 })
      return
    }

    const validation = validateScore(value)
    if (!validation.isValid) {
      addToast({ message: `Invalid score: ${value}. ${validation.message}`, type: 'error', duration: 4000 })
      return
    }

    const saveKey = `${playerId}-${field}`
    const currentValue = (playersRef.current.find(p => p.id === playerId)?.scores as Record<string, number | undefined> | undefined)?.[field]

    if (currentValue !== undefined && currentValue !== value && !correctionOriginalsRef.current.has(saveKey)) {
      correctionOriginalsRef.current.set(saveKey, currentValue)
    }

    if (trackHistory) {
      const prev = (playersRef.current.find(p => p.id === playerId)?.scores as Record<string, number | undefined> | undefined)?.[field]
      setLastEdit({ playerId, field, previous: prev })
    }

    // Optimistic update
    setRowSaveState(prev => ({ ...prev, [playerId]: 'saving' }))
    setPlayers(prev => prev.map(player => {
      if (player.id !== playerId) return player
      const updated = { ...player, scores: { ...player.scores, [field]: value } }
      if (field.includes('scratch')) {
        const gn = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
        updated.scores![`game${gn}_total` as keyof typeof updated.scores] = (value || 0) + (player.handicap || 0)
      }
      return updated
    }))

    if (isMobile && moveNextOnMobile) {
      window.setTimeout(() => focusNextMobileInput(playerId, field), 0)
    }

    // Cancel any pending debounce for the same cell
    const existing = debouncedSavesRef.current.get(saveKey)
    if (existing) clearTimeout(existing)

    const timerId = setTimeout(async () => {
      try {
        const token = sessionToken
        const tournamentId = getSelectedTournamentId()

        if (!token || !tournamentId || !selectedSquadRef.current) {
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
          return
        }

        const player = playersRef.current.find(p => p.id === playerId)
        if (!player) {
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
          return
        }

        const updatedScores = { ...player.scores, [field]: value }
        if (field.includes('scratch')) {
          const gn = field.includes('game1') ? '1' : field.includes('game2') ? '2' : '3'
          updatedScores[`game${gn}_with_handicap` as keyof typeof updatedScores] =
            (value || 0) + (player.handicap || 0)
        }

        const originalValue = correctionOriginalsRef.current.get(saveKey)
        let correctionReason: string | undefined
        if (originalValue !== undefined && originalValue !== value) {
          const confirmed = window.confirm(`Change score from ${originalValue} to ${value ?? 'blank'}? This correction will be recorded.`)
          correctionReason = confirmed ? window.prompt('Reason for score correction:')?.trim() : undefined
          if (!confirmed || !correctionReason) {
            setPlayers(prev => prev.map(row => row.id === playerId
              ? { ...row, scores: { ...row.scores, [field]: originalValue } }
              : row))
            setRowSaveState(prev => ({ ...prev, [playerId]: 'idle' }))
            correctionOriginalsRef.current.delete(saveKey)
            if (confirmed) addToast({ message: 'A reason is required to change a saved score.', type: 'warning', duration: 3500 })
            return
          }
        }

        const payload = {
          player_id: playerId,
          tournament_id: parseInt(tournamentId),
          squad_id: selectedSquadRef.current.id,
          game1_scratch: updatedScores.game1_scratch ?? 0,
          game2_scratch: updatedScores.game2_scratch ?? 0,
          game3_scratch: updatedScores.game3_scratch ?? 0,
          ...(correctionReason ? { correction_reason: correctionReason } : {}),
        }

        if (!isOnline) {
          const pendingSave = { data: payload }
          setPendingSaves(prev => [...prev, pendingSave])
          localStorage.setItem(`pending_save_${Date.now()}`, JSON.stringify(pendingSave))
          setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
          return
        }

        const response = await apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (response.ok) {
          correctionOriginalsRef.current.delete(saveKey)
          markRowSaved(playerId)
          if (value === 300) {
            addToast({ message: `Perfect game! 300 scored by ${player.firstName} ${player.lastName}`, type: 'success', duration: 5000 })
          } else if (value && value >= 250) {
            addToast({ message: `Excellent score: ${value} by ${player.firstName} ${player.lastName}`, type: 'success', duration: 3000 })
          }
        } else {
          let body = ''
          try { body = await response.text() } catch { body = '' }
          logger.error('Score save request failed', { url: API('/api/v1/scores/'), playerId, status: response.status, body: body.slice(0, 500) })
          throw new Error(`Save failed: ${response.status}`)
        }
      } catch (error) {
        logger.error('Failed to save score:', error)
        const currentPlayer = playersRef.current.find(p => p.id === playerId)
        setRowSaveState(prev => ({ ...prev, [playerId]: 'failed' }))
        addToast({
          message: `Failed to save score for ${currentPlayer?.firstName || 'player'} ${currentPlayer?.lastName || ''}. Please try again.`,
          type: 'error',
          duration: 5000,
        })
      }
      debouncedSavesRef.current.delete(saveKey)
    }, SCORE_SAVE_DEBOUNCE_MS)

    debouncedSavesRef.current.set(saveKey, timerId)
  }, [
    addToast,
    focusNextMobileInput,
    isMobile,
    isOnline,
    isScoresLocked,
    markRowSaved,
    playersRef,
    selectedSquadRef,
    sessionToken,
    setPendingSaves,
    setPlayers,
  ])

  const retryPlayerSave = useCallback(async (player: Player) => {
    const token = sessionToken
    const tournamentId = getSelectedTournamentId()
    if (!token || !tournamentId || !selectedSquadRef.current) return

    setRowSaveState(prev => ({ ...prev, [player.id]: 'saving' }))
    try {
      const response = await apiFetch(API('/api/v1/scores/'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.id,
          tournament_id: parseInt(tournamentId, 10),
          squad_id: selectedSquadRef.current.id,
          game1_scratch: player.scores?.game1_scratch,
          game2_scratch: player.scores?.game2_scratch,
          game3_scratch: player.scores?.game3_scratch,
        }),
      })
      if (!response.ok) {
        let body = ''
        try { body = await response.text() } catch { body = '' }
        logger.error('Retry score save request failed', { playerId: player.id, status: response.status, body: body.slice(0, 500) })
        throw new Error(`Retry failed: ${response.status}`)
      }
      markRowSaved(player.id)
    } catch (error) {
      setRowSaveState(prev => ({ ...prev, [player.id]: 'failed' }))
      logger.error('Retry score save failed', { error, playerId: player.id })
    }
  }, [markRowSaved, selectedSquadRef, sessionToken])

  const undoLastEdit = useCallback(() => {
    if (!lastEdit) return
    void updateScore(lastEdit.playerId, lastEdit.field, lastEdit.previous, { trackHistory: false })
    setLastEdit(null)
  }, [lastEdit, updateScore])

  const saveAllVisibleScores = useCallback(async () => {
    const token = sessionToken
    const tournamentId = getSelectedTournamentId()
    const squad = selectedSquadRef.current
    if (!token || !tournamentId || !squad || paginatedItems.length === 0) return

    paginatedItems.forEach(p => setRowSaveState(prev => ({ ...prev, [p.id]: 'saving' })))

    const results = await Promise.allSettled(
      paginatedItems.map(async player => {
        const response = await apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: player.id,
            tournament_id: parseInt(tournamentId, 10),
            squad_id: squad.id,
            game1_scratch: player.scores?.game1_scratch,
            game2_scratch: player.scores?.game2_scratch,
            game3_scratch: player.scores?.game3_scratch,
          }),
        })
        if (!response.ok) throw new Error(`Save failed for ${player.id}`)
        markRowSaved(player.id)
      })
    )

    let failed = 0
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        failed += 1
        const pid = paginatedItems[idx]?.id
        if (pid) setRowSaveState(prev => ({ ...prev, [pid]: 'failed' }))
      }
    })

    if (failed > 0) {
      addToast({ message: `Saved with ${failed} failure${failed === 1 ? '' : 's'}.`, type: 'warning', duration: 3500 })
    } else {
      addToast({ message: 'All visible scores saved.', type: 'success', duration: 2500 })
    }
  }, [addToast, markRowSaved, paginatedItems, selectedSquadRef, sessionToken])

  const clearGameScores = useCallback(async (gameNumber: 2 | 3) => {
    if (!tournament?.id) {
      addToast({ type: 'error', message: 'No tournament selected.', duration: 3000 })
      return
    }
    const token = sessionToken
    if (!token) {
      addToast({ type: 'error', message: 'Your session expired. Please log in again.', duration: 4000 })
      return
    }
    const squadId = selectedSquadRef.current?.id ?? getSelectedSquadId()
    if (!squadId) {
      addToast({ type: 'error', message: 'No squad selected.', duration: 3000 })
      return
    }

    const withScores = players.filter(p => p.scores)
    if (withScores.length === 0) {
      addToast({ type: 'warning', message: `No Game ${gameNumber} scores found to clear.`, duration: 3000 })
      return
    }

    const clearResults = await Promise.allSettled(
      withScores.map(player =>
        apiFetch(API('/api/v1/scores/'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player_id: player.id,
            tournament_id: tournament.id,
            squad_id: squadId,
            game1_scratch: player.scores?.game1_scratch ?? null,
            game2_scratch: gameNumber === 2 ? null : (player.scores?.game2_scratch ?? null),
            game3_scratch: gameNumber === 3 ? null : (player.scores?.game3_scratch ?? null),
          }),
        })
      )
    )

    const successful = clearResults.filter(r => r.status === 'fulfilled' && r.value.ok).length
    if (successful > 0) {
      setPlayers(prev => prev.map(p => ({
        ...p,
        scores: p.scores
          ? { ...p.scores, [`game${gameNumber}_scratch`]: undefined, [`game${gameNumber}_with_handicap`]: undefined }
          : p.scores,
      })))
    }

    const failed = withScores.length - successful
    if (failed > 0 && successful === 0) {
      addToast({ type: 'error', message: `Failed to clear Game ${gameNumber} scores.`, duration: 4000 })
    } else {
      addToast({
        type: failed > 0 ? 'warning' : 'success',
        message: failed > 0
          ? `Cleared Game ${gameNumber} for ${successful} players. ${failed} failed.`
          : `Cleared Game ${gameNumber} scores for ${successful} players.`,
        duration: 3500,
      })
    }
  }, [addToast, players, selectedSquadRef, sessionToken, setPlayers, tournament])

  const requestClearGame = useCallback((gameNumber: 2 | 3) => {
    setClearGameConfirm(gameNumber)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent, playerId: number, field: string) => {
    if (isScoresLocked) { e.preventDefault(); return }

    if (e.key === 'Enter') {
      e.preventDefault()
      const playerIdx = paginatedItems.findIndex(p => p.id === playerId)
      const fieldIdx = SCORE_FIELDS.indexOf(field as typeof SCORE_FIELDS[number])

      let nextField: string | null = null
      let nextPlayerId: number | null = null

      if (fieldIdx < SCORE_FIELDS.length - 1) {
        nextField = SCORE_FIELDS[fieldIdx + 1] ?? null
        nextPlayerId = playerId
      } else if (playerIdx >= 0 && playerIdx < paginatedItems.length - 1) {
        nextField = SCORE_FIELDS[0] ?? null
        nextPlayerId = paginatedItems[playerIdx + 1]?.id ?? null
      }

      if (!nextField || !nextPlayerId) return
      const el = document.querySelector(
        `input[data-player="${nextPlayerId}"][data-field="${nextField}"]`
      ) as HTMLInputElement | null
      if (el) { el.focus(); el.select() }
    }
  }, [isScoresLocked, paginatedItems])

  // Keep pendingSaves stable ref so online handler doesn't capture stale closure
  const pendingSavesRef = useRef(pendingSaves)
  useEffect(() => { pendingSavesRef.current = pendingSaves }, [pendingSaves])

  return {
    rowSaveState,
    lastEdit,
    clearGameConfirm,
    setClearGameConfirm,
    rowStateCounts,
    markRowSaved,
    updateScore,
    retryPlayerSave,
    saveAllVisibleScores,
    undoLastEdit,
    clearGameScores,
    requestClearGame,
    handleKeyDown,
    focusNextMobileInput,
  }
}
