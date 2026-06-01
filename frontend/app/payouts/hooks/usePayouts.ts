import { useState, useCallback, useEffect } from 'react'
import { API, apiFetch } from '../../lib/api'
import { logger } from '../../lib/logger'

export interface Winner {
  place: number
  position: string
  player_name: string
  player_id: number
  score: number
  bracket_type: string
  bracket_name: string
  payout_percentage: number
  payout_amount: number
  prize_pool_total: number
  split_pot?: boolean
}

export interface BracketPayout {
  bracket_name: string
  bracket_type: string
  bracket_size: number
  prize_pool: number
  winners: Winner[]
  status: string
}

export interface PayoutSummary {
  total_prize_pool: number
  total_scratch_pool: number
  total_handicap_pool: number
  program_summaries: Array<{
    key: string
    name: string
    display_order: number
    scoring_mode: string
    total_brackets: number
    total_winners: number
    total_prize_pool: number
  }>
  scratch_brackets: BracketPayout[]
  handicap_brackets: BracketPayout[]
  winners_by_bracket: Winner[]
  validation: {
    is_valid: boolean
    errors: string[]
    warnings: string[]
    total_distributed: number
    total_collected: number
  }
  tournament_info: {
    id: number
    name: string
    squad_id: number | null
    entry_fees: {
      scratch: number
      handicap: number
    }
  }
}

export interface PlayerEntry {
  id: number
  name: string
  scratch_brackets_entered: number
  handicap_brackets_entered: number
  total_brackets_entered: number
  scratch_brackets_won: number
  handicap_brackets_won: number
  total_brackets_won: number
  total_amount_won: number
  scratch_amount_won: number
  handicap_amount_won: number
  placement_details: Array<{
    bracket_name: string
    bracket_type: string
    placement: number
    placement_text: string
    amount_won: number
  }>
}

export interface EntryData {
  tournament_info: {
    id: number
    name: string
    squad_id: number | null
  }
  entries: PlayerEntry[]
  summary: {
    total_players: number
    total_scratch_entries: number
    total_handicap_entries: number
    total_amount_distributed: number
    average_per_player: number
  }
}

export function usePayouts(tournamentId: number | null, selectedSquadId: number | null) {
  const [payoutData, setPayoutData] = useState<PayoutSummary | null>(null)
  const [entryData, setEntryData] = useState<EntryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const loadPayoutData = useCallback(async () => {
    if (!tournamentId) return

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Not authenticated')
        return
      }

      const squadParam = selectedSquadId ? `?squad_id=${selectedSquadId}` : ''
      const url = `/api/v1/payouts/calculate/${tournamentId}${squadParam}`
      logger.debug('Loading payouts from', { url })
      
      const response = await apiFetch(API(url), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      logger.debug('Payout response status', { status: response.status })
      
      if (response.ok) {
        const data = await response.json()
        logger.debug('Payout data loaded', { bracketCount: data ? Object.keys(data).length : 0 })
        setPayoutData(data)
        setLastRefresh(new Date())
      } else if (response.status === 404) {
        logger.warn('No brackets found for tournament')
        setError(null)
        setPayoutData(null)
      } else {
        const errorData = await response.json()
        logger.error('Payout error', { errorData })
        setError(errorData.detail || 'Failed to load payout data')
      }
    } catch (error) {
      setError('Network error while loading payout data')
      logger.error('Error loading payout data:', error)
    } finally {
      setLoading(false)
    }
  }, [tournamentId, selectedSquadId])

  const loadEntryData = useCallback(async () => {
    if (!tournamentId) return

    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const squadParam = selectedSquadId ? `?squad_id=${selectedSquadId}` : ''

      // Try the full live-entries endpoint first
      const response = await apiFetch(API(`/api/v1/payouts/live-entries/${tournamentId}${squadParam}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        // If live-entries returned no players (e.g. brackets not yet generated),
        // fall through to the bowlers fallback so names are still available.
        if (data?.entries?.length > 0) {
          setEntryData(data)
          return
        }
      }

      // Fallback: get player list so non-winners still appear in the payout list
      const bowlersParams = new URLSearchParams({ tournament_id: String(tournamentId) })
      if (selectedSquadId) {
        bowlersParams.set('squad_id', String(selectedSquadId))
      }

      const bowlerResponse = await apiFetch(API(`/api/v1/bowlers?${bowlersParams.toString()}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (bowlerResponse.ok) {
        const bowlers = await bowlerResponse.json() as Array<{ id: number; full_name: string }>
        setEntryData({
          tournament_info: { id: tournamentId, name: '', squad_id: null },
          entries: bowlers.map((b): PlayerEntry => ({
            id: b.id,
            name: b.full_name,
            scratch_brackets_entered: 0,
            handicap_brackets_entered: 0,
            total_brackets_entered: 0,
            scratch_brackets_won: 0,
            handicap_brackets_won: 0,
            total_brackets_won: 0,
            total_amount_won: 0,
            scratch_amount_won: 0,
            handicap_amount_won: 0,
            placement_details: [],
          })),
          summary: {
            total_players: bowlers.length,
            total_scratch_entries: 0,
            total_handicap_entries: 0,
            total_amount_distributed: 0,
            average_per_player: 0,
          },
        })
      }
    } catch (error) {
      logger.error('Error loading entry data:', error)
    }
  }, [selectedSquadId, tournamentId])

  return {
    payoutData,
    entryData,
    loading,
    error,
    lastRefresh,
    loadPayoutData,
    loadEntryData,
    refreshPayouts: loadPayoutData
  }
}





