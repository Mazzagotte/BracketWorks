import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSelectedTournament,
  clearSelectedSquad,
  getActiveSquadLabel,
  getActiveTournamentName,
  getSelectedSquadId,
  getSelectedTournamentId,
  resolveSquadSelection,
  setActiveSquadLabel,
  setAvailableSquadCount,
  setSelectedSquad,
  setSelectedTournament,
  shouldRequireTimeSlotBeforeLeavingDashboard,
} from './selection-session'

describe('selection-session', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearSelectedSquad()
  })

  it('persists tournament identity and dispatches tournament event', () => {
    const listener = vi.fn()
    window.addEventListener('tournament-changed', listener)

    setSelectedTournament(44, 'Summer Open')

    expect(getSelectedTournamentId()).toBe('44')
    expect(getActiveTournamentName()).toBe('Summer Open')
    expect(listener).toHaveBeenCalledTimes(1)

    window.removeEventListener('tournament-changed', listener)
  })

  it('persists squad identity and label and dispatches squad events', () => {
    const listener = vi.fn()
    window.addEventListener('squad-changed', listener)

    setSelectedSquad(77)
    setActiveSquadLabel('Fri 7:00 PM')

    expect(getSelectedSquadId()).toBe('77')
    expect(getActiveSquadLabel()).toBe('Fri 7:00 PM')
    expect(listener).toHaveBeenCalledTimes(2)

    window.removeEventListener('squad-changed', listener)
  })

  it('does not dispatch another squad event when the selection is unchanged', () => {
    setSelectedSquad(77)
    setActiveSquadLabel('Fri 7:00 PM')
    const listener = vi.fn()
    window.addEventListener('squad-changed', listener)

    setSelectedSquad(77)
    setActiveSquadLabel('Fri 7:00 PM')

    expect(listener).not.toHaveBeenCalled()
    window.removeEventListener('squad-changed', listener)
  })

  it('clears tournament and squad state when clearSquad is requested', () => {
    const tournamentListener = vi.fn()
    const squadListener = vi.fn()
    window.addEventListener('tournament-changed', tournamentListener)
    window.addEventListener('squad-changed', squadListener)

    setSelectedTournament(10, 'Clear Test')
    setSelectedSquad(90)
    setActiveSquadLabel('Sat 1:00 PM')

    clearSelectedTournament({ clearSquad: true })

    expect(getSelectedTournamentId()).toBeNull()
    expect(getActiveTournamentName()).toBeNull()
    expect(getSelectedSquadId()).toBeNull()
    expect(getActiveSquadLabel()).toBeNull()
    expect(tournamentListener).toHaveBeenCalled()
    expect(squadListener).toHaveBeenCalled()

    window.removeEventListener('tournament-changed', tournamentListener)
    window.removeEventListener('squad-changed', squadListener)
  })

  it('requires squad selection only when leaving dashboard with a selected tournament', () => {
    setSelectedTournament(25, 'Stateful Event')
    setAvailableSquadCount(2)

    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/scores')).toBe(true)

    setSelectedSquad(3)
    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/scores')).toBe(false)

    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/scores', '/payouts')).toBe(false)
    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/dashboard')).toBe(false)
  })

  it('allows leaving the dashboard when the tournament has exactly one squad', () => {
    setSelectedTournament(25, 'Single Squad Event')
    setAvailableSquadCount(1)

    expect(getSelectedSquadId()).toBeNull()
    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/players')).toBe(false)
  })

  it('still requires an explicit selection when multiple squads exist', () => {
    setSelectedTournament(25, 'Multi Squad Event')
    setAvailableSquadCount(2)

    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/scores')).toBe(true)
  })

  it('does not block navigation while a zero-row or legacy single-squad schedule is loading', () => {
    setSelectedTournament(25, 'Legacy Single Squad Event')
    setAvailableSquadCount(0)

    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/brackets')).toBe(false)
  })

  it('resolves and returns the sole squad when no explicit selection exists', () => {
    const squads = [{ id: 11, time: '6:00 PM' }]
    expect(resolveSquadSelection(squads, null, null)).toEqual(squads[0])
  })

  it('does not silently select the first squad when multiple squads exist', () => {
    const squads = [{ id: 11 }, { id: 12 }]
    expect(resolveSquadSelection(squads, null, null)).toBeNull()
    expect(resolveSquadSelection(squads, 12, null)).toEqual(squads[1])
  })
})
