import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDashboardWorkflowModel } from './useDashboardWorkflowModel'

function buildArgs(overrides: Partial<Parameters<typeof useDashboardWorkflowModel>[0]> = {}) {
  return {
    workflowStatus: null,
    tournamentBracketsConfigured: false,
    loadedEntries: 0,
    bracketsSold: 0,
    squadsLength: 0,
    bracketSize: 8,
    missingAveragesCount: 0,
    unpaidEntriesCount: 0,
    duplicatePlayersCount: 0,
    scoreProgress: {
      completed: 0,
      entered: 0,
      total: 0,
      percent: 0,
      loading: false,
    },
    normalizedPrograms: [
      { key: 'handicap', name: 'Handicap', enabled: true },
      { key: 'scratch', name: 'Scratch', enabled: true },
    ],
    statsProgramSummaries: [
      { name: 'Scratch', display_order: 2 },
      { name: 'Handicap', display_order: 1 },
    ],
    isEntryDataSyncing: false,
    onGoPlayers: vi.fn(),
    onGoBrackets: vi.fn(),
    onGoPayouts: vi.fn(),
    onGoScores: vi.fn(),
    onOpenEditTournament: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenSquadSelector: vi.fn(),
    onChangeTournament: vi.fn(),
    onUnloadTournament: vi.fn(),
    ...overrides,
  }
}

describe('useDashboardWorkflowModel', () => {
  it('requires tournament setup when no squads exist', () => {
    const { result } = renderHook(() => useDashboardWorkflowModel(buildArgs({ squadsLength: 0 })))

    expect(result.current.contextPrimaryAction.key).toBe('edit-tournament')
    expect(result.current.contextPrimaryAction.label).toBe('Complete Tournament Setup')
    expect(result.current.workflowSteps[0]?.status).toBe('In Progress')
  })

  it('routes to score entry when brackets exist and scoring is incomplete', () => {
    const { result } = renderHook(() =>
      useDashboardWorkflowModel(
        buildArgs({
          workflowStatus: {
            status_squad_id: 10,
            has_generated_brackets: true,
            has_payout_summary: false,
            payouts_finalized: false,
            scores_locked: false,
          },
          loadedEntries: 12,
          scoreProgress: {
            completed: 3,
            entered: 5,
            total: 12,
            percent: 25,
            loading: false,
          },
        }),
      ),
    )

    expect(result.current.contextPrimaryAction.key).toBe('enter-scores')
    expect(result.current.contextPrimaryAction.showScoreProgress).toBe(true)
    expect(result.current.scoreStatusLabel).toBe('In Progress')
  })

  it('routes to payout calculation when scores are complete but payout summary is missing', () => {
    const { result } = renderHook(() =>
      useDashboardWorkflowModel(
        buildArgs({
          workflowStatus: {
            status_squad_id: 10,
            has_generated_brackets: true,
            has_payout_summary: false,
            payouts_finalized: false,
            scores_locked: false,
          },
          loadedEntries: 8,
          scoreProgress: {
            completed: 8,
            entered: 8,
            total: 8,
            percent: 100,
            loading: false,
          },
        }),
      ),
    )

    expect(result.current.contextPrimaryAction.key).toBe('calculate-payouts')
    expect(result.current.payoutStatusLabel).toBe('Ready for Payouts')
  })

  it('surfaces setup blockers and keeps workflow in warning state', () => {
    const { result } = renderHook(() =>
      useDashboardWorkflowModel(
        buildArgs({
          squadsLength: 1,
          loadedEntries: 12,
          bracketsSold: 12,
          missingAveragesCount: 2,
          unpaidEntriesCount: 1,
          duplicatePlayersCount: 1,
        }),
      ),
    )

    expect(result.current.contextPrimaryAction.key).toBe('add-player')
    expect(result.current.contextPrimaryAction.label).toBe('Review Entries')
    expect(result.current.statusNarrative.tone).toBe('warning')
    expect(result.current.blockerSummary).toContain('2 missing averages')
    expect(result.current.blockerSummary).toContain('1 unpaid entries')
  })

  it('marks final state after payouts are finalized', () => {
    const { result } = renderHook(() =>
      useDashboardWorkflowModel(
        buildArgs({
          workflowStatus: {
            status_squad_id: 20,
            has_generated_brackets: true,
            has_payout_summary: true,
            payouts_finalized: true,
            scores_locked: true,
          },
          loadedEntries: 16,
          scoreProgress: {
            completed: 16,
            entered: 16,
            total: 16,
            percent: 100,
            loading: false,
          },
        }),
      ),
    )

    expect(result.current.contextPrimaryAction.key).toBe('view-payouts')
    expect(result.current.workflowSteps[3]?.done).toBe(true)
    expect(result.current.workflowSteps[4]?.done).toBe(true)
    expect(result.current.payoutStatusLabel).toBe('Finalized')
  })
})
