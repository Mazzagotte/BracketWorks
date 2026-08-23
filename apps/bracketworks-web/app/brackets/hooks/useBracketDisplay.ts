'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { BracketPreview } from '../../hooks/useBrackets'
import { getBracketGroups } from '../../lib/bracketPrograms'
import type { BracketResponse, BracketRound } from '../../lib/types'

type BracketItem = {
  group: ReturnType<typeof getBracketGroups>[number]
  bracket: ReturnType<typeof getBracketGroups>[number]['brackets'][number]
}

interface UseBracketDisplayArgs {
  loadedBrackets: BracketPreview | null
  isMobile: boolean
}

interface UseBracketDisplayResult {
  activeTab: string
  setActiveTab: (tab: string) => void
  selectedBracketIndex: number
  setSelectedBracketIndex: (index: number) => void
  mobileOpenBracketIndex: number | null
  setMobileOpenBracketIndex: (index: number | null) => void
  searchFirstName: string
  setSearchFirstName: React.Dispatch<React.SetStateAction<string>>
  searchLastName: string
  setSearchLastName: React.Dispatch<React.SetStateAction<string>>
  bracketGroups: ReturnType<typeof getBracketGroups>
  filteredBracketItems: BracketItem[]
  searchFilteredBracketItems: BracketItem[]
  mobileBracketSections: Array<{ key: string; name: string; items: Array<{ item: BracketItem; index: number }> }>
  activeBracketItem: BracketItem | null
  rounds: BracketRound[]
  bracketSearchTerm: string
  searchResultCount: number | null
  totalBracketCount: number
  totalPlayersAtGeneration: number
  handleClearFilters: () => void
}

/**
 * Owns bracket display state: tab selection, bracket navigation, search/filter,
 * and all derived display values.
 * No API calls — consumes loaded bracket data from the parent.
 */
export function useBracketDisplay({ loadedBrackets, isMobile }: UseBracketDisplayArgs): UseBracketDisplayResult {
  const [activeTab, setActiveTab] = useState('all')
  const [selectedBracketIndex, setSelectedBracketIndex] = useState(0)
  const [mobileOpenBracketIndex, setMobileOpenBracketIndex] = useState<number | null>(null)
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')

  const bracketGroups = useMemo(
    () => getBracketGroups(loadedBrackets as BracketResponse | null).filter(g => g.brackets?.length),
    [loadedBrackets],
  )

  const totalBracketCount = useMemo(
    () => bracketGroups.reduce((sum, g) => sum + g.brackets.length, 0),
    [bracketGroups],
  )

  const totalPlayersAtGeneration = loadedBrackets?.current_player_count ?? loadedBrackets?.player_count_at_generation ?? 0

  // Reset active tab when bracket groups change and active tab no longer exists
  useEffect(() => {
    if (activeTab === 'all') return
    if (!bracketGroups.some(g => g.key === activeTab)) {
      setActiveTab(bracketGroups.length > 1 ? 'all' : (bracketGroups[0]?.key || 'all'))
      setSelectedBracketIndex(0)
    }
  }, [activeTab, bracketGroups])

  const filteredBracketItems = useMemo<BracketItem[]>(() => {
    if (activeTab === 'all') {
      return bracketGroups.flatMap(group => group.brackets.map(bracket => ({ group, bracket })))
    }
    const activeGroup = bracketGroups.find(g => g.key === activeTab)
    if (!activeGroup) return []
    return activeGroup.brackets.map(bracket => ({ group: activeGroup, bracket }))
  }, [activeTab, bracketGroups])

  const searchFilteredBracketItems = useMemo<BracketItem[]>(() => {
    const firstNameTerm = searchFirstName.trim().toLowerCase()
    const lastNameTerm = searchLastName.trim().toLowerCase()
    if (!firstNameTerm && !lastNameTerm) return filteredBracketItems

    return filteredBracketItems.filter(({ bracket }) =>
      (bracket.rounds || []).some(round =>
        round.matches.some(match => {
          const normalized = (name?: string) => (name || '').toLowerCase()
          const matchA = normalized(match.playerA)
          const matchB = normalized(match.playerB)
          const firstOk = !firstNameTerm || matchA.includes(firstNameTerm) || matchB.includes(firstNameTerm)
          const lastOk = !lastNameTerm || matchA.includes(lastNameTerm) || matchB.includes(lastNameTerm)
          return firstOk && lastOk
        })
      )
    )
  }, [filteredBracketItems, searchFirstName, searchLastName])

  const mobileBracketSections = useMemo(() => {
    const grouped = new Map<string, { key: string; name: string; items: Array<{ item: BracketItem; index: number }> }>()
    searchFilteredBracketItems.forEach((item, index) => {
      const existing = grouped.get(item.group.key)
      if (existing) {
        existing.items.push({ item, index })
      } else {
        grouped.set(item.group.key, { key: item.group.key, name: item.group.name, items: [{ item, index }] })
      }
    })
    return Array.from(grouped.values())
  }, [searchFilteredBracketItems])

  // Clamp selected index when the visible set shrinks
  useEffect(() => {
    if (selectedBracketIndex >= searchFilteredBracketItems.length) setSelectedBracketIndex(0)
  }, [searchFilteredBracketItems.length, selectedBracketIndex])

  // Clamp mobile open index when the visible set shrinks
  useEffect(() => {
    if (!isMobile || mobileOpenBracketIndex === null) return
    if (mobileOpenBracketIndex >= searchFilteredBracketItems.length) setMobileOpenBracketIndex(null)
  }, [isMobile, mobileOpenBracketIndex, searchFilteredBracketItems.length])

  const activeBracketItem = useMemo<BracketItem | null>(() => {
    if (!searchFilteredBracketItems.length) return null
    const safeIndex = Math.min(selectedBracketIndex, searchFilteredBracketItems.length - 1)
    return searchFilteredBracketItems[safeIndex] ?? null
  }, [searchFilteredBracketItems, selectedBracketIndex])

  const rounds = useMemo<BracketRound[]>(() => {
    if (!loadedBrackets) return []
    if (loadedBrackets.rounds) return loadedBrackets.rounds
    return activeBracketItem?.bracket?.rounds ?? []
  }, [activeBracketItem, loadedBrackets])

  const bracketSearchTerm = useMemo(
    () => [searchFirstName.trim(), searchLastName.trim()].filter(Boolean).join(' ').trim(),
    [searchFirstName, searchLastName],
  )

  const searchResultCount = useMemo(
    () => (bracketSearchTerm ? searchFilteredBracketItems.length : null),
    [bracketSearchTerm, searchFilteredBracketItems.length],
  )

  const handleClearFilters = useCallback(() => {
    setSearchFirstName('')
    setSearchLastName('')
  }, [])

  return {
    activeTab,
    setActiveTab,
    selectedBracketIndex,
    setSelectedBracketIndex,
    mobileOpenBracketIndex,
    setMobileOpenBracketIndex,
    searchFirstName,
    setSearchFirstName,
    searchLastName,
    setSearchLastName,
    bracketGroups,
    filteredBracketItems,
    searchFilteredBracketItems,
    mobileBracketSections,
    activeBracketItem,
    rounds,
    bracketSearchTerm,
    searchResultCount,
    totalBracketCount,
    totalPlayersAtGeneration,
    handleClearFilters,
  }
}
