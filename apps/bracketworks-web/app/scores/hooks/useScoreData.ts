'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tournament, Squad, Player, ScoreData, TournamentBootstrapResponse } from '../../lib/types'
import { API, apiClient, apiFetch } from '../../lib/api'
import { logger } from '../../lib/logger'
import {
  getSelectedTournamentId,
  getSelectedSquadId,
  setSelectedSquad as persistSelectedSquad,
} from '../../lib/selection-session'

export interface UseScoreDataResult {
  players: Player[]
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>
  tournament: Tournament | null
  selectedSquad: Squad | null
  selectedSquadRef: React.MutableRefObject<Squad | null>
  playersRef: React.MutableRefObject<Player[]>
  isLoading: boolean
  selectionRefreshKey: number
}

/**
 * Owns tournament/squad/player loading for the scores page.
 * Fires in parallel for bowlers and scores; falls back to unfiltered bowlers
 * when a squad filter returns zero results (handles squad_id = null entries).
 */
export function useScoreData(sessionToken: string | null): UseScoreDataResult {
  const [players, setPlayers] = useState<Player[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectionRefreshKey, setSelectionRefreshKey] = useState(0)

  const selectedSquadRef = useRef<Squad | null>(selectedSquad)
  const playersRef = useRef<Player[]>(players)

  useEffect(() => { selectedSquadRef.current = selectedSquad }, [selectedSquad])
  useEffect(() => { playersRef.current = players }, [players])

  // Refresh when tournament/squad selection changes from another page
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const refreshSelection = () => setSelectionRefreshKey(prev => prev + 1)
    window.addEventListener('tournament-changed', refreshSelection)
    window.addEventListener('squad-changed', refreshSelection)
    return () => {
      window.removeEventListener('tournament-changed', refreshSelection)
      window.removeEventListener('squad-changed', refreshSelection)
    }
  }, [])

  const fetchPlayersWithScores = useCallback(async (
    tournamentId: string,
    squadId: number | null,
    token: string,
  ) => {
    try {
      const bowlersUrl = squadId
        ? `/api/v1/bowlers?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/bowlers?tournament_id=${tournamentId}`
      const scoresUrl = squadId
        ? `/api/v1/scores/?tournament_id=${tournamentId}&squad_id=${squadId}`
        : `/api/v1/scores/?tournament_id=${tournamentId}`

      // Fire in parallel — scores don't depend on bowlers
      const [bowlersResponse, scoresResponse] = await Promise.all([
        apiFetch(API(bowlersUrl), { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch(API(scoresUrl), { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (!bowlersResponse.ok) {
        let body = ''
        try { body = await bowlersResponse.text() } catch { body = '' }
        logger.error('Bowlers API request failed', { url: API(bowlersUrl), status: bowlersResponse.status, body: body.slice(0, 500) })
      }
      if (!scoresResponse.ok) {
        let body = ''
        try { body = await scoresResponse.text() } catch { body = '' }
        logger.error('Scores API request failed', { url: API(scoresUrl), status: scoresResponse.status, body: body.slice(0, 500) })
      }

      let data = bowlersResponse.ok ? await bowlersResponse.json() : []

      // Players added without a squad have squad_id = null; fall back to all tournament players
      if (squadId && data.length === 0) {
        const fallback = await apiFetch(API(`/api/v1/bowlers?tournament_id=${tournamentId}`), {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (fallback.ok) data = await fallback.json()
      }

      const scoresData: ScoreData[] = scoresResponse.ok ? await scoresResponse.json() : []
      const scoresMap = new Map<number, ScoreData>()
      scoresData.forEach(score => scoresMap.set(score.player_id, score))

      type ApiPlayer = Player & { full_name?: string; handicap_pins?: number }
      const transformed: Player[] = (data || []).map((rec: ApiPlayer) => {
        const fullName = rec.fullName || rec.full_name || ''
        const [first, ...rest] = fullName.split(' ')
        const existing = scoresMap.get(rec.id) ?? {
          game1_scratch: undefined, game1_with_handicap: undefined,
          game2_scratch: undefined, game2_with_handicap: undefined,
          game3_scratch: undefined, game3_with_handicap: undefined,
        }
        return {
          id: rec.id,
          firstName: first || '',
          lastName: rest.join(' ') || '',
          handicap: rec.handicapPins || rec.handicap_pins || 0,
          average: rec.average || 0,
          lane: rec.lane || null,
          scores: existing,
        }
      })

      const sorted = [...transformed].sort((a, b) => {
        if (a.lane && b.lane) return parseInt(String(a.lane)) - parseInt(String(b.lane))
        if (a.lane) return -1
        if (b.lane) return 1
        return a.lastName.localeCompare(b.lastName)
      })

      setPlayers(sorted)
    } catch (err) {
      logger.error('Error fetching players:', err)
      setPlayers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const tournamentId = getSelectedTournamentId()
    const token = sessionToken

    if (!tournamentId || !token) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const t0 = performance.now()

    apiClient
      .get<TournamentBootstrapResponse>(`/api/v1/tournaments/bootstrap?tournament_id=${tournamentId}`, false)
      .then(bootstrap => {
        const tournamentData = bootstrap?.tournament ?? null
        const squadsData = bootstrap?.squads ?? []
        const selectedSquadData = bootstrap?.selected_squad ?? null

        if (tournamentData) setTournament(tournamentData)

        let squadToUse: Squad | null = null
        if (selectedSquadData?.squad_id) {
          squadToUse = squadsData.find((s: Squad) => s.id === selectedSquadData.squad_id) ?? null
        }
        if (!squadToUse) {
          const stored = getSelectedSquadId()
          if (stored) squadToUse = squadsData.find((s: Squad) => s.id === parseInt(stored)) ?? null
        }
        if (!squadToUse && squadsData.length > 0) squadToUse = squadsData[0] ?? null

        setSelectedSquad(squadToUse)
        if (squadToUse && !getSelectedSquadId()) persistSelectedSquad(squadToUse.id)

        logger.info('Scores bootstrap load completed', {
          tournamentId: Number(tournamentId),
          durationMs: Math.round((performance.now() - t0) * 100) / 100,
          squadsCount: squadsData.length,
          hasSelectedSquad: Boolean(selectedSquadData?.squad_id),
        })

        void fetchPlayersWithScores(tournamentId, squadToUse?.id ?? null, token)
      })
      .catch(err => {
        logger.error('Error fetching initial data:', err)
        setIsLoading(false)
      })
  }, [fetchPlayersWithScores, sessionToken, selectionRefreshKey])

  return {
    players,
    setPlayers,
    tournament,
    selectedSquad,
    selectedSquadRef,
    playersRef,
    isLoading,
    selectionRefreshKey,
  }
}
