import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { apiFetchMock, apiPatchMock, apiDeleteMock, toastErrorMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  apiPatchMock: vi.fn(),
  apiDeleteMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('../../lib/api', () => ({
  API: (path: string) => path,
  apiFetch: apiFetchMock,
  apiClient: { patch: apiPatchMock, delete: apiDeleteMock, post: vi.fn() },
}))

vi.mock('../../components/Toast', () => ({ useToastHelpers: () => ({ error: toastErrorMock }) }))

import { usePlayers } from './usePlayers'

const squad = { id: 7, name: 'Saturday', date: '2026-08-22', time: '10:00' }
const options = {
  selectedSquad: squad,
  squads: [squad],
  authToken: 'token',
  getItem: (key: string) => key === 'lastTournamentId' ? '42' : key === 'user_id' ? '9' : null,
  entryFee: 25,
  bracketPrograms: [
    { key: 'handicap', name: 'Handicap', enabled: true, entry_fee: 25, scoring_mode: 'handicap' },
    { key: 'scratch', name: 'Scratch', enabled: true, entry_fee: 25, scoring_mode: 'scratch' },
  ],
}

const response = () => new Response(JSON.stringify([{
  id: 1, full_name: 'Jane Doe', usbc_number: '12345', average: 180,
  handicap_entry_count: 1, scratch_entry_count: 0, program_entry_counts: { handicap: 1 },
  lane: 'A1', division: 'Mens', squad_id: 7, amount_paid: 0,
}]), { status: 200 })

describe('usePlayers persistence invariants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetchMock.mockResolvedValue(response())
    apiPatchMock.mockResolvedValue({})
    apiDeleteMock.mockResolvedValue({})
  })
  afterEach(() => vi.useRealTimers())

  it('keeps edited data visible and persists the edit', async () => {
    const { result } = renderHook(() => usePlayers(options))
    await waitFor(() => expect(result.current.players).toHaveLength(1))
    vi.useFakeTimers()
    act(() => { void result.current.updatePlayer(1, { average: 190 }) })
    expect(result.current.players[0]?.average).toBe(190)
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    expect(apiPatchMock).toHaveBeenCalledWith('/api/v1/bowlers/1', expect.objectContaining({ average: 190 }))
  })

  it('removes an entry only after delete succeeds', async () => {
    const { result } = renderHook(() => usePlayers(options))
    await waitFor(() => expect(result.current.players).toHaveLength(1))
    await act(async () => { await result.current.deletePlayer(1) })
    expect(result.current.players).toEqual([])
  })

  it('preserves an entry when delete fails', async () => {
    apiDeleteMock.mockRejectedValueOnce(new Error('delete failed'))
    const { result } = renderHook(() => usePlayers(options))
    await waitFor(() => expect(result.current.players).toHaveLength(1))
    await act(async () => { await result.current.deletePlayer(1) })
    expect(result.current.players).toHaveLength(1)
    expect(toastErrorMock).toHaveBeenCalledWith('Failed to delete player: delete failed', 'Delete Failed')
  })
})
