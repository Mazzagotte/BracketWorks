import { useCallback, useMemo, useState } from 'react'

import { calculateSidePotCost } from '../../lib/bracketPrograms'
import { getSidePotsStorageKey } from '../../lib/dashboard-settings'
import { SidePotsSettings } from '../../lib/types'
import { Player } from '../types'

export function usePlayerSidePots(rawPlayers: Player[]) {
  const [sidePots, setSidePots] = useState<SidePotsSettings | null>(null)

  const loadSidePots = useCallback((tournamentId: string | null, settingsFromApi?: SidePotsSettings | null) => {
    if (!tournamentId) {
      setSidePots(null)
      return
    }

    if (settingsFromApi) {
      const next = { ...settingsFromApi, tournament_id: Number(tournamentId) }
      setSidePots(next)
      localStorage.setItem(getSidePotsStorageKey(tournamentId), JSON.stringify(next))
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
  }, [])

  const players = useMemo(
    () => rawPlayers.map(player => {
      const sidePotEntries = player.sidePotEntries ?? {}
      const sidePotCost = calculateSidePotCost(sidePotEntries, sidePots)
      return {
        ...player,
        sidePotEntries,
        totalCost: player.totalCost + sidePotCost,
      }
    }),
    [rawPlayers, sidePots],
  )

  return {
    sidePots,
    players,
    loadSidePots,
  }
}
