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

  it('keeps previously loaded payout data when refresh fails', async () => {
    mockApiFetch
      .mockResolvedValueOnce(createPayoutResponse('Initial Data'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'refresh failed' }), { status: 500 }))

    const { result } = renderHook(() => usePayouts(1, null))

    await act(async () => {
      await result.current.loadPayoutData()
    })

    await waitFor(() => {
      expect(result.current.payoutData?.scratch_brackets[0]?.bracket_name).toBe('Initial Data')
    })

    await act(async () => {
      await result.current.loadPayoutData()
    })

    await waitFor(() => {
      expect(result.current.error).toBe('refresh failed')
      expect(result.current.payoutData?.scratch_brackets[0]?.bracket_name).toBe('Initial Data')
    })
  })

  it('falls back to bowlers when live entries returns no players', async () => {
    mockApiFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ entries: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { id: 1, full_name: 'Alex Lane' },
        { id: 2, full_name: 'Casey Rollins' },
      ]), { status: 200 }))

    const { result } = renderHook(() => usePayouts(99, 7))

    await act(async () => {
      await result.current.loadEntryData()
    })

    await waitFor(() => {
      expect(result.current.entryData?.entries).toHaveLength(2)
      expect(result.current.entryData?.entries[0]?.name).toBe('Alex Lane')
      expect(result.current.entryData?.summary.total_players).toBe(2)
    })

    expect(mockApiFetch).toHaveBeenCalledTimes(2)
    expect(mockApiFetch.mock.calls[0]?.[0]).toContain('/api/v1/payouts/live-entries/99?squad_id=7')
    expect(mockApiFetch.mock.calls[1]?.[0]).toContain('/api/v1/bowlers?tournament_id=99&squad_id=7')
  })
})
