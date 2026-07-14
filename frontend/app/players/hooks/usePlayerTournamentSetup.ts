import { Dispatch, SetStateAction, useCallback, useEffect, useRef } from 'react'

import { apiClient } from '../../lib/api'
import { logger } from '../../lib/logger'
import { getSelectedSquadId } from '../../lib/selection-session'
import { BracketProgramDefinition, BracketSettings, Tournament, TournamentBootstrapResponse } from '../../lib/types'
import { normalizeBracketPrograms } from '../../lib/bracketPrograms'
import { Squad } from '../types'

const ENTRY_FEE_REFETCH_COOLDOWN_MS = 30_000

type UsePlayerTournamentSetupArgs = {
  isAuthInitialized: boolean
  authToken: string | null
  selectionRefreshKey: number
  entryFee: number
  getTournamentId: () => string | null
  loadSidePots: (tournamentId: string | null) => void
  bracketProgramsEqual: (left: BracketProgramDefinition[], right: BracketProgramDefinition[]) => boolean
  setSelectedTournament: Dispatch<SetStateAction<Tournament | null>>
  setEntryFee: Dispatch<SetStateAction<number>>
  setBracketPrograms: Dispatch<SetStateAction<BracketProgramDefinition[]>>
  setBracketSize: Dispatch<SetStateAction<number>>
  setSelectedSquadId: Dispatch<SetStateAction<number | null>>
  setSquads: Dispatch<SetStateAction<Squad[]>>
}

export function usePlayerTournamentSetup({
  isAuthInitialized,
  authToken,
  selectionRefreshKey,
  entryFee,
  getTournamentId,
  loadSidePots,
  bracketProgramsEqual,
  setSelectedTournament,
  setEntryFee,
  setBracketPrograms,
  setBracketSize,
  setSelectedSquadId,
  setSquads,
}: UsePlayerTournamentSetupArgs) {
  const lastEntryFeeFetchRef = useRef(0)

  const loadEntryFee = useCallback(async () => {
    if (!authToken) {
      return
    }

    const tournamentId = getTournamentId()
    if (!tournamentId) {
      return
    }

    loadSidePots(tournamentId)

    try {
      lastEntryFeeFetchRef.current = Date.now()
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`)
      const nextEntryFee = typeof settings?.default_entry_fee === 'number' ? settings.default_entry_fee : null
      const nextPrograms = normalizeBracketPrograms(settings?.bracket_programs, nextEntryFee ?? entryFee)

      if (nextEntryFee != null) {
        setEntryFee(previous => {
          if (previous === nextEntryFee) return previous
          logger.info(`Loaded entry fee from tournament settings: $${nextEntryFee}`)
          return nextEntryFee
        })
      }

      setBracketPrograms(previous => (bracketProgramsEqual(previous, nextPrograms) ? previous : nextPrograms))
      if (settings && typeof settings.bracket_size === 'number') {
        setBracketSize(settings.bracket_size)
      }
    } catch (error) {
      logger.warn('Failed to load bracket settings, using default entry fee:', error)
      const fallbackPrograms = normalizeBracketPrograms(undefined, entryFee)
      setBracketPrograms(previous => (bracketProgramsEqual(previous, fallbackPrograms) ? previous : fallbackPrograms))
    }
  }, [
    authToken,
    bracketProgramsEqual,
    entryFee,
    getTournamentId,
    loadSidePots,
    setBracketPrograms,
    setBracketSize,
    setEntryFee,
  ])

  useEffect(() => {
    void loadEntryFee()
  }, [loadEntryFee])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && Date.now() - lastEntryFeeFetchRef.current > ENTRY_FEE_REFETCH_COOLDOWN_MS) {
        void loadEntryFee()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [loadEntryFee])

  useEffect(() => {
    const handleFocus = () => {
      if (Date.now() - lastEntryFeeFetchRef.current > ENTRY_FEE_REFETCH_COOLDOWN_MS) {
        void loadEntryFee()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadEntryFee])

  useEffect(() => {
    const fetchSquadData = async () => {
      const bootstrapStarted = performance.now()

      try {
        const lastTournamentId = getTournamentId()
        if (!lastTournamentId) {
          return
        }

        const bootstrap = await apiClient.get<TournamentBootstrapResponse>(
          `/api/v1/tournaments/bootstrap?tournament_id=${lastTournamentId}`,
          false,
        )

        const selectedData = bootstrap?.selected_squad ?? null
        const squadsData = bootstrap?.squads ?? []

        if (bootstrap?.tournament) {
          setSelectedTournament(bootstrap.tournament)
        }

        if (bootstrap?.bracket_settings) {
          const settings = bootstrap.bracket_settings
          const nextEntryFee = typeof settings.default_entry_fee === 'number' ? settings.default_entry_fee : null
          const normalizedPrograms = normalizeBracketPrograms(settings.bracket_programs, nextEntryFee ?? entryFee)

          if (nextEntryFee != null) {
            setEntryFee(previous => (previous === nextEntryFee ? previous : nextEntryFee))
          }

          setBracketPrograms(previous => (bracketProgramsEqual(previous, normalizedPrograms) ? previous : normalizedPrograms))
          if (typeof settings.bracket_size === 'number') {
            setBracketSize(settings.bracket_size)
          }
        }

        loadSidePots(lastTournamentId)

        const storedSelectedSquadId = getSelectedSquadId()
        const restoredSelectedSquadId = selectedData?.squad_id
          ?? (storedSelectedSquadId ? Number(storedSelectedSquadId) : null)

        if (restoredSelectedSquadId && squadsData.some(squad => squad.id === restoredSelectedSquadId)) {
          setSelectedSquadId(restoredSelectedSquadId)
        } else {
          setSelectedSquadId(null)
        }

        setSquads(squadsData)

        logger.info('Players bootstrap load completed', {
          tournamentId: Number(lastTournamentId),
          durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
          squadsCount: squadsData.length,
          hasSelectedSquad: Boolean(selectedData?.squad_id),
          hasBracketSettings: Boolean(bootstrap?.bracket_settings),
        })
      } catch (error) {
        logger.error('Error fetching squad data:', error)
      }
    }

    if (isAuthInitialized && authToken) {
      void fetchSquadData()
    }
  }, [
    authToken,
    bracketProgramsEqual,
    entryFee,
    getTournamentId,
    isAuthInitialized,
    loadSidePots,
    selectionRefreshKey,
    setBracketPrograms,
    setBracketSize,
    setEntryFee,
    setSelectedSquadId,
    setSelectedTournament,
    setSquads,
  ])

  return {
    loadEntryFee,
  }
}
