import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePayouts } from './usePayouts'

const { mockApiFetch, mockGetMemoryAccessToken } = vi.hoisted(() => ({
  mockApiFetch: vi.fn<(input: string, options?: RequestInit) => Promise<Response>>(),
  mockGetMemoryAccessToken: vi.fn<() => string | null>(),
}))

vi.mock('../../lib/api', () => ({
  API: (path: string) => path,
  apiFetch: mockApiFetch,
  getMemoryAccessToken: () => mockGetMemoryAccessToken(),
}))

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

function createPayoutResponse(bracketName: string): Response {
  return new Response(
    JSON.stringify({
      total_prize_pool: 100,
      total_scratch_pool: 100,
      total_handicap_pool: 0,
      program_summaries: [],
      scratch_brackets: [
        {
          bracket_name: bracketName,
          bracket_type: 'scratch',
          bracket_size: 8,
          prize_pool: 100,
          winners: [],
          status: 'completed',
        },
      ],
      handicap_brackets: [],
      winners_by_bracket: [],
      validation: {
        is_valid: true,
        errors: [],
        warnings: [],
        total_distributed: 100,
        total_collected: 100,
      },
      tournament_info: {
        id: 1,
        name: 'Test Tournament',
        squad_id: null,
        entry_fees: {
          scratch: 25,
          handicap: 0,
        },
      },
    }),
    { status: 200 },
  )
}

describe('usePayouts', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockApiFetch.mockReset()
    mockGetMemoryAccessToken.mockReset()
    mockGetMemoryAccessToken.mockReturnValue('token')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('ignores stale payout responses when a newer request completes first', async () => {
    const firstRequest = createDeferredResponse()
    const secondRequest = createDeferredResponse()

    mockApiFetch
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise)

    const { result } = renderHook(() => usePayouts(1, null))

    await act(async () => {
      void result.current.loadPayoutData()
      void result.current.loadPayoutData()
    })

    secondRequest.resolve(createPayoutResponse('Newest Data'))

    await waitFor(() => {
      expect(result.current.payoutData?.scratch_brackets[0]?.bracket_name).toBe('Newest Data')
      expect(result.current.loading).toBe(false)
    })

    firstRequest.resolve(createPayoutResponse('Stale Data'))

    await waitFor(() => {
      expect(result.current.payoutData?.scratch_brackets[0]?.bracket_name).toBe('Newest Data')
      expect(result.current.loading).toBe(false)
    })
  })
})
