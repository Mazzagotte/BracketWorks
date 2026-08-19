'use client'

import { useState, useEffect } from 'react'
import { Tournament, Squad } from '../../lib/types'
import { storage } from '../../lib/storage'
import { setSelectedSquad as persistSelectedSquad, setActiveSquadLabel } from '../../lib/selection-session'

interface UseBracketSelectionArgs {
  tournaments: Tournament[]
  squads: Squad[]
  tournamentsLoading: boolean
  fetchTournaments: () => Promise<void> | void
  fetchSquads: (tournamentId?: number) => Promise<void> | void
  loadSavedBrackets: (tournamentId: number, squadId: number) => Promise<unknown>
  onBracketsLoaded: (brackets: unknown) => void
  onLastLoaded: (ref: { tournamentId: number; squadId: number }) => void
  selectionRefreshKey: number
}

interface UseBracketSelectionResult {
  selectedTournament: Tournament | null
  setSelectedTournament: React.Dispatch<React.SetStateAction<Tournament | null>>
  selectedSquad: Squad | null
  setSelectedSquad: React.Dispatch<React.SetStateAction<Squad | null>>
  isInitializing: boolean
}

/**
 * Owns tournament and squad selection state, including the initialization
 * sequence that reads from localStorage and prefetches data in parallel.
 */
export function useBracketSelection({
  tournaments,
  squads,
  tournamentsLoading,
  fetchTournaments,
  fetchSquads,
  loadSavedBrackets,
  onBracketsLoaded,
  onLastLoaded,
  selectionRefreshKey,
}: UseBracketSelectionArgs): UseBracketSelectionResult {
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Initial mount: prefetch tournaments, squads, and brackets in parallel
  // when localStorage has previously-used IDs (the common case).
  useEffect(() => {
    const storedTournamentId = storage.getItem('lastTournamentId')
    const storedSquadId = storage.getItem('selected_squad_id')

    if (storedTournamentId && storedSquadId) {
      const tId = parseInt(storedTournamentId)
      const sId = parseInt(storedSquadId)
      Promise.all([
        fetchTournaments(),
        fetchSquads(tId),
        loadSavedBrackets(tId, sId)
          .then(brackets => {
            if (brackets) {
              onBracketsLoaded(brackets)
              onLastLoaded({ tournamentId: tId, squadId: sId })
            }
          })
          .catch(() => {}),
      ])
    } else if (storedTournamentId) {
      Promise.all([fetchTournaments(), fetchSquads(parseInt(storedTournamentId))])
    } else {
      fetchTournaments()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-select tournament from localStorage once the list arrives
  useEffect(() => {
    if (tournaments.length > 0 && !selectedTournament) {
      const storedId = storage.getItem('lastTournamentId')
      if (storedId) {
        const found = tournaments.find(t => t.id === parseInt(storedId))
        if (found) {
          setSelectedTournament(found)
          const fetchResult = fetchSquads(found.id)
          if (fetchResult instanceof Promise) {
            fetchResult
              .then(() => setIsInitializing(false))
              .catch(() => setIsInitializing(false))
          } else {
            setIsInitializing(false)
          }
        } else {
          setIsInitializing(false)
        }
      } else {
        setIsInitializing(false)
      }
    } else if (tournaments.length > 0) {
      setIsInitializing(false)
    }
  }, [fetchSquads, selectedTournament, tournaments, selectionRefreshKey])

  // Stop initializing when fetch returns no tournaments
  useEffect(() => {
    if (!tournamentsLoading && tournaments.length === 0) setIsInitializing(false)
  }, [tournamentsLoading, tournaments.length])

  // Auto-select squad from localStorage, falling back to the first squad
  useEffect(() => {
    if (squads.length > 0 && !selectedSquad) {
      const storedId = storage.getItem('selected_squad_id')
      const found = storedId ? squads.find(s => s.id === parseInt(storedId)) : null
      const squad = found ?? squads[0] ?? null
      if (squad) {
        setSelectedSquad(squad)
        persistSelectedSquad(squad.id)
        setActiveSquadLabel([squad.date, squad.time].filter(Boolean).join(' '))
      }
    }
  }, [squads, selectedSquad])

  return { selectedTournament, setSelectedTournament, selectedSquad, setSelectedSquad, isInitializing }
}
