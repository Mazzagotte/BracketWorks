import { useMemo } from 'react'

import { SidePotsSettings } from '../../lib/types'
import { storage } from '../../lib/storage'
import { EntryData } from './usePayouts'
import { ScoreRow } from './usePayoutSetup'

export type SidePotSummary = {
  key: string
  name: string
  entryCount: number
  pool: number
  winnerId: string | null
  winnerName: string | null
  winnerMetric: number | null
}

export type SidePotAccounting = {
  totalPool: number
  summaries: SidePotSummary[]
}

const EMPTY_SIDE_POT_ACCOUNTING: SidePotAccounting = {
  totalPool: 0,
  summaries: [],
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getPotMetric(potKey: string, score?: ScoreRow): number | null {
  if (!score) {
    return null
  }

  const scratchGames = [
    toFiniteNumber(score.game1_scratch),
    toFiniteNumber(score.game2_scratch),
    toFiniteNumber(score.game3_scratch),
  ].filter((number): number is number => number !== null)

  const handicapGames = [
    toFiniteNumber(score.game1_with_handicap),
    toFiniteNumber(score.game2_with_handicap),
    toFiniteNumber(score.game3_with_handicap),
  ].filter((number): number is number => number !== null)

  switch (potKey) {
    case 'high_game_scratch':
      return scratchGames.length > 0 ? Math.max(...scratchGames) : null
    case 'high_series_scratch':
      return scratchGames.length > 0 ? scratchGames.reduce((sum, number) => sum + number, 0) : null
    case 'high_game_handicap':
      return handicapGames.length > 0 ? Math.max(...handicapGames) : null
    case 'high_series_handicap':
      return handicapGames.length > 0 ? handicapGames.reduce((sum, number) => sum + number, 0) : null
    default:
      return null
  }
}

export function useSidePotAccounting(
  selectedTournamentId: number | null,
  entryData: EntryData | null,
  scoreRows: ScoreRow[],
): SidePotAccounting {
  return useMemo(() => {
    if (!selectedTournamentId) {
      return EMPTY_SIDE_POT_ACCOUNTING
    }

    try {
      const rawSettings = storage.getItem(`sidePots_${selectedTournamentId}`)
      const rawEntries = storage.getItem(`sidePotEntries_${selectedTournamentId}`)

      if (!rawSettings || !rawEntries) {
        return EMPTY_SIDE_POT_ACCOUNTING
      }

      const settings = JSON.parse(rawSettings) as SidePotsSettings
      const sidePotEntriesMap = JSON.parse(rawEntries) as Record<string, Record<string, boolean>>
      const enabledPots = (settings.pots ?? []).filter((pot) => pot.enabled)

      if (enabledPots.length === 0 || settings.entry_fee <= 0) {
        return EMPTY_SIDE_POT_ACCOUNTING
      }

      const activePlayerIds = new Set((entryData?.entries ?? []).map((entry) => Number(entry.id)))
      const playerNameById = new Map((entryData?.entries ?? []).map((entry) => [String(entry.id), entry.name]))
      const scoreByPlayerId = new Map(scoreRows.map((score) => [String(score.player_id), score]))

      const summaries: SidePotSummary[] = enabledPots.map((pot) => {
        const entrantsWithMetric = Object.entries(sidePotEntriesMap)
          .filter(([playerIdRaw, entries]) => {
            const playerId = Number(playerIdRaw)
            const inActiveSet = activePlayerIds.size === 0 || activePlayerIds.has(playerId)
            return inActiveSet && Boolean(entries?.[pot.key])
          })
          .map(([playerIdRaw]) => {
            const id = String(playerIdRaw)
            return {
              id,
              name: playerNameById.get(id) ?? `Player #${playerIdRaw}`,
              metric: getPotMetric(pot.key, scoreByPlayerId.get(id)),
            }
          })

        const winner = entrantsWithMetric
          .filter((entry) => entry.metric !== null)
          .sort((a, b) => {
            if ((b.metric ?? 0) !== (a.metric ?? 0)) {
              return (b.metric ?? 0) - (a.metric ?? 0)
            }
            return a.name.localeCompare(b.name)
          })[0]

        const entryCount = Object.entries(sidePotEntriesMap).reduce((count, [playerIdRaw, entries]) => {
          const playerId = Number(playerIdRaw)
          const inActiveSet = activePlayerIds.size === 0 || activePlayerIds.has(playerId)
          return inActiveSet && entries?.[pot.key] ? count + 1 : count
        }, 0)

        return {
          key: pot.key,
          name: pot.name,
          entryCount,
          pool: entryCount * (settings.prize_amount ?? settings.entry_fee),
          winnerId: winner?.id ?? null,
          winnerName: winner?.name ?? null,
          winnerMetric: winner?.metric ?? null,
        }
      })

      const totalPool = summaries.reduce((sum, summary) => sum + summary.pool, 0)
      return { totalPool, summaries }
    } catch {
      return EMPTY_SIDE_POT_ACCOUNTING
    }
  }, [entryData, scoreRows, selectedTournamentId])
}
