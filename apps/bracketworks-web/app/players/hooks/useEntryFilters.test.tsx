import type { FormEvent } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useEntryFilters } from './useEntryFilters'

describe('useEntryFilters', () => {
  afterEach(() => vi.useRealTimers())

  it('trims submitted filters before debounced API values are exposed', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useEntryFilters())

    act(() => {
      result.current.setSearchUsbc(' 12345 ')
      result.current.setSearchFirstName(' Jane ')
      result.current.setSearchLastName(' Doe ')
    })

    await act(async () => {
      result.current.handleEntrySearchSubmit({ preventDefault() {} } as FormEvent<HTMLFormElement>)
      await vi.advanceTimersByTimeAsync(650)
    })

    expect(result.current.debouncedSearchUsbc).toBe('12345')
    expect(result.current.debouncedSearchFirstName).toBe('Jane')
    expect(result.current.debouncedSearchLastName).toBe('Doe')
  })

  it('clears all filters', () => {
    const { result } = renderHook(() => useEntryFilters())
    act(() => {
      result.current.setSearchUsbc('123')
      result.current.setSearchFirstName('Jane')
      result.current.clearEntryFilters()
    })
    expect(result.current.hasActiveEntryFilters).toBe(false)
    expect(result.current.searchUsbc).toBe('')
  })
})
