// Standardized hooks for bracket operations
import { useState, useEffect } from 'react'
import { apiClient } from '../lib/api'
import { useToast } from '../components/Toast'
import { BracketData, BracketSettings } from '../lib/types'

export interface BracketPreview {
  size: number
  rounds: BracketRound[]
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
}

export interface BracketRound {
  name: string
  matches: Match[]
}

export interface Match {
  seedA: number
  seedB: number
  playerA?: string
  playerB?: string
  scoreA?: number
  scoreB?: number
  winner?: 'A' | 'B'
  status?: 'pending' | 'in_progress' | 'completed'
}

export interface MatchScoreUpdate {
  bracket_id: string
  round_index: number
  match_index: number
  score_a: number
  score_b: number
}

// Hook for bracket operations
export function useBrackets() {
  const [preview, setPreview] = useState<BracketPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const generatePreview = async (size: number = 8) => {
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
  }

  const generateTournamentBrackets = async (
    tournamentId: number,
    squadId?: number,
    bracketSize: number = 8,
    saveToDb: boolean = true
  ) => {
    setLoading(true)
    setError(null)
    
    try {
      const squadParam = squadId ? `&squad_id=${squadId}` : ''
      const data = await apiClient.get<BracketPreview>(
        `/api/v1/brackets/generate-multiple?tournament_id=${tournamentId}${squadParam}`
      )
      setPreview(data)
      
      addToast({
        type: 'success',
        message: 'Tournament brackets generated successfully!',
        duration: 5000
      })
      
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
  }

  const updateMatchScore = async (
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
  }

  const loadSavedBrackets = async (tournamentId: number, squadId?: number) => {
    setLoading(true)
    setError(null)
    
    try {
      const squadParam = squadId ? `&squad_id=${squadId}` : ''
      const data = await apiClient.get<BracketPreview>(
        `/api/v1/brackets/generate-multiple?tournament_id=${tournamentId}${squadParam}&save_to_db=false`
      )
      setPreview(data)
      return data
    } catch (err) {
      // Don't show error toast for loading saved brackets - they might not exist
      // Silent fail for missing brackets is expected behavior
      return null
    } finally {
      setLoading(false)
    }
  }

  const clearPreview = () => {
    setPreview(null)
    setError(null)
  }

  return {
    preview,
    loading,
    error,
    generatePreview,
    generateTournamentBrackets,
    updateMatchScore,
    loadSavedBrackets,
    clearPreview,
    setPreview
  }
}

// Hook for bracket settings
export function useBracketSettings(tournamentId?: number) {
  const [settings, setSettings] = useState<BracketSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchSettings = async (tId?: number) => {
    const id = tId || tournamentId
    if (!id) return

    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.get<BracketSettings>(`/api/v1/bracket_settings/?tournament_id=${id}`)
      setSettings(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch bracket settings'
      setError(errorMessage)
      // Settings not found is expected for new tournaments
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (updates: Partial<BracketSettings>) => {
    if (!tournamentId) return

    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.put<BracketSettings>(`/api/v1/bracket_settings/${settings?.id}`, updates)
      setSettings(data)
      
      addToast({
        type: 'success',
        message: 'Bracket settings updated successfully',
        duration: 3000
      })
      
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update bracket settings'
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
  }

  const createSettings = async (settingsData: Omit<BracketSettings, 'id'>) => {
    if (!tournamentId) return

    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.post<BracketSettings>('/api/v1/bracket_settings/', {
        ...settingsData,
        tournament_id: tournamentId
      })
      setSettings(data)
      
      addToast({
        type: 'success',
        message: 'Bracket settings created successfully',
        duration: 3000
      })
      
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create bracket settings'
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
  }

  useEffect(() => {
    if (tournamentId) {
      fetchSettings(tournamentId)
    }
  }, [tournamentId])

  return {
    settings,
    loading,
    error,
    fetchSettings,
    updateSettings,
    createSettings
  }
}
