import { useCallback, useEffect, useMemo, useState } from 'react'

import { apiClient } from '../../lib/api'
import { logger } from '../../lib/logger'

export type BowlerHistoryProfile = {
  id: number
  first_name: string
  last_name: string
  usbc_number?: string | null
}

export function useBowlerHistorySearch(authToken: string | null) {
  const [historySearchUsbc, setHistorySearchUsbc] = useState('')
  const [historySearchFirstName, setHistorySearchFirstName] = useState('')
  const [historySearchLastName, setHistorySearchLastName] = useState('')

  const [debouncedHistorySearchUsbc, setDebouncedHistorySearchUsbc] = useState('')
  const [debouncedHistorySearchFirstName, setDebouncedHistorySearchFirstName] = useState('')
  const [debouncedHistorySearchLastName, setDebouncedHistorySearchLastName] = useState('')

  const [historyResults, setHistoryResults] = useState<BowlerHistoryProfile[]>([])
  const [isHistorySearching, setIsHistorySearching] = useState(false)

  const hasHistorySearchInput = useMemo(() => Boolean(
    historySearchUsbc.trim()
    || historySearchFirstName.trim()
    || historySearchLastName.trim()
  ), [historySearchUsbc, historySearchFirstName, historySearchLastName])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedHistorySearchUsbc(historySearchUsbc)
      setDebouncedHistorySearchFirstName(historySearchFirstName)
      setDebouncedHistorySearchLastName(historySearchLastName)
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [historySearchUsbc, historySearchFirstName, historySearchLastName])

  useEffect(() => {
    const runHistorySearch = async () => {
      if (!authToken) {
        setHistoryResults([])
        return
      }

      const hasSearch = Boolean(
        debouncedHistorySearchUsbc.trim()
        || debouncedHistorySearchFirstName.trim()
        || debouncedHistorySearchLastName.trim()
      )
      if (!hasSearch) {
        setHistoryResults([])
        return
      }

      setIsHistorySearching(true)
      try {
        const params = new URLSearchParams()
        if (debouncedHistorySearchUsbc.trim()) params.set('usbc_number', debouncedHistorySearchUsbc.trim())
        if (debouncedHistorySearchFirstName.trim()) params.set('first_name', debouncedHistorySearchFirstName.trim())
        if (debouncedHistorySearchLastName.trim()) params.set('last_name', debouncedHistorySearchLastName.trim())
        params.set('limit', '25')

        const data = await apiClient.get<BowlerHistoryProfile[]>(`/api/v1/bowlers/profiles?${params.toString()}`)
        setHistoryResults(Array.isArray(data) ? data : [])
      } catch (error) {
        logger.error('Failed to search bowler history', { error })
        setHistoryResults([])
      } finally {
        setIsHistorySearching(false)
      }
    }

    void runHistorySearch()
  }, [authToken, debouncedHistorySearchUsbc, debouncedHistorySearchFirstName, debouncedHistorySearchLastName])

  const triggerHistorySearch = useCallback(() => {
    setDebouncedHistorySearchUsbc(historySearchUsbc.trim())
    setDebouncedHistorySearchFirstName(historySearchFirstName.trim())
    setDebouncedHistorySearchLastName(historySearchLastName.trim())
  }, [historySearchUsbc, historySearchFirstName, historySearchLastName])

  const clearHistorySearch = useCallback(() => {
    setHistorySearchUsbc('')
    setHistorySearchFirstName('')
    setHistorySearchLastName('')
    setHistoryResults([])
  }, [])

  return {
    historySearchUsbc,
    setHistorySearchUsbc,
    historySearchFirstName,
    setHistorySearchFirstName,
    historySearchLastName,
    setHistorySearchLastName,
    historyResults,
    setHistoryResults,
    isHistorySearching,
    hasHistorySearchInput,
    triggerHistorySearch,
    clearHistorySearch,
  }
}
