import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useBracketGenerationFlow } from './useBracketGenerationFlow'
import type { BracketPreview } from '../../hooks/useBrackets'
import type { Squad, Tournament } from '../../lib/types'

const tournament: Tournament = { id: 1, name: 'Test Tournament' } as Tournament
const squad: Squad = { id: 7, name: 'A', date: '2026-01-01', time: '10:00' } as Squad
const mockPreview: BracketPreview = { bracket_size: 8 }

function buildArgs(overrides: Partial<Parameters<typeof useBracketGenerationFlow>[0]> = {}) {
  const generateTournamentBrackets = vi.fn().mockResolvedValue(mockPreview)
  const addToast = vi.fn()
  const reloadAfterGeneration = vi.fn()

  return {
    selectedTournament: tournament,
    selectedSquad: squad,
    generateTournamentBrackets,
    addToast,
    reloadAfterGeneration,
    ...overrides,
  }
}

describe('useBracketGenerationFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows error toast and does not generate when no tournament is selected', async () => {
    const args = buildArgs({ selectedTournament: null })
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    await act(async () => {
      result.current.handleGenerateBrackets()
    })

    expect(args.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    expect(args.generateTournamentBrackets).not.toHaveBeenCalled()
    expect(result.current.isModalOpen).toBe(false)
  })

  it('shows error toast and does not generate when no squad is selected', async () => {
    const args = buildArgs({ selectedSquad: null })
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    await act(async () => {
      result.current.handleGenerateBrackets()
    })

    expect(args.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }))
    expect(args.generateTournamentBrackets).not.toHaveBeenCalled()
  })

  it('opens modal and starts generation when tournament and squad are present', async () => {
    const args = buildArgs()
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    await act(async () => {
      result.current.handleGenerateBrackets()
    })

    expect(result.current.isModalOpen).toBe(true)
    expect(result.current.bracketGenerationPromise).not.toBeNull()
    expect(args.generateTournamentBrackets).toHaveBeenCalledWith(
      tournament.id,
      squad.id,
      8,
      true,
      true,
    )
  })

  it('shows success toast when generation resolves', async () => {
    const args = buildArgs()
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    let generationDone = false
    await act(async () => {
      result.current.handleGenerateBrackets()
      generationDone = true
    })

    // Wait for the promise to settle
    await act(async () => {
      await result.current.bracketGenerationPromise
    })

    expect(args.addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
    expect(generationDone).toBe(true)
  })

  it('closing the modal calls reloadAfterGeneration', async () => {
    const args = buildArgs()
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    await act(async () => {
      result.current.handleGenerateBrackets()
    })

    await act(async () => {
      result.current.handleModalClose()
    })

    expect(args.reloadAfterGeneration).toHaveBeenCalledTimes(1)
    expect(result.current.isModalOpen).toBe(false)
    expect(result.current.bracketGenerationPromise).toBeNull()
  })

  it('handleRegenerate starts a new generation', async () => {
    const args = buildArgs()
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    await act(async () => {
      result.current.handleRegenerate()
    })

    expect(args.generateTournamentBrackets).toHaveBeenCalledTimes(1)
    expect(result.current.isModalOpen).toBe(true)
  })

  it('resetGenerationModalState closes modal without reload', async () => {
    const args = buildArgs()
    const { result } = renderHook(() => useBracketGenerationFlow(args))

    await act(async () => {
      result.current.handleGenerateBrackets()
    })

    expect(result.current.isModalOpen).toBe(true)

    await act(async () => {
      result.current.resetGenerationModalState()
    })

    expect(result.current.isModalOpen).toBe(false)
    expect(result.current.bracketGenerationPromise).toBeNull()
    expect(args.reloadAfterGeneration).not.toHaveBeenCalled()
  })
})
