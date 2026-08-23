import { renderHook, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { useScoreEditing } from './useScoreEditing'
import type { Player, Squad, Tournament } from '../../lib/types'

// Mock API and session helpers
vi.mock('../../lib/api', () => ({
  API: (path: string) => path,
  apiFetch: vi.fn(),
}))
vi.mock('../../lib/selection-session', () => ({
  getSelectedTournamentId: () => '42',
  getSelectedSquadId: () => '7',
}))

import { apiFetch } from '../../lib/api'
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>

const makePlayer = (id: number, scores?: Player['scores']): Player =>
  ({ id, firstName: 'Test', lastName: `Player${id}`, handicap: 10, average: 180, lane: id, scores } as unknown as Player)

const squad: Squad = { id: 7, name: 'A', date: '2026-01-01', time: '10:00' } as Squad
const tournament: Tournament = { id: 42, name: 'Test Tournament' } as Tournament

function buildArgs(players: Player[], overrides: Partial<Parameters<typeof useScoreEditing>[0]> = {}) {
  const setPlayers = vi.fn()
  const playersRef = { current: players }
  const selectedSquadRef = { current: squad }
  const addToast = vi.fn()
  const setPendingSaves = vi.fn()

  return {
    players,
    setPlayers,
    playersRef,
    selectedSquadRef,
    tournament,
    isScoresLocked: false,
    isOnline: true,
    isMobile: false,
    sessionToken: 'test-token',
    addToast,
    pendingSaves: [],
    setPendingSaves,
    paginatedItems: players,
    ...overrides,
  }
}

describe('useScoreEditing — core behaviors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(window, 'prompt').mockReturnValue('Score sheet correction')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('rejects invalid score (> 300) and shows toast without saving', async () => {
    const player = makePlayer(1)
    const args = buildArgs([player])
    mockApiFetch.mockResolvedValue(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => useScoreEditing(args))

    await act(async () => {
      await result.current.updateScore(1, 'game1_scratch', 350)
    })

    expect(args.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('rejects editing when scores are locked', async () => {
    const player = makePlayer(1)
    const args = buildArgs([player], { isScoresLocked: true })

    const { result } = renderHook(() => useScoreEditing(args))

    await act(async () => {
      await result.current.updateScore(1, 'game1_scratch', 200)
    })

    expect(args.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'warning' }))
    expect(mockApiFetch).not.toHaveBeenCalled()
  })

  it('sets row state to saving then saved on successful save', async () => {
    const player = makePlayer(1, { game1_scratch: 150 } as Player['scores'])
    const args = buildArgs([player])
    mockApiFetch.mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))

    const { result } = renderHook(() => useScoreEditing(args))

    await act(async () => {
      void result.current.updateScore(1, 'game1_scratch', 200)
    })

    // Initially saving
    expect(result.current.rowSaveState[1]).toBe('saving')

    // Advance only past the 500ms debounce — the 1400ms "saved→idle" reset must not fire yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(result.current.rowSaveState[1]).toBe('saved')
    expect(mockApiFetch).toHaveBeenCalledWith('/api/v1/scores/', expect.objectContaining({
      body: expect.stringContaining('"correction_reason":"Score sheet correction"'),
    }))
  })

  it('sets row state to failed on API error and shows toast', async () => {
    const player = makePlayer(1)
    const args = buildArgs([player])
    mockApiFetch.mockResolvedValue(new Response('error', { status: 500 }))

    const { result } = renderHook(() => useScoreEditing(args))

    await act(async () => {
      void result.current.updateScore(1, 'game1_scratch', 200)
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.rowSaveState[1]).toBe('failed')
    expect(args.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
  })

  it('undo restores previous value and triggers save', async () => {
    const player = makePlayer(1, { game1_scratch: 150 } as Player['scores'])
    const args = buildArgs([player])
    mockApiFetch.mockResolvedValue(new Response('{}', { status: 200 }))

    const { result } = renderHook(() => useScoreEditing(args))

    // First edit: 150 -> 200 (with history)
    await act(async () => {
      void result.current.updateScore(1, 'game1_scratch', 200, { trackHistory: true })
    })

    expect(result.current.lastEdit).toEqual({ playerId: 1, field: 'game1_scratch', previous: 150 })

    // Undo should set the score back to 150
    await act(async () => {
      result.current.undoLastEdit()
    })

    expect(result.current.lastEdit).toBeNull()
    // setPlayers was called with an updater (optimistic update)
    expect(args.setPlayers).toHaveBeenCalled()
  })

  it('queues pending save when offline instead of calling API', async () => {
    const player = makePlayer(1)
    const args = buildArgs([player], { isOnline: false })

    const { result } = renderHook(() => useScoreEditing(args))

    await act(async () => {
      void result.current.updateScore(1, 'game1_scratch', 200)
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(args.setPendingSaves).toHaveBeenCalled()
    expect(result.current.rowSaveState[1]).toBe('failed')
  })

  it('does not save when tournament context is missing', async () => {
    const player = makePlayer(1)
    const args = buildArgs([player], { sessionToken: null })

    const { result } = renderHook(() => useScoreEditing(args))

    await act(async () => {
      void result.current.updateScore(1, 'game1_scratch', 200)
    })

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(mockApiFetch).not.toHaveBeenCalled()
    expect(result.current.rowSaveState[1]).toBe('failed')
  })
})
