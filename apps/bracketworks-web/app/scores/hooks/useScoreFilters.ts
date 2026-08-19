'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Player } from '../../lib/types'
import type { SortConfig } from '../types'
import { usePagination } from '../../components/Performance'

export interface UseScoreFiltersResult {
  sortConfig: SortConfig
  handleSort: (column: string) => void
  sortedPlayers: Player[]
  filteredPlayers: Player[]
  searchFirstName: string
  setSearchFirstName: React.Dispatch<React.SetStateAction<string>>
  searchLastName: string
  setSearchLastName: React.Dispatch<React.SetStateAction<string>>
  paginationHook: ReturnType<typeof usePagination<Player>>
}

/**
 * Owns sort/filter/search/pagination derived state for the scores table.
 * All values are computed; no API calls.
 */
export function useScoreFilters(players: Player[], isMobile: boolean): UseScoreFiltersResult {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ column: null, direction: null })
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')

  const handleSort = useCallback((column: string) => {
    setSortConfig(current => {
      if (current.column === column) {
        const next = current.direction === 'asc' ? 'desc' : current.direction === 'desc' ? null : 'asc'
        return { column: next ? column : null, direction: next }
      }
      return { column, direction: 'asc' }
    })
  }, [])

  const sortedPlayers = useMemo(() => {
    if (!sortConfig.column || !sortConfig.direction) return players

    return [...players].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortConfig.column) {
        case 'firstName':
          aVal = a.firstName?.toLowerCase() || ''; bVal = b.firstName?.toLowerCase() || ''; break
        case 'lastName':
          aVal = a.lastName?.toLowerCase() || ''; bVal = b.lastName?.toLowerCase() || ''; break
        case 'lane':
          aVal = a.lane || 0; bVal = b.lane || 0; break
        case 'average':
          aVal = a.average || 0; bVal = b.average || 0; break
        case 'game1_scratch':
          aVal = a.scores?.game1_scratch || 0; bVal = b.scores?.game1_scratch || 0; break
        case 'game1_total':
          aVal = (a.scores?.game1_scratch || 0) + (a.handicap ?? 0)
          bVal = (b.scores?.game1_scratch || 0) + (b.handicap ?? 0); break
        case 'game2_scratch':
          aVal = a.scores?.game2_scratch || 0; bVal = b.scores?.game2_scratch || 0; break
        case 'game2_total':
          aVal = (a.scores?.game2_scratch || 0) + (a.handicap ?? 0)
          bVal = (b.scores?.game2_scratch || 0) + (b.handicap ?? 0); break
        case 'game3_scratch':
          aVal = a.scores?.game3_scratch || 0; bVal = b.scores?.game3_scratch || 0; break
        case 'game3_total':
          aVal = (a.scores?.game3_scratch || 0) + (a.handicap ?? 0)
          bVal = (b.scores?.game3_scratch || 0) + (b.handicap ?? 0); break
        case 'totalScratch': {
          aVal = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0)
          bVal = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0)
          break
        }
        case 'totalWithHandicap': {
          const aS = (a.scores?.game1_scratch || 0) + (a.scores?.game2_scratch || 0) + (a.scores?.game3_scratch || 0)
          const bS = (b.scores?.game1_scratch || 0) + (b.scores?.game2_scratch || 0) + (b.scores?.game3_scratch || 0)
          aVal = aS + (a.handicap ?? 0) * 3; bVal = bS + (b.handicap ?? 0) * 3; break
        }
        default:
          aVal = 0; bVal = 0
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal
      }
      const cmp = String(aVal).localeCompare(String(bVal))
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [players, sortConfig])

  const filteredPlayers = useMemo(() => {
    const first = searchFirstName.trim().toLowerCase()
    const last = searchLastName.trim().toLowerCase()
    if (!first && !last) return sortedPlayers
    return sortedPlayers.filter(p => {
      const pFirst = (p.firstName || '').toLowerCase()
      const pLast = (p.lastName || '').toLowerCase()
      return (!first || pFirst.includes(first)) && (!last || pLast.includes(last))
    })
  }, [sortedPlayers, searchFirstName, searchLastName])

  const visiblePlayers = isMobile ? filteredPlayers : filteredPlayers

  const paginationHook = usePagination({ items: visiblePlayers, itemsPerPage: 50, resetOnItemsChange: false })

  useEffect(() => {
    paginationHook.goToPage(1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFirstName, searchLastName, isMobile])

  return {
    sortConfig,
    handleSort,
    sortedPlayers,
    filteredPlayers,
    searchFirstName,
    setSearchFirstName,
    searchLastName,
    setSearchLastName,
    paginationHook,
  }
}
