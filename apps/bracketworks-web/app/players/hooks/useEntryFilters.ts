import { useCallback, useState } from 'react'
import type { FormEvent } from 'react'

import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export function useEntryFilters() {
  const [searchUsbc, setSearchUsbc] = useState('')
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')

  const debouncedSearchUsbc = useDebouncedValue(searchUsbc.trim(), 300)
  const debouncedSearchFirstName = useDebouncedValue(searchFirstName.trim(), 300)
  const debouncedSearchLastName = useDebouncedValue(searchLastName.trim(), 300)
  const hasActiveEntryFilters = Boolean(searchUsbc.trim() || searchFirstName.trim() || searchLastName.trim())

  const handleEntrySearchSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSearchUsbc(current => current.trim())
    setSearchFirstName(current => current.trim())
    setSearchLastName(current => current.trim())
  }, [])

  const clearEntryFilters = useCallback(() => {
    setSearchUsbc('')
    setSearchFirstName('')
    setSearchLastName('')
  }, [])

  return {
    searchUsbc,
    setSearchUsbc,
    searchFirstName,
    setSearchFirstName,
    searchLastName,
    setSearchLastName,
    debouncedSearchUsbc,
    debouncedSearchFirstName,
    debouncedSearchLastName,
    hasActiveEntryFilters,
    handleEntrySearchSubmit,
    clearEntryFilters,
  }
}
