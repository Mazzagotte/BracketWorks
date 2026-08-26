// Standardized hooks for bracket operations
import { useState, useCallback } from 'react'
import { apiClient } from '../lib/api'
import { useToast } from '../components/Toast'
import type { BracketData, BracketGroup, BracketRound } from '../lib/types'
export type { BracketRound, Match } from '../lib/types'

type BracketGenerationJob = {
  job_id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  result?: BracketPreview | null
  error?: string | null
}

const BRACKET_JOB_POLL_INTERVAL_MS = 750
const BRACKET_JOB_TIMEOUT_MS = 5 * 60 * 1000

const waitForBracketJob = async (jobId: string): Promise<BracketPreview> => {
  const deadline = Date.now() + BRACKET_JOB_TIMEOUT_MS

  while (Date.now() < deadline) {
    const job = await apiClient.get<BracketGenerationJob>(`/api/v1/brackets/jobs/${jobId}`, false)

    if (job.status === 'succeeded' && job.result) return job.result
    if (job.status === 'failed') {
      const message = job.error?.split('\n', 1)[0] || 'Bracket generation failed'
      throw new Error(message)
    }

    await new Promise(resolve => window.setTimeout(resolve, BRACKET_JOB_POLL_INTERVAL_MS))
  }

  throw new Error('Bracket generation timed out. Please try again.')
}

export interface BracketPreview {
  size?: number
  rounds?: BracketRound[]  // Optional - for single bracket preview
  bracket_size?: number
  bracket_groups?: BracketGroup[]
  // API can return brackets in two formats:
  // Format 1: Direct properties (current API format)
  scratch_brackets?: BracketData[]
  handicap_brackets?: BracketData[]
  summary?: {
    total_scratch_entries: number
    total_handicap_entries: number
    scratch_brackets_count: number
    handicap_brackets_count: number
    scratch_placed_entries: number
    handicap_placed_entries: number
    scratch_refund_entries: number
    handicap_refund_entries: number
  }
  // Format 2: Wrapped in multiple_brackets (alternative format)
  multiple_brackets?: {
    scratch_brackets: BracketData[]
    handicap_brackets: BracketData[]
    summary: {
      total_scratch_entries: number
      total_handicap_entries: number
      scratch_brackets_count: number
      handicap_brackets_count: number
      scratch_placed_entries: number
      handicap_placed_entries: number
      scratch_refund_entries: number
      handicap_refund_entries: number
    }
  }
  tournament_info?: {
    name: string
    id: number
  }
  tournament_id?: number
  tournament_name?: string
  squad_id?: number
  entries_mismatch?: boolean
  player_count_at_generation?: number | null
  current_player_count?: number
}

export interface MatchScoreUpdate {
  bracket_id: string
  round_index: number
  match_index: number
  score_a: number
  score_b: number
}

type BracketGenerationMode = 'auto' | 'standard' | 'experimental'

// Hook for bracket operations
export function useBrackets() {
  const [preview, setPreview] = useState<BracketPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const generatePreview = useCallback(async (size: number = 8) => {
    setLoading(true)
    setError(null)

    try {
      const data = await apiClient.get<BracketPreview>(`/api/v1/brackets/preview?bracket_size=${size}`)
      setPreview(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate bracket preview'
      setError(errorMessage)
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const generateTournamentBrackets = useCallback(async (
    tournamentId: number,
    squadId?: number,
    bracketSize: number = 8,
    saveToDb: boolean = true,
    forceRegenerate: boolean = false,
    generationMode: BracketGenerationMode = 'experimental'
  ) => {
    setLoading(true)
    setError(null)

    try {
      const envExperimentalRaw = process.env.NEXT_PUBLIC_BRACKETS_EXPERIMENTAL_ENABLED
      const envExperimentalEnabled = envExperimentalRaw
        ? envExperimentalRaw.toLowerCase() === 'true'
        : true
      const experimentalEnabled = generationMode === 'auto'
        ? envExperimentalEnabled
        : generationMode === 'experimental'
      const effectiveForceRegenerate = forceRegenerate || experimentalEnabled
      const squadParam = squadId ? `&squad_id=${squadId}` : ''
      const forceParam = effectiveForceRegenerate ? '&force_regenerate=true' : ''
      const attemptsRaw = process.env.NEXT_PUBLIC_BRACKETS_EXPERIMENTAL_ATTEMPTS
      const attempts = attemptsRaw && /^\d+$/.test(attemptsRaw)
        ? Math.min(8, Math.max(1, Number(attemptsRaw)))
        : undefined

      const experimentalParam = experimentalEnabled ? '&use_experimental=true' : ''
      const attemptsParam = experimentalEnabled && attempts ? `&experimental_attempts=${attempts}` : ''

      let data: BracketPreview
      if (experimentalEnabled) {
        const job = await apiClient.post<BracketGenerationJob>(
          `/api/v1/brackets/generate-multiple-async?tournament_id=${tournamentId}${squadParam}${forceParam}${experimentalParam}${attemptsParam}`
        )
        data = await waitForBracketJob(job.job_id)
      } else {
        const url = `/api/v1/brackets/generate-multiple?tournament_id=${tournamentId}${squadParam}${forceParam}`
        data = await apiClient.post<BracketPreview>(url)
      }
      setPreview(data)

      if ((data as BracketPreview & { no_players?: boolean }).no_players) {
        addToast({
          type: 'warning',
          message: 'No players found for the selected tournament/squad. Brackets were not generated.',
          duration: 5000
        })
      } else {
        addToast({
          type: 'success',
          message: 'Tournament brackets generated successfully!',
          duration: 5000
        })
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate tournament brackets'
      setError(errorMessage)
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const updateMatchScore = useCallback(async (
    tournamentId: number,
    scoreUpdate: MatchScoreUpdate,
    squadId?: number
  ) => {
    setLoading(true)
    setError(null)

    try {
      const squadParam = squadId ? `&squad_id=${squadId}` : ''
      const data = await apiClient.post<BracketPreview>(
        `/api/v1/brackets/update-match-score?tournament_id=${tournamentId}${squadParam}`,
        scoreUpdate
      )
      setPreview(data)

      addToast({
        type: 'success',
        message: 'Match score updated successfully',
        duration: 3000
      })

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update match score'
      setError(errorMessage)
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const loadSavedBrackets = useCallback(async (tournamentId: number, squadId?: number) => {
    setLoading(true)
    setError(null)

    try {
      const squadParam = squadId ? `?squad_id=${squadId}` : ''
      const response = await apiClient.fetchWithAuth(
        `/api/v1/brackets/load/${tournamentId}${squadParam}`,
        { cache: 'no-store' },
      )

      if (response.status === 404) {
        setPreview(null)
        return null
      }

      if (!response.ok) {
        let message = `Failed to load saved brackets (HTTP ${response.status})`
        try {
          const body = await response.json() as { detail?: string; message?: string }
          message = body.detail || body.message || message
        } catch { /* non-JSON error body */ }
        setError(message)
        return null
      }

      const data = await response.json() as BracketPreview
      setPreview(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load saved brackets')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteTournamentBrackets = useCallback(async (tournamentId: number, squadId?: number) => {
    setLoading(true)
    setError(null)

    try {
      const squadParam = squadId ? `?squad_id=${squadId}` : ''
      await apiClient.delete(`/api/v1/brackets/delete/${tournamentId}${squadParam}`)
      setPreview(null)

      addToast({
        type: 'success',
        message: 'Brackets deleted successfully',
        duration: 4000
      })

      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete brackets'
      setError(errorMessage)
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000
      })
      throw err
    } finally {
      setLoading(false)
    }
  }, [addToast])

  const clearPreview = useCallback(() => {
    setPreview(null)
    setError(null)
  }, [])

  return {
    preview,
    loading,
    error,
    generatePreview,
    generateTournamentBrackets,
    updateMatchScore,
    loadSavedBrackets,
    deleteTournamentBrackets,
    clearPreview,
    setPreview
  }
}
