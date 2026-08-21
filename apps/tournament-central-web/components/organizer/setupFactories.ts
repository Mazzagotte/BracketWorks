import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, SquadConfig } from './types';

export function buildClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildDuplicateName(name: string, fallback: string): string {
  const baseName = name.trim() || fallback;
  return `${baseName} Copy`;
}

export function normalizeSquadDefaults(defaults: { locationName?: string; registrationDeadlineIso?: string | null }): { locationName: string; registrationDeadlineIso: string | null } {
  return {
    locationName: defaults.locationName?.trim() || '',
    registrationDeadlineIso: defaults.registrationDeadlineIso?.trim() || null,
  };
}

export function emptyEvent(order: number): EventConfig {
  return {
    id: `ev-${Date.now()}`,
    name: '',
    description: '',
    minPlayers: 1,
    maxPlayers: 1,
    scoring: 'handicap',
    requireSquad: false,
    requireDivision: false,
    allowReentry: false,
    maxReentries: 0,
    enabled: true,
    displayOrder: order,
    connectedDivisionIds: [],
    connectedSquadIds: [],
    entryFeeCents: 0,
  };
}

export function emptyDivision(): DivisionConfig {
  return {
    id: `div-${Date.now()}`,
    name: '',
    description: '',
    minAverage: null,
    maxAverage: null,
    minAge: null,
    maxAge: null,
    mode: 'both',
    eligibilityNotes: '',
    enabled: true,
    eventIds: [],
  };
}

export function emptySquad(): SquadConfig {
  return {
    id: `sq-${Date.now()}`,
    name: '',
    dateIso: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    checkInTime: '08:15',
    requiredBowlerCount: 1,
    locationName: '',
    capacity: 0,
    waitlistEnabled: true,
    registrationDeadlineIso: null,
    notes: '',
    eventIds: [],
    registeredCount: 0,
  };
}

export function emptyQuestion(order: number): CustomQuestionConfig {
  return {
    id: `cq-${Date.now()}`,
    label: '',
    type: 'short-text',
    required: false,
    options: [],
    helpText: '',
    displayOrder: order,
    enabled: true,
    scope: { all: true, eventIds: [], divisionIds: [], squadIds: [] },
  };
}

export function emptyFee(order: number): FeeConfig {
  return {
    id: `fee-${Date.now()}`,
    name: '',
    amountCents: 0,
    required: false,
    enabled: true,
    displayOrder: order,
    eventIds: [],
    divisionIds: [],
    squadIds: [],
  };
}

export function emptyLocation(): LocationConfig {
  return { id: `loc-${Date.now()}`, name: '', city: '', state: '', defaultLocation: false };
}
