import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useMediaQuery } from './useMediaQuery'

describe('useMediaQuery', () => {
  it('tracks media-query boundary changes and removes its listener', () => {
    let matches = false
    let listener: (() => void) | undefined
    const removeEventListener = vi.fn()

    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      get matches() {
        return matches
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, nextListener: EventListenerOrEventListenerObject) => {
        listener = nextListener as () => void
      },
      removeEventListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 900px)'))
    expect(result.current).toBe(false)

    act(() => {
      matches = true
      listener?.()
    })
    expect(result.current).toBe(true)

    unmount()
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
