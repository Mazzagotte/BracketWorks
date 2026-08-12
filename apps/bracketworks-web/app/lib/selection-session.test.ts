import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSelectedTournament,
  getActiveSquadLabel,
  getActiveTournamentName,
  getSelectedSquadId,
  getSelectedTournamentId,
  setActiveSquadLabel,
  setSelectedSquad,
  setSelectedTournament,
  shouldRequireTimeSlotBeforeLeavingDashboard,
} from './selection-session'

describe('selection-session', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
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

    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/scores')).toBe(true)

    setSelectedSquad(3)
    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/scores')).toBe(false)

    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/scores', '/payouts')).toBe(false)
    expect(shouldRequireTimeSlotBeforeLeavingDashboard('/dashboard', '/dashboard')).toBe(false)
  })
})
