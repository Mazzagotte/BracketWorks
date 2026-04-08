import { useState, useCallback, useEffect } from 'react'
import { API } from '../../lib/api'
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
      
      const response = await fetch(API(url), {
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

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Not authenticated')
        return
      }

      const response = await fetch(API(`/api/v1/payouts/entries/${tournamentId}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setEntryData(data)
        return
      }

      // Fallback: construct from brackets and bowler data
      const [bracketResponse, bowlerResponse] = await Promise.all([
        fetch(API(`/api/v1/brackets/?tournament_id=${tournamentId}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(API(`/api/v1/bowlers/?tournament_id=${tournamentId}`), {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ])

      if (!bracketResponse.ok || !bowlerResponse.ok) {
        throw new Error('Failed to load entry data')
      }

      const bracketsData = await bracketResponse.json()
      const bowlersData = await bowlerResponse.json()

      // Process and construct entry data (simplified for now)
      setEntryData({
        tournament_info: {
          id: tournamentId,
          name: '',
          squad_id: null
        },
        entries: [],
        summary: {
          total_players: bowlersData.length,
          total_scratch_entries: 0,
          total_handicap_entries: 0,
          total_amount_distributed: 0,
          average_per_player: 0
        }
      })
    } catch (error) {
      setError('Network error while loading entry data')
      logger.error('Error loading entry data:', error)
    } finally {
      setLoading(false)
    }
  }, [tournamentId])

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
