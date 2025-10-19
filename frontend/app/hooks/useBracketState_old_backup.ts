// Custom hook for managing bracket state
import { useState, useEffect } from 'react'
import { API } from '../lib/api'
import { useToast } from '../components/Toast'

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

export interface BracketRound { 
  name: string
  matches: Match[] 
}

export interface Tournament {
  id: number
  name: string
  location?: string
  start_date?: string
  end_date?: string
}

export interface BracketState {
  size: number
  preview: any | null
  loading: boolean
  tournament: Tournament | null
  squads: any[]
  selectedSquad: any | null
  players: any[]
  loadingPlayers: boolean
  selectedBracket: {type: 'scratch' | 'handicap', index: number} | null
  selectedRound: number
  selectedBracketType: 'scratch' | 'handicap'
  playerSearchQuery: string
  isHydrated: boolean
}

export function useBracketState() {
  const [state, setState] = useState<BracketState>({
    size: 8,
    preview: null,
    loading: false,
    tournament: null,
    squads: [],
    selectedSquad: null,
    players: [],
    loadingPlayers: false,
    selectedBracket: null,
    selectedRound: 0,
    selectedBracketType: 'scratch',
    playerSearchQuery: '',
    isHydrated: false
  })

  const { addToast } = useToast()

  // Hydration effect
  useEffect(() => {
    setState(prev => ({ ...prev, isHydrated: true }))
    loadSavedTournament()
  }, [])

  // Load saved tournament from localStorage
  const loadSavedTournament = async () => {
    if (typeof window === 'undefined') return
    
    try {
      const savedTournament = localStorage.getItem('selectedTournament')
      if (savedTournament) {
        const tournament = JSON.parse(savedTournament)
        setState(prev => ({ ...prev, tournament }))
        await loadSquads(tournament.id)
      }
    } catch (error) {
      console.error('Error loading saved tournament:', error)
    }
  }

  // Load squads for tournament
  const loadSquads = async (tournamentId: number) => {
    if (!state.isHydrated) return
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setState(prev => ({ ...prev, squads: [] }))
        return
      }

      const url = API(`/api/v1/squads/?tournament_id=${tournamentId}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const data = await response.json()
      const squads = Array.isArray(data) ? data : []
      
      setState(prev => ({ ...prev, squads }))
      
      // Auto-select first squad or previously selected squad
      if (state.isHydrated) {
        const selectedSquadId = localStorage.getItem(`selectedSquad_${tournamentId}`)
        if (selectedSquadId) {
          const squad = squads.find((s: any) => s.id === parseInt(selectedSquadId))
          setState(prev => ({ ...prev, selectedSquad: squad }))
        } else if (squads.length > 0) {
          setState(prev => ({ ...prev, selectedSquad: squads[0] }))
        }
      }
    } catch (error) {
      console.error('Error loading squads:', error)
      setState(prev => ({ ...prev, squads: [] }))
    }
  }

  // Load players for squad
  const loadPlayers = async (tournamentId: number, squadId: number | null = null) => {
    if (!state.isHydrated) return
    
    setState(prev => ({ ...prev, loadingPlayers: true }))
    
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        addToast({
          type: 'warning',
          message: 'Please log in to load players',
          duration: 4000
        })
        setState(prev => ({ ...prev, players: [], loadingPlayers: false }))
        return
      }

      const squadParam = squadId ? `&squad_id=${squadId}` : ''
      const url = API(`/api/v1/bowlers/?tournament_id=${tournamentId}${squadParam}`)
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.')
        }
        throw new Error(`Failed to load players: ${response.status}`)
      }
      
      const data = await response.json()
      const playersList = Array.isArray(data) ? data : []
      
      setState(prev => ({ 
        ...prev, 
        players: playersList,
        loadingPlayers: false
      }))
      
      addToast({
        type: 'success',
        message: `Loaded ${playersList.length} players`,
        duration: 3000
      })
      
      // Auto-adjust bracket size
      if (playersList.length > 0) {
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(playersList.length)))
        const optimalSize = Math.max(4, nextPowerOf2)
        setState(prev => ({ ...prev, size: optimalSize }))
      }
      
    } catch (error) {
      console.error('Error loading players:', error)
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to load players',
        duration: 5000
      })
      setState(prev => ({ ...prev, players: [], loadingPlayers: false }))
    }
  }

  // Generate bracket preview
  const generatePreview = async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      const url = API(`/api/v1/brackets/preview?bracket_size=${state.size}`)
      const response = await fetch(url)
      
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      
      const data = await response.json()
      setState(prev => ({ ...prev, preview: data }))
      
    } catch (error) {
      console.error('Error generating preview:', error)
      addToast({
        type: 'error',
        message: 'Failed to generate bracket preview',
        duration: 5000
      })
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  // Update specific state properties
  const updateState = (updates: Partial<BracketState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }

  return {
    state,
    updateState,
    loadSquads,
    loadPlayers,
    generatePreview
  }
}