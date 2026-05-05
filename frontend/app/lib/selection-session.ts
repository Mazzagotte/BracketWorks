import { storage } from './storage'

const KEY_LAST_TOURNAMENT_ID = 'lastTournamentId'
const KEY_SELECTED_SQUAD_ID = 'selected_squad_id'
const KEY_ACTIVE_TOURNAMENT_NAME = 'activeTournamentName'
const KEY_ACTIVE_SQUAD_LABEL = 'activeSquadLabel'

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
    dispatchSelectionEvent('squad-changed')
  }
}

export function setSelectedSquad(id: number | null) {
  if (id == null) {
    storage.removeItem(KEY_SELECTED_SQUAD_ID)
  } else {
    storage.setItem(KEY_SELECTED_SQUAD_ID, String(id))
  }
  dispatchSelectionEvent('squad-changed')
}

export function setActiveSquadLabel(label: string) {
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

  return Boolean(tournamentId) && !selectedSquadId
}

export function showSelectTimeSlotReminder() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('bw-select-time-slot-reminder'))
}
