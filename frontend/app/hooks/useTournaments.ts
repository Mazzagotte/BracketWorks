import { useState, useEffect } from 'react'

import { apiClient } from '../lib/api'
import { useToast } from '../components/Toast'
import { Player } from '../lib/types'

// Standardized hooks for tournament data

export interface Tournament {
  id: number
  name: string
  location?: string
  start_date?: string
  end_date?: string
  squad_times?: Record<string, string[]>
}

export interface Squad {
  id: number
  tournament_id: number
  date: string
  time: string
}

// Module-level cache shared across all hook instances (survives page navigation)
const _cache = {
  tournaments: null as Tournament[] | null,
  tournamentsFetchedAt: 0,
  squads: new Map<number, Squad[]>(),
  squadsFetchedAt: new Map<number, number>(),
  inFlightTournaments: null as Promise<void> | null,
  inFlightSquads: new Map<number, Promise<void>>(),
  STALE_MS: 60_000, // 1 minute
}

// Hook for managing tournaments with request deduplication
export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>(() => _cache.tournaments ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchTournaments = async () => {
    // Serve from cache if still fresh
    if (_cache.tournaments && Date.now() - _cache.tournamentsFetchedAt < _cache.STALE_MS) {
      setTournaments(_cache.tournaments)
      return
    }

    // Deduplicate in-flight requests
    if (_cache.inFlightTournaments) {
      await _cache.inFlightTournaments
      if (_cache.tournaments) setTournaments(_cache.tournaments)
      return
    }

    setLoading(true)
    setError(null)

    const fetchPromise = (async () => {
      try {
        const data = await apiClient.get<Tournament[]>('/api/v1/tournaments/')
        _cache.tournaments = data
        _cache.tournamentsFetchedAt = Date.now()
        setTournaments(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tournaments'
        setError(errorMessage)
        addToast({ type: 'error', message: errorMessage, duration: 5000 })
      } finally {
        setLoading(false)
        _cache.inFlightTournaments = null
      }
    })()

    _cache.inFlightTournaments = fetchPromise
    return fetchPromise
  }

  const createTournament = async (tournament: Omit<Tournament, 'id'>) => {
    setLoading(true)
    
    try {
      const newTournament = await apiClient.post<Tournament>('/api/v1/tournaments/', tournament)
      const updated = [...(_cache.tournaments ?? []), newTournament]
      _cache.tournaments = updated
      _cache.tournamentsFetchedAt = Date.now()
      setTournaments(updated)
      addToast({
        type: 'success',
        message: 'Tournament created successfully',
        duration: 3000
      })
      return newTournament
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tournament'
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

  const updateTournament = async (id: number, updates: Partial<Tournament>) => {
    setLoading(true)

    try {
      const updatedTournament = await apiClient.put<Tournament>(`/api/v1/tournaments/${id}`, updates)
      const updated = (_cache.tournaments ?? []).map(t => t.id === id ? updatedTournament : t)
      _cache.tournaments = updated
      _cache.tournamentsFetchedAt = Date.now()
      setTournaments(updated)
      addToast({
        type: 'success',
        message: 'Tournament updated successfully',
        duration: 3000
      })
      return updatedTournament
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tournament'
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

  const deleteTournament = async (id: number) => {
    setLoading(true)

    try {
      await apiClient.delete(`/api/v1/tournaments/${id}`)
      const updated = (_cache.tournaments ?? []).filter(t => t.id !== id)
      _cache.tournaments = updated
      _cache.tournamentsFetchedAt = Date.now()
      setTournaments(updated)
      addToast({
        type: 'success',
        message: 'Tournament deleted successfully',
        duration: 3000
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete tournament'
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
    fetchTournaments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    tournaments,
    loading,
    error,
    fetchTournaments,
    createTournament,
    updateTournament,
    deleteTournament
  }
}

// Hook for managing squads with request deduplication
export function useSquads(tournamentId?: number) {
  const [squads, setSquads] = useState<Squad[]>(() =>
    tournamentId ? (_cache.squads.get(tournamentId) ?? []) : []
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchSquads = async (tId?: number) => {
    const id = tId || tournamentId
    if (!id) return

    // Serve from cache if still fresh
    const cachedSquads = _cache.squads.get(id)
    const fetchedAt = _cache.squadsFetchedAt.get(id) ?? 0
    if (cachedSquads && Date.now() - fetchedAt < _cache.STALE_MS) {
      setSquads(cachedSquads)
      return
    }

    // Deduplicate in-flight requests
    const existingPromise = _cache.inFlightSquads.get(id)
    if (existingPromise) {
      await existingPromise
      const fresh = _cache.squads.get(id)
      if (fresh) setSquads(fresh)
      return
    }

    setLoading(true)
    setError(null)

    const fetchPromise = (async () => {
      try {
        const data = await apiClient.get<Squad[]>(`/api/v1/squads/?tournament_id=${id}`)
        _cache.squads.set(id, data)
        _cache.squadsFetchedAt.set(id, Date.now())
        setSquads(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch squads'
        setError(errorMessage)
        addToast({ type: 'error', message: errorMessage, duration: 5000 })
      } finally {
        setLoading(false)
        _cache.inFlightSquads.delete(id)
      }
    })()

    _cache.inFlightSquads.set(id, fetchPromise)
    return fetchPromise
  }

  useEffect(() => {
    if (tournamentId) {
      fetchSquads(tournamentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId])

  return {
    squads,
    loading,
    error,
    fetchSquads
  }
}

// Hook for managing players
export function usePlayers(tournamentId?: number, squadId?: number) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchPlayers = async (tId?: number, sId?: number) => {
    const id = tId || tournamentId
    if (!id) return

    setLoading(true)
    setError(null)
    
    try {
      const squadParam = (sId || squadId) ? `&squad_id=${sId || squadId}` : ''
      const data = await apiClient.get<Player[]>(`/api/v1/bowlers/?tournament_id=${id}${squadParam}`)
      setPlayers(data)
      
      addToast({
        type: 'success',
        message: `Loaded ${data.length} players`,
        duration: 3000
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch players'
      setError(errorMessage)
      addToast({
        type: 'error',
        message: errorMessage,
        duration: 5000
      })
    } finally {
      setLoading(false)
    }
  }

  const addPlayer = async (player: Omit<Player, 'id'>) => {
    setLoading(true)
    
    try {
      const newPlayer = await apiClient.post<Player>('/api/v1/bowlers/', player)
      setPlayers(prev => [...prev, newPlayer])
      addToast({
        type: 'success',
        message: 'Player added successfully',
        duration: 3000
      })
      return newPlayer
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add player'
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
      fetchPlayers(tournamentId, squadId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, squadId])

  return {
    players,
    loading,
    error,
    fetchPlayers,
    addPlayer
  }
}
