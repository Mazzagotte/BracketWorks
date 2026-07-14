import { useCallback, useMemo, useState } from 'react'

import { calculateSidePotCost } from '../../lib/bracketPrograms'
import { getSidePotsStorageKey } from '../../lib/dashboard-settings'
import { SidePotsSettings } from '../../lib/types'
import { Player } from '../types'

const getSidePotEntriesStorageKey = (tournamentId: string | number) => `sidePotEntries_${String(tournamentId)}`

export function usePlayerSidePots(rawPlayers: Player[]) {
  const [sidePots, setSidePots] = useState<SidePotsSettings | null>(null)
  const [sidePotEntriesMap, setSidePotEntriesMap] = useState<Record<number, Record<string, boolean>>>({})

  const loadSidePots = useCallback((tournamentId: string | null) => {
    if (!tournamentId) {
      setSidePots(null)
      setSidePotEntriesMap({})
      return
    }

    try {
      const raw = localStorage.getItem(getSidePotsStorageKey(tournamentId))
      if (raw) {
        setSidePots(JSON.parse(raw) as SidePotsSettings)
      } else {
        setSidePots(null)
      }
    } catch {
      setSidePots(null)
    }

    try {
      const rawEntries = localStorage.getItem(getSidePotEntriesStorageKey(tournamentId))
      if (rawEntries) {
        setSidePotEntriesMap(JSON.parse(rawEntries) as Record<number, Record<string, boolean>>)
      } else {
        setSidePotEntriesMap({})
      }
    } catch {
      setSidePotEntriesMap({})
    }
  }, [])

  const persistPlayerSidePotEntries = useCallback((
    tournamentId: string | null,
    playerId: number,
    nextEntries: Record<string, boolean>,
  ) => {
    if (!tournamentId) return

    setSidePotEntriesMap(previous => {
      const next = { ...previous, [playerId]: nextEntries }
      localStorage.setItem(getSidePotEntriesStorageKey(tournamentId), JSON.stringify(next))
      return next
    })
  }, [])

  const mergeAndPersistSidePotEntries = useCallback((
    tournamentId: string | null,
    entriesByPlayer: Map<number, Record<string, boolean>>,
  ) => {
    setSidePotEntriesMap(previous => {
      const next = { ...previous }
      entriesByPlayer.forEach((entries, playerId) => {
        next[playerId] = entries
      })

      if (tournamentId) {
        localStorage.setItem(getSidePotEntriesStorageKey(tournamentId), JSON.stringify(next))
      }

      return next
    })
  }, [])

  const players = useMemo(
    () => rawPlayers.map(player => {
      const sidePotEntries = sidePotEntriesMap[player.id] ?? {}
      const sidePotCost = calculateSidePotCost(sidePotEntries, sidePots)
      return {
        ...player,
        sidePotEntries,
        totalCost: player.totalCost + sidePotCost,
      }
    }),
    [rawPlayers, sidePotEntriesMap, sidePots],
  )

  return {
    sidePots,
    players,
    loadSidePots,
    persistPlayerSidePotEntries,
    mergeAndPersistSidePotEntries,
  }
}
