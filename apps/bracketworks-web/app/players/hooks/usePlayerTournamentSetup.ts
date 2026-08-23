import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react'

import { apiClient } from '../../lib/api'
import { isAuthError } from '../../lib/errors'
import { logger } from '../../lib/logger'
import { getSelectedSquadId, resolveSquadSelection, setActiveSquadLabel, setSelectedSquad } from '../../lib/selection-session'
import { BracketProgramDefinition, BracketSettings, SidePotsSettings, Tournament, TournamentBootstrapResponse } from '../../lib/types'
import { normalizeBracketPrograms } from '../../lib/bracketPrograms'
import { Squad } from '../types'

const ENTRY_FEE_REFETCH_COOLDOWN_MS = 30_000

function configuredSquadCount(tournament: Tournament | null | undefined): number {
  const squadTimes = tournament?.squad_times
  if (!squadTimes || typeof squadTimes !== 'object') return 0
  return Object.values(squadTimes).reduce(
    (count, times) => count + (Array.isArray(times) ? times.filter(time => typeof time === 'string' && time.trim()).length : 0),
    0,
  )
}

type UsePlayerTournamentSetupArgs = {
  isAuthInitialized: boolean
  authToken: string | null
  selectionRefreshKey: number
  entryFee: number
  getTournamentId: () => string | null
  loadSidePots: (tournamentId: string | null, settingsFromApi?: SidePotsSettings | null) => void
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
  const [isTournamentSetupLoading, setIsTournamentSetupLoading] = useState(true)

  const loadEntryFee = useCallback(async () => {
    if (!authToken) {
      return
    }

    const tournamentId = getTournamentId()
    if (!tournamentId) {
      return
    }

    try {
      lastEntryFeeFetchRef.current = Date.now()
      const settings = await apiClient.get<BracketSettings>(`/api/v1/bracket-settings/${tournamentId}`)
      loadSidePots(tournamentId, settings?.side_pots_settings ?? null)
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
      loadSidePots(tournamentId)
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
    const handleSettingsChanged = () => {
      void loadEntryFee()
    }

    window.addEventListener('settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('settings-changed', handleSettingsChanged)
  }, [loadEntryFee])

  useEffect(() => {
    let isActive = true

    const fetchSquadData = async () => {
      const bootstrapStarted = performance.now()

      try {
        const lastTournamentId = getTournamentId()
        if (!lastTournamentId) {
          return
        }

        let bootstrap = await apiClient.get<TournamentBootstrapResponse>(
          `/api/v1/tournaments/bootstrap?tournament_id=${lastTournamentId}`,
          false,
        )

        // Older tournaments can have a configured time without its canonical
        // squad row. Repair that mismatch once so every workspace receives a
        // real squad ID rather than falling back to a storage-only selection.
        if ((bootstrap?.squads?.length ?? 0) === 0 && configuredSquadCount(bootstrap?.tournament) === 1) {
          await apiClient.post(`/api/v1/squads/sync/${lastTournamentId}`, {
            squad_times: bootstrap?.tournament?.squad_times,
          })
          bootstrap = await apiClient.get<TournamentBootstrapResponse>(
            `/api/v1/tournaments/bootstrap?tournament_id=${lastTournamentId}`,
            false,
          )
        }

        const selectedData = bootstrap?.selected_squad ?? null
        const squadsData = (bootstrap?.squads ?? []).map(squad => ({
          id: squad.id,
          name: squad.name ?? '',
          tournament_id: squad.tournament_id,
          date: squad.date,
          time: squad.time,
        }))

        if (bootstrap?.tournament) {
          setSelectedTournament(bootstrap.tournament)
        }

        if (bootstrap?.bracket_settings) {
          const settings = bootstrap.bracket_settings
          loadSidePots(lastTournamentId, settings.side_pots_settings ?? null)
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

        if (!bootstrap?.bracket_settings) {
          loadSidePots(lastTournamentId)
        }

        const resolvedSquad = resolveSquadSelection(squadsData, selectedData?.squad_id, getSelectedSquadId())
        if (resolvedSquad) {
          setSelectedSquadId(resolvedSquad.id)
          setSelectedSquad(resolvedSquad.id)
          setActiveSquadLabel([resolvedSquad.date, resolvedSquad.time].filter(Boolean).join(' '))
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
        if (isAuthError(error)) {
          logger.warn('Players bootstrap skipped due to expired session', {
            reason: error instanceof Error ? error.message : String(error),
          })
        } else {
          logger.error('Error fetching squad data:', error)
        }
      } finally {
        if (isActive) {
          setIsTournamentSetupLoading(false)
        }
      }
    }

    if (isAuthInitialized && authToken) {
      void fetchSquadData()
    } else if (isAuthInitialized) {
      setIsTournamentSetupLoading(false)
    }

    return () => {
      isActive = false
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
    isTournamentSetupLoading,
    loadEntryFee,
  }
}
