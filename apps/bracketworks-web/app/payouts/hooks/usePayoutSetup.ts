import { Dispatch, SetStateAction, useEffect } from 'react'
import { API, apiClient, apiFetch } from '../../lib/api'
import { logger } from '../../lib/logger'
import { getSelectedSquadId, getSelectedTournamentId, resolveSquadSelection, setActiveSquadLabel, setSelectedSquad as persistSelectedSquad } from '../../lib/selection-session'
import { Squad, Tournament, TournamentBootstrapResponse } from '../../lib/types'

export type ScoreRow = {
  player_id: number
  game1_scratch?: number | null
  game2_scratch?: number | null
  game3_scratch?: number | null
  game1_with_handicap?: number | null
  game2_with_handicap?: number | null
  game3_with_handicap?: number | null
}

type UsePayoutSetupArgs = {
  isAuthInitialized: boolean
  isUserAuthenticated: boolean
  authToken: string | null
  isUnlocked: boolean
  selectionRefreshKey: number
  selectedTournament: Tournament | null
  selectedSquad: Squad | null
  fetchSquads: (tournamentId: number) => void
  setSelectedTournament: Dispatch<SetStateAction<Tournament | null>>
  setSelectedSquad: Dispatch<SetStateAction<Squad | null>>
  setScoreRows: Dispatch<SetStateAction<ScoreRow[]>>
}

export function usePayoutSetup({
  isAuthInitialized,
  isUserAuthenticated,
  authToken,
  isUnlocked,
  selectionRefreshKey,
  selectedTournament,
  selectedSquad,
  fetchSquads,
  setSelectedTournament,
  setSelectedSquad,
  setScoreRows,
}: UsePayoutSetupArgs) {
  // Bootstrap hydration — restore tournament + squad from server on mount
  useEffect(() => {
    if (!isAuthInitialized || !isUserAuthenticated) return

    const hydrateFromBootstrap = async () => {
      const storedId = getSelectedTournamentId()
      if (!storedId) return

      const bootstrapStarted = performance.now()
      try {
        const bootstrap = await apiClient.get<TournamentBootstrapResponse>(
          `/api/v1/tournaments/bootstrap?tournament_id=${storedId}`,
          false,
        )

        if (!bootstrap?.tournament) return

        setSelectedTournament(bootstrap.tournament)
        fetchSquads(bootstrap.tournament.id)

        const resolvedSquad = resolveSquadSelection(bootstrap.squads || [], bootstrap.selected_squad?.squad_id, getSelectedSquadId())
        setSelectedSquad(resolvedSquad)
        if (resolvedSquad) {
          persistSelectedSquad(resolvedSquad.id)
          setActiveSquadLabel([resolvedSquad.date, resolvedSquad.time].filter(Boolean).join(' '))
        }

        logger.info('Payouts bootstrap load completed', {
          tournamentId: Number(storedId),
          durationMs: Math.round((performance.now() - bootstrapStarted) * 100) / 100,
          squadsCount: (bootstrap.squads || []).length,
          hasSelectedSquad: Boolean(bootstrap.selected_squad?.squad_id),
        })
      } catch {
        // Fallback to existing tournament/squad initialization flow.
      }
    }

    void hydrateFromBootstrap()
  }, [fetchSquads, isUserAuthenticated, isAuthInitialized, selectionRefreshKey, setSelectedTournament, setSelectedSquad])

  // Score rows for side-pot accounting
  useEffect(() => {
    const loadScores = async () => {
      if (!selectedTournament || !isUnlocked) {
        setScoreRows([])
        return
      }

      if (!authToken) {
        setScoreRows([])
        return
      }

      const params = new URLSearchParams({ tournament_id: String(selectedTournament.id) })
      if (selectedSquad?.id) params.set('squad_id', String(selectedSquad.id))

      try {
        const response = await apiFetch(API(`/api/v1/scores/?${params.toString()}`), {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        if (!response.ok) {
          setScoreRows([])
          return
        }
        const data = await response.json()
        setScoreRows(Array.isArray(data) ? data : [])
      } catch {
        setScoreRows([])
      }
    }

    void loadScores()
  }, [authToken, selectedTournament, selectedSquad, isUnlocked, setScoreRows])
}
