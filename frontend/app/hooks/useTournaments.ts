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
  name: string
  time: string
  tournament_id?: number
}



// Hook for managing tournaments
export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchTournaments = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.get<Tournament[]>('/api/v1/tournaments/')
      setTournaments(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tournaments'
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

  const createTournament = async (tournament: Omit<Tournament, 'id'>) => {
    setLoading(true)
    
    try {
      const newTournament = await apiClient.post<Tournament>('/api/v1/tournaments/', tournament)
      setTournaments(prev => [...prev, newTournament])
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
      setTournaments(prev => prev.map(t => t.id === id ? updatedTournament : t))
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
      setTournaments(prev => prev.filter(t => t.id !== id))
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

// Hook for managing squads
export function useSquads(tournamentId?: number) {
  const [squads, setSquads] = useState<Squad[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchSquads = async (tId?: number) => {
    const id = tId || tournamentId
    if (!id) return

    setLoading(true)
    setError(null)
    
    try {
      const data = await apiClient.get<Squad[]>(`/api/v1/squads/?tournament_id=${id}`)
      setSquads(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch squads'
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

  useEffect(() => {
    if (tournamentId) {
      fetchSquads(tournamentId)
    }
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
  }, [tournamentId, squadId])

  return {
    players,
    loading,
    error,
    fetchPlayers,
    addPlayer
  }
}