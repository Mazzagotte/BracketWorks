import { storage } from './storage'

const KEY_LAST_TOURNAMENT_ID = 'lastTournamentId'
const KEY_SELECTED_SQUAD_ID = 'selected_squad_id'
const KEY_ACTIVE_TOURNAMENT_NAME = 'activeTournamentName'
const KEY_ACTIVE_SQUAD_LABEL = 'activeSquadLabel'
const KEY_AVAILABLE_SQUAD_COUNT = 'availableSquadCount'

type SelectionEventName = 'tournament-changed' | 'squad-changed' | 'settings-changed'

function dispatchSelectionEvent(name: SelectionEventName) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(name))
}

export function getSelectedTournamentId(): string | null {
  return storage.getItem(KEY_LAST_TOURNAMENT_ID)
}

export function getSelectedSquadId(): string | null {
  return storage.getItem(KEY_SELECTED_SQUAD_ID)
}

export function getActiveTournamentName(): string | null {
  return storage.getItem(KEY_ACTIVE_TOURNAMENT_NAME)
}

export function getActiveSquadLabel(): string | null {
  return storage.getItem(KEY_ACTIVE_SQUAD_LABEL)
}

export function setAvailableSquadCount(count: number) {
  storage.setItem(KEY_AVAILABLE_SQUAD_COUNT, String(Math.max(0, count)))
}

export function resolveSquadSelection<T extends { id: number }>(
  squads: T[],
  serverSelectedId?: number | null,
  storedSelectedId?: string | number | null,
): T | null {
  const candidateIds = [serverSelectedId, storedSelectedId == null ? null : Number(storedSelectedId)]
  for (const candidateId of candidateIds) {
    if (!candidateId || !Number.isFinite(candidateId)) continue
    const match = squads.find(squad => squad.id === candidateId)
    if (match) return match
  }
  return squads.length === 1 ? squads[0] ?? null : null
}

export function setSelectedTournament(id: number, name?: string | null) {
  storage.setItem(KEY_LAST_TOURNAMENT_ID, String(id))
  if (name != null) {
    storage.setItem(KEY_ACTIVE_TOURNAMENT_NAME, name)
  }
  dispatchSelectionEvent('tournament-changed')
}

export function clearSelectedTournament(options?: { clearSquad?: boolean }) {
  const clearSquad = options?.clearSquad ?? false
  storage.removeItem(KEY_LAST_TOURNAMENT_ID)
  storage.removeItem(KEY_ACTIVE_TOURNAMENT_NAME)
  dispatchSelectionEvent('tournament-changed')
  if (clearSquad) {
    storage.removeItem(KEY_SELECTED_SQUAD_ID)
    storage.removeItem(KEY_ACTIVE_SQUAD_LABEL)
    storage.removeItem(KEY_AVAILABLE_SQUAD_COUNT)
    dispatchSelectionEvent('squad-changed')
  }
}

export function setSelectedSquad(id: number | null) {
  const nextValue = id == null ? null : String(id)
  if (storage.getItem(KEY_SELECTED_SQUAD_ID) === nextValue) return

  if (id == null) {
    storage.removeItem(KEY_SELECTED_SQUAD_ID)
  } else {
    storage.setItem(KEY_SELECTED_SQUAD_ID, String(id))
  }
  dispatchSelectionEvent('squad-changed')
}

export function setActiveSquadLabel(label: string) {
  if (storage.getItem(KEY_ACTIVE_SQUAD_LABEL) === label) return
  storage.setItem(KEY_ACTIVE_SQUAD_LABEL, label)
  dispatchSelectionEvent('squad-changed')
}

export function clearSelectedSquad() {
  storage.removeItem(KEY_SELECTED_SQUAD_ID)
  storage.removeItem(KEY_ACTIVE_SQUAD_LABEL)
  dispatchSelectionEvent('squad-changed')
}

export function notifySettingsChanged() {
  dispatchSelectionEvent('settings-changed')
}

export function shouldRequireTimeSlotBeforeLeavingDashboard(currentPath: string, targetPath: string): boolean {
  if (currentPath !== '/dashboard') return false
  if (targetPath === '/dashboard') return false

  const tournamentId = getSelectedTournamentId()
  const selectedSquadId = getSelectedSquadId()
  const availableSquadCount = Number(storage.getItem(KEY_AVAILABLE_SQUAD_COUNT))

  if (!tournamentId || selectedSquadId) return false
  return Number.isFinite(availableSquadCount) && availableSquadCount > 1
}

export function showSelectTimeSlotReminder() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('bw-select-time-slot-reminder'))
}
