import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useUsernameAvailability } from './useUsernameAvailability'

type DeferredResponse = {
  promise: Promise<Response>
  resolve: (response: Response) => void
}

function createDeferredResponse(): DeferredResponse {
  let resolveFn: (response: Response) => void = () => undefined
  const promise = new Promise<Response>((resolve) => {
    resolveFn = resolve
  })
  return {
    promise,
    resolve: resolveFn,
  }
}

describe('useUsernameAvailability', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ignores stale responses from older availability checks', async () => {
    const firstRequest = createDeferredResponse()
    const secondRequest = createDeferredResponse()

    vi.stubGlobal(
      'fetch',
      vi
        .fn<() => Promise<Response>>()
        .mockImplementationOnce(() => firstRequest.promise)
        .mockImplementationOnce(() => secondRequest.promise),
    )

    const { result, rerender } = renderHook(
      ({ value }) => useUsernameAvailability(value, { debounceMs: 0, minLength: 3 }),
      { initialProps: { value: 'alpha' } },
    )

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(result.current.checkingUsername).toBe(true)
    })

    rerender({ value: 'bravo' })

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2)
    })

    secondRequest.resolve(new Response(JSON.stringify({ available: false }), { status: 200 }))

    await waitFor(() => {
      expect(result.current.usernameAvailable).toBe(false)
      expect(result.current.checkingUsername).toBe(false)
    })

    firstRequest.resolve(new Response(JSON.stringify({ available: true }), { status: 200 }))

    await waitFor(() => {
      expect(result.current.usernameAvailable).toBe(false)
      expect(result.current.checkingUsername).toBe(false)
    })
  })

  it('sets null availability when response shape is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ available: 'yes' }), { status: 200 })),
    )

    const { result } = renderHook(() => useUsernameAvailability('validName', { debounceMs: 0, minLength: 3 }))

    await waitFor(() => {
      expect(result.current.checkingUsername).toBe(false)
      expect(result.current.usernameAvailable).toBeNull()
    })
  })
})
