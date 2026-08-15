'use client';

import { ArrowUpDown, CalendarDays, ChevronUp, CircleAlert, CircleCheck, ClipboardList, Clock3, Eye, Filter, Globe, GripVertical, Headphones, Info, Layers, Link2, ListOrdered, Lock, MapPin, MoreHorizontal, PencilLine, Plus, RotateCcw, Save, Trash2, Trophy, Upload, Users, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { useRouter } from 'next/navigation';

import ConfigDrawer from './ConfigDrawer';
import PublishValidationSummary from './PublishValidationSummary';
import TournamentRegistrationForm from '../public/TournamentRegistrationForm';
import TournamentDetailsSection from './setup/TournamentDetailsSection';
import { initialCustomQuestions, initialDivisions, initialEvents, initialFees, initialLocations, initialRegistrationFields, initialSquads, setupSections } from './setupConfig';
import SetupStatusBadge from './SetupStatusBadge';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, RegistrationFieldConfig, SetupSectionKey, SetupStatus, SquadConfig, ValidationIssue } from './types';
import styles from './tournament-setup.module.css';

type DrawerState =
  | { kind: 'event'; id?: string }
  | { kind: 'division'; id?: string }
  | { kind: 'squad'; id?: string }
  | { kind: 'field'; id?: string }
  | { kind: 'question'; id?: string }
  | { kind: 'fee'; id?: string }
  | { kind: 'location'; id?: string }
  | null;

type CardMenuState =
  | { kind: 'event'; id: string }
  | { kind: 'division'; id: string }
  | null;

type OrganizerRegistrationQuestionAnswerValue = string | boolean | string[];

type OrganizerRegistrationFormState = {
  bowlers: Array<Record<string, string>>;
  eventId: string;
  divisionId: string;
  squadId: string;
  notes: string;
  bowlerQuestionAnswers: Array<Record<string, OrganizerRegistrationQuestionAnswerValue>>;
  acceptTerms: boolean;
};

const EMPTY_ORGANIZER_REGISTRATION_FORM: OrganizerRegistrationFormState = {
  bowlers: [{}],
  eventId: '',
  divisionId: '',
  squadId: '',
  notes: '',
  bowlerQuestionAnswers: [{}],
  acceptTerms: false,
};

const sectionLabelMap = new Map(setupSections.map((section) => [section.key, section.label]));

function isSetupSectionKey(value: string | null): value is SetupSectionKey {
  return setupSections.some((section) => section.key === value);
}

function getUrlActiveSection(): SetupSectionKey {
  if (typeof window === 'undefined') {
    return 'tournament-details';
  }

  const params = new URLSearchParams(window.location.search);
  const querySection = params.get('section');
  return isSetupSectionKey(querySection) ? querySection : 'tournament-details';
}

function getInitialTournamentId(): number | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const rawTournamentId = params.get('tournament');
  if (!rawTournamentId) {
    return null;
  }

  const tournamentId = Number(rawTournamentId);
  return Number.isInteger(tournamentId) && tournamentId > 0 ? tournamentId : null;
}

function syncUrlState(params: { activeSection: SetupSectionKey; tournamentId: number | null }): void {
  if (typeof window === 'undefined') {
    return;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('section', params.activeSection);

  if (params.tournamentId) {
    nextUrl.searchParams.set('tournament', String(params.tournamentId));
  } else {
    nextUrl.searchParams.delete('tournament');
  }

  window.history.replaceState(window.history.state, '', nextUrl);
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatEntryFeeInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function normalizeEntryFeeInput(value: string): string {
  const sanitized = value.replace(/[^\d.]/g, '');
  const firstDecimalIndex = sanitized.indexOf('.');

  if (firstDecimalIndex === -1) {
    return sanitized;
  }

  const whole = sanitized.slice(0, firstDecimalIndex + 1);
  const fraction = sanitized.slice(firstDecimalIndex + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}${fraction}`;
}

function parseEntryFeeInputToCents(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / (1024 ** unitIndex);
  const precision = unitIndex === 0 ? 0 : size >= 10 ? 0 : 1;
  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

function inferLogoFileLabel(fileName: string): string {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith('.svg')) {
    return 'SVG';
  }
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'JPG';
  }
  if (normalized.endsWith('.png')) {
    return 'PNG';
  }
  return 'Image';
}

function formatDateLabel(dateIso: string): string {
  return new Date(`${dateIso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateShort(dateIso: string): string {
  if (!dateIso) {
    return 'Not set';
  }

  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return dateIso;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function shiftIsoDate(dateIso: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return '';
  }

  const [yearText, monthText, dayText] = dateIso.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return '';
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function formatSquadTimeLabel(time: string): string {
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return time;
  }

  const [hoursText, minutesText] = time.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return time;
  }

  const date = new Date(2000, 0, 1, hours, minutes);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildSquadDisplayName(squad: Pick<SquadConfig, 'dateIso' | 'startTime'>): string {
  const dateLabel = squad.dateIso ? formatDateLabel(squad.dateIso) : 'Squad';
  const timeLabel = squad.startTime ? formatSquadTimeLabel(squad.startTime) : 'Time TBD';
  return `${dateLabel} - ${timeLabel}`;
}

function buildClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDuplicateName(name: string, fallback: string): string {
  const baseName = name.trim() || fallback;
  return `${baseName} Copy`;
}

function registrationFieldFallbackHelp(field: Pick<RegistrationFieldConfig, 'key' | 'label'>): string {
  const byKey: Record<string, string> = {
    usbc_number: 'Helps verify your average and membership.',
    first_name: "Bowler's legal first name.",
    last_name: "Bowler's legal last name.",
    email: "We'll use this to send important updates.",
    phone: 'In case we need to reach you.',
    address: 'Optional mailing address.',
    city: 'City for your address.',
    state: 'State or province for your address.',
    zip: 'Postal code for your address.',
  };

  const direct = byKey[field.key.toLowerCase()];
  if (direct) {
    return direct;
  }

  return `Add helper text for ${field.label.toLowerCase()}.`;
}

function normalizeRegistrationFieldKey(key: string): string {
  return key.trim().toLowerCase();
}

function getRegistrationFieldInputType(field: RegistrationFieldConfig): 'text' | 'email' | 'tel' | 'number' | 'date' {
  const key = normalizeRegistrationFieldKey(field.key);
  const validation = (field.validation || '').trim().toLowerCase();

  if (validation === 'email' || key.includes('email')) {
    return 'email';
  }

  if (validation === 'phone' || key.includes('phone')) {
    return 'tel';
  }

  if (validation === 'number' || key.includes('average')) {
    return 'number';
  }

  if (validation === 'date' || key.includes('date')) {
    return 'date';
  }

  return 'text';
}

function isWideRegistrationField(field: RegistrationFieldConfig): boolean {
  const key = normalizeRegistrationFieldKey(field.key);
  return key.includes('email')
    || key.includes('phone')
    || key.includes('usbc')
    || key.includes('address')
    || key.includes('zip')
    || key.includes('city')
    || key.includes('state');
}

function normalizeQuestionOptions(options: string[] | undefined): string[] {
  if (!Array.isArray(options)) {
    return [];
  }

  return options.map((option) => option.trim()).filter(Boolean);
}

function isRegistrationQuestionAnswered(
  question: CustomQuestionConfig,
  answer: OrganizerRegistrationQuestionAnswerValue | undefined,
): boolean {
  const type = (question.type || 'short-text').toLowerCase();
  const options = normalizeQuestionOptions(question.options);

  if (type === 'checkbox' && options.length > 0) {
    return Array.isArray(answer) && answer.some((value) => value.trim().length > 0);
  }

  if (type === 'checkbox') {
    return answer === true;
  }

  if (Array.isArray(answer)) {
    return answer.some((value) => value.trim().length > 0);
  }

  if (typeof answer === 'boolean') {
    return true;
  }

  return typeof answer === 'string' && answer.trim().length > 0;
}

function getRequiredBowlerCountFromSquad(squad: SquadConfig | null): number | null {
  if (!squad) {
    return null;
  }

  const rawValue = typeof squad.requiredBowlerCount === 'number'
    ? squad.requiredBowlerCount
    : null;

  if (rawValue === null || !Number.isFinite(rawValue)) {
    return null;
  }

  return Math.max(1, Math.round(rawValue));
}

function getRequiredBowlerCountFromEvent(event: EventConfig | null): number {
  if (!event) {
    return 1;
  }

  const minPlayers = typeof event.minPlayers === 'number' ? Number(event.minPlayers) : 1;
  const maxPlayers = typeof event.maxPlayers === 'number' ? Number(event.maxPlayers) : minPlayers;

  return Math.max(1, Math.max(minPlayers, maxPlayers));
}

function normalizeSquadDefaults(defaults: { locationName?: string; registrationDeadlineIso?: string | null }): { locationName: string; registrationDeadlineIso: string | null } {
  return {
    locationName: defaults.locationName?.trim() || '',
    registrationDeadlineIso: defaults.registrationDeadlineIso?.trim() || null,
  };
}

function emptyEvent(order: number): EventConfig {
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

function emptyDivision(): DivisionConfig {
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

function emptySquad(): SquadConfig {
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

function emptyQuestion(order: number): CustomQuestionConfig {
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

function emptyFee(order: number): FeeConfig {
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

function emptyLocation(): LocationConfig {
  return { id: `loc-${Date.now()}`, name: '', city: '', state: '', defaultLocation: false };
}

type TournamentDetails = {
  name: string;
  subtitle: string;
  series: string;
  certification: string;
  organizer: string;
  tournamentType: string;
  startDateIso: string;
  endDateIso: string;
  bowlingCenter: string;
  city: string;
  state: string;
  timezone: string;
  visibility: 'public' | 'unlisted' | 'private';
  tournamentStatus: string;
  supportEmail: string;
  supportPhone: string;
  registrationOpenIso: string;
  registrationCloseIso: string;
  logoFileName: string;
};

type TournamentStatusRecommendation = {
  value: TournamentDetails['tournamentStatus'];
  reason: string;
};

type PaymentMode = 'unconfigured' | 'cash' | 'stripe';

type OrganizerDraft = {
  version: number;
  tournamentId: number | null;
  details: TournamentDetails;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  fees: FeeConfig[];
  locations: LocationConfig[];
  questions: CustomQuestionConfig[];
  fields: RegistrationFieldConfig[];
  hasRulesDocument: boolean;
  paymentMode: PaymentMode;
  paymentProcessorConnected: boolean;
  paymentPayoutConfigured: boolean;
};

const DRAFT_VERSION = 1;

function getDraftStorageKey(): string {
  if (typeof window === 'undefined') {
    return 'tc_organizer_setup_draft';
  }

  const userId = (localStorage.getItem('user_id') || '').trim();
  return userId ? `tc_organizer_setup_draft_user_${userId}` : 'tc_organizer_setup_draft';
}

type PersistedTournament = {
  id: number;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  squad_times: Record<string, string[]>;
  is_public: boolean;
  has_logo?: boolean;
  logo_file_name?: string | null;
  logo_mime_type?: string | null;
};

type TournamentWritePayload = {
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  squad_times: Record<string, string[]>;
  is_public: boolean;
};

type OrganizerSetupPayload = {
  version: number;
  details: TournamentDetails;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  fees: FeeConfig[];
  locations: LocationConfig[];
  questions: CustomQuestionConfig[];
  fields: RegistrationFieldConfig[];
  hasRulesDocument: boolean;
  paymentMode: PaymentMode;
  paymentProcessorConnected: boolean;
  paymentPayoutConfigured: boolean;
};

type OrganizerSetupStateResponse = {
  id: number;
  tournament_id: number;
  user_id: number;
  payload: OrganizerSetupPayload;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type OrganizerSetupStateSummary = {
  tournament_id: number;
  tournament_name: string;
  tournament_location: string | null;
  tournament_start_date: string | null;
  tournament_end_date: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type UserTournamentSummary = {
  id: number;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  squad_times: Record<string, string[]>;
  is_public: boolean;
  has_logo?: boolean;
  logo_file_name?: string | null;
  logo_mime_type?: string | null;
  entry_count?: number;
  brackets_configured?: boolean;
};

const defaultTournamentDetails: TournamentDetails = {
  name: 'Mountain Classic Open',
  subtitle: 'USBC Certified \u2022 Fall Series',
  series: 'Fall Series',
  certification: 'USBC Certified',
  organizer: 'Idaho State Bowling Association',
  tournamentType: 'Adult',
  startDateIso: '2026-10-30',
  endDateIso: '2026-11-01',
  bowlingCenter: 'Sunset Lanes',
  city: 'Boise',
  state: 'ID',
  timezone: 'America/Boise (MT)',
  visibility: 'public',
  tournamentStatus: 'draft',
  supportEmail: 'director@mountainclassic.com',
  supportPhone: '(208) 555-0198',
  registrationOpenIso: '2026-08-12',
  registrationCloseIso: '2026-10-16',
  logoFileName: '',
};

const TIMEZONES = [
  { value: 'America/New_York (ET)', label: 'America/New_York (ET)' },
  { value: 'America/Chicago (CT)', label: 'America/Chicago (CT)' },
  { value: 'America/Denver (MT)', label: 'America/Denver (MT)' },
  { value: 'America/Boise (MT)', label: 'America/Boise (MT)' },
  { value: 'America/Los_Angeles (PT)', label: 'America/Los_Angeles (PT)' },
  { value: 'America/Phoenix (AZ)', label: 'America/Phoenix (AZ)' },
  { value: 'America/Anchorage (AKT)', label: 'America/Anchorage (AKT)' },
  { value: 'Pacific/Honolulu (HT)', label: 'Pacific/Honolulu (HT)' },
];

const US_STATES: Array<{ code: string; name: string }> = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

function buildDefaultDraft(): OrganizerDraft {
  return {
    version: DRAFT_VERSION,
    tournamentId: null,
    details: defaultTournamentDetails,
    events: initialEvents,
    divisions: initialDivisions,
    squads: normalizeSquadList(initialSquads, {
      locationName: defaultTournamentDetails.bowlingCenter,
      registrationDeadlineIso: defaultTournamentDetails.registrationCloseIso,
    }),
    fees: initialFees,
    locations: initialLocations,
    questions: initialCustomQuestions,
    fields: initialRegistrationFields,
    hasRulesDocument: false,
    paymentMode: 'cash',
    paymentProcessorConnected: false,
    paymentPayoutConfigured: true,
  };
}

type LegacyEventConfig = Omit<EventConfig, 'scoring'> & {
  scoring: EventConfig['scoring'] | 'both';
};

function normalizeSquadConfig(squad: SquadConfig, defaults?: { locationName?: string; registrationDeadlineIso?: string | null }): SquadConfig {
  const normalizedDefaults = normalizeSquadDefaults(defaults ?? {});
  const normalizedRequiredBowlerCount = Number.isFinite(Number(squad.requiredBowlerCount))
    ? Math.max(1, Math.round(Number(squad.requiredBowlerCount)))
    : 1;

  return {
    ...squad,
    name: buildSquadDisplayName(squad),
    requiredBowlerCount: normalizedRequiredBowlerCount,
    locationName: normalizedDefaults.locationName || squad.locationName,
    registrationDeadlineIso: normalizedDefaults.registrationDeadlineIso || squad.registrationDeadlineIso || null,
  };
}

function normalizeSquadList(squads: SquadConfig[], defaults?: { locationName?: string; registrationDeadlineIso?: string | null }): SquadConfig[] {
  return squads.map((squad) => normalizeSquadConfig(squad, defaults));
}

function normalizeEventConfig(event: LegacyEventConfig): EventConfig {
  const connectedDivisionIds = Array.isArray(event.connectedDivisionIds) ? event.connectedDivisionIds : [];

  return {
    ...event,
    connectedDivisionIds,
    scoring: event.scoring === 'both' ? 'no-tap' : event.scoring,
    enabled: true,
    requireDivision: connectedDivisionIds.length > 0 ? event.requireDivision : false,
  };
}

function normalizeEventList(events: LegacyEventConfig[]): EventConfig[] {
  return events.map(normalizeEventConfig);
}

function normalizeRegistrationFieldsList(fields: RegistrationFieldConfig[] | null | undefined): RegistrationFieldConfig[] {
  const configuredFields = Array.isArray(fields) ? fields : [];
  const fieldsByKey = new Map(configuredFields.map((field) => [field.key, field]));

  return initialRegistrationFields.map((baseField) => {
    const configuredField = fieldsByKey.get(baseField.key);
    const normalizedField = configuredField ? { ...baseField, ...configuredField } : baseField;
    if (normalizedField.key === 'bowling_hand') {
      return {
        ...normalizedField,
        mode: 'dont-ask',
      };
    }
    return normalizedField;
  });
}

const builtInRegistrationFieldKeys = new Set(initialRegistrationFields.map((field) => field.key));

function reorderItemsByDropTarget<T extends { id: string; displayOrder: number }>(items: T[], draggedId: string, targetId: string): T[] {
  if (draggedId === targetId) {
    return items;
  }

  const ordered = [...items].sort((a, b) => a.displayOrder - b.displayOrder);
  const fromIndex = ordered.findIndex((item) => item.id === draggedId);
  const toIndex = ordered.findIndex((item) => item.id === targetId);

  if (fromIndex < 0 || toIndex < 0) {
    return items;
  }

  const moved = [...ordered];
  const [dragged] = moved.splice(fromIndex, 1);
  moved.splice(toIndex, 0, dragged);

  return moved.map((item, index) => ({ ...item, displayOrder: index + 1 } as T));
}

function loadDraftFromStorage(): OrganizerDraft {
  if (typeof window === 'undefined') {
    return buildDefaultDraft();
  }

  const raw = localStorage.getItem(getDraftStorageKey());
  if (!raw) {
    return buildDefaultDraft();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OrganizerDraft>;
    if (parsed.version !== DRAFT_VERSION) {
      return buildDefaultDraft();
    }

    const normalizedDetails = {
      ...defaultTournamentDetails,
      ...(parsed.details ?? {}),
    };

    return {
      version: DRAFT_VERSION,
      tournamentId: typeof parsed.tournamentId === 'number' ? parsed.tournamentId : null,
      details: normalizedDetails,
      events: Array.isArray(parsed.events) ? normalizeEventList(parsed.events as EventConfig[]) : initialEvents,
      divisions: Array.isArray(parsed.divisions) ? parsed.divisions : initialDivisions,
      squads: Array.isArray(parsed.squads)
        ? normalizeSquadList(parsed.squads as SquadConfig[], {
          locationName: normalizedDetails.bowlingCenter,
          registrationDeadlineIso: normalizedDetails.registrationCloseIso,
        })
        : normalizeSquadList(initialSquads, {
          locationName: normalizedDetails.bowlingCenter,
          registrationDeadlineIso: normalizedDetails.registrationCloseIso,
        }),
      fees: Array.isArray(parsed.fees) ? parsed.fees : initialFees,
      locations: Array.isArray(parsed.locations) ? parsed.locations : initialLocations,
      questions: Array.isArray(parsed.questions) ? parsed.questions : initialCustomQuestions,
      fields: normalizeRegistrationFieldsList(parsed.fields as RegistrationFieldConfig[] | undefined),
      hasRulesDocument: Boolean(parsed.hasRulesDocument),
      paymentMode: 'cash',
      paymentProcessorConnected: Boolean(parsed.paymentProcessorConnected),
      paymentPayoutConfigured: parsed.paymentPayoutConfigured === undefined ? true : Boolean(parsed.paymentPayoutConfigured),
    };
  } catch {
    return buildDefaultDraft();
  }
}

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith('csrf_token=')) {
      const raw = cookie.slice('csrf_token='.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }

  return null;
}

function buildTournamentLocation(details: TournamentDetails): string {
  const parts = [details.bowlingCenter, details.city, details.state]
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join(', ');
}

function parseTournamentLocation(location: string | null): { bowlingCenter: string; city: string; state: string } {
  const text = (location || '').trim();
  if (!text) {
    return { bowlingCenter: '', city: '', state: '' };
  }

  const parts = text.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3) {
    return {
      bowlingCenter: parts.slice(0, -2).join(', '),
      city: parts[parts.length - 2],
      state: parts[parts.length - 1],
    };
  }

  if (parts.length === 2) {
    return {
      bowlingCenter: parts[0],
      city: parts[1],
      state: '',
    };
  }

  return {
    bowlingCenter: parts[0],
    city: '',
    state: '',
  };
}

function toDraftFromTournament(tournament: UserTournamentSummary): OrganizerDraft {
  const location = parseTournamentLocation(tournament.location);
  const draft = buildDefaultDraft();

  return {
    ...draft,
    tournamentId: tournament.id,
    details: {
      ...draft.details,
      name: tournament.name || draft.details.name,
      bowlingCenter: location.bowlingCenter || draft.details.bowlingCenter,
      city: location.city || draft.details.city,
      state: location.state || draft.details.state,
      startDateIso: tournament.start_date || draft.details.startDateIso,
      endDateIso: tournament.end_date || draft.details.endDateIso,
      visibility: tournament.is_public ? 'public' : 'private',
      tournamentStatus: tournament.is_public ? 'active' : 'draft',
      logoFileName: tournament.logo_file_name || '',
    },
  };
}

function formatTournamentCardDate(startDateIso: string | null, endDateIso: string | null): string {
  const value = (startDateIso || endDateIso || '').trim();
  if (!value) {
    return 'No dates set';
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function countTournamentSquads(squadTimes: Record<string, string[]>): number {
  return Object.values(squadTimes || {}).reduce((count, times) => {
    if (!Array.isArray(times)) {
      return count;
    }
    return count + times.length;
  }, 0);
}

function buildSquadTimesPayload(squads: SquadConfig[]): Record<string, string[]> {
  const byDate = new Map<string, Set<string>>();

  for (const squad of squads) {
    const dateIso = squad.dateIso.trim();
    const startTime = squad.startTime.trim();
    if (!dateIso || !startTime) {
      continue;
    }

    const times = byDate.get(dateIso) ?? new Set<string>();
    times.add(startTime);
    byDate.set(dateIso, times);
  }

  const squadTimes: Record<string, string[]> = {};
  for (const [dateIso, times] of byDate.entries()) {
    squadTimes[dateIso] = [...times].sort((a, b) => a.localeCompare(b));
  }

  return squadTimes;
}

function buildTournamentPayload(details: TournamentDetails, squads: SquadConfig[], isPublic: boolean): TournamentWritePayload {
  const location = buildTournamentLocation(details);

  return {
    name: details.name.trim() || 'Untitled Tournament',
    location: location || null,
    start_date: details.startDateIso.trim() || null,
    end_date: details.endDateIso.trim() || null,
    squad_times: buildSquadTimesPayload(squads),
    is_public: isPublic,
  };
}

function recommendTournamentStatus(params: {
  details: TournamentDetails;
  isTournamentDetailsComplete: boolean;
  todayIso?: string;
}): TournamentStatusRecommendation {
  const { details, isTournamentDetailsComplete, todayIso = new Date().toISOString().slice(0, 10) } = params;

  if (!isTournamentDetailsComplete) {
    return {
      value: 'draft',
      reason: 'Recommended while required tournament details are still incomplete.',
    };
  }

  if (details.endDateIso && todayIso > details.endDateIso) {
    return {
      value: 'completed',
      reason: 'Tournament end date has passed.',
    };
  }

  if (details.startDateIso && todayIso >= details.startDateIso) {
    return {
      value: 'in-progress',
      reason: 'Tournament has started.',
    };
  }

  if (details.registrationOpenIso && details.registrationCloseIso && todayIso >= details.registrationOpenIso && todayIso <= details.registrationCloseIso) {
    return {
      value: 'registration-open',
      reason: 'Today is inside the registration window.',
    };
  }

  if (details.visibility !== 'private') {
    return {
      value: 'active',
      reason: 'Tournament details are complete and visible publicly.',
    };
  }

  return {
    value: 'draft',
    reason: 'Private tournament with complete details, but not publicly visible yet.',
  };
}

async function saveTournamentRecord(params: {
  token: string;
  payload: TournamentWritePayload;
  tournamentId: number | null;
}): Promise<PersistedTournament> {
  const { token, payload, tournamentId } = params;
  const endpoint = tournamentId ? `/api/v1/tc/tournaments/${tournamentId}` : '/api/v1/tc/tournaments/';
  const method = tournamentId ? 'PUT' : 'POST';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | null;
  if (!response.ok) {
    const detail = responseData && typeof responseData.detail === 'string'
      ? responseData.detail
      : `Failed to save tournament (${response.status})`;
    throw new Error(detail);
  }

  return responseData as PersistedTournament;
}

function buildOrganizerSetupPayload(input: {
  details: TournamentDetails;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  fees: FeeConfig[];
  locations: LocationConfig[];
  questions: CustomQuestionConfig[];
  fields: RegistrationFieldConfig[];
  hasRulesDocument: boolean;
  paymentMode: PaymentMode;
  paymentProcessorConnected: boolean;
  paymentPayoutConfigured: boolean;
}): OrganizerSetupPayload {
  return {
    version: DRAFT_VERSION,
    details: input.details,
    events: input.events,
    divisions: input.divisions,
    squads: input.squads,
    fees: input.fees,
    locations: input.locations,
    questions: input.questions,
    fields: input.fields,
    hasRulesDocument: input.hasRulesDocument,
    paymentMode: input.paymentMode,
    paymentProcessorConnected: input.paymentProcessorConnected,
    paymentPayoutConfigured: input.paymentPayoutConfigured,
  };
}

function normalizeOrganizerDraft(params: {
  tournamentId: number | null;
  payload: Partial<OrganizerSetupPayload>;
}): OrganizerDraft {
  const { tournamentId, payload } = params;

  const normalizedDetails = {
    ...defaultTournamentDetails,
    ...(payload.details ?? {}),
  };

  return {
    version: DRAFT_VERSION,
    tournamentId,
    details: normalizedDetails,
    events: Array.isArray(payload.events) ? normalizeEventList(payload.events as EventConfig[]) : initialEvents,
    divisions: Array.isArray(payload.divisions) ? payload.divisions : initialDivisions,
    squads: Array.isArray(payload.squads)
      ? normalizeSquadList(payload.squads as SquadConfig[], {
        locationName: normalizedDetails.bowlingCenter,
        registrationDeadlineIso: normalizedDetails.registrationCloseIso,
      })
      : normalizeSquadList(initialSquads, {
        locationName: normalizedDetails.bowlingCenter,
        registrationDeadlineIso: normalizedDetails.registrationCloseIso,
      }),
    fees: Array.isArray(payload.fees) ? payload.fees : initialFees,
    locations: Array.isArray(payload.locations) ? payload.locations : initialLocations,
    questions: Array.isArray(payload.questions) ? payload.questions : initialCustomQuestions,
    fields: normalizeRegistrationFieldsList(payload.fields as RegistrationFieldConfig[] | undefined),
    hasRulesDocument: Boolean(payload.hasRulesDocument),
    paymentMode: 'cash',
    paymentProcessorConnected: Boolean(payload.paymentProcessorConnected),
    paymentPayoutConfigured: payload.paymentPayoutConfigured === undefined ? true : Boolean(payload.paymentPayoutConfigured),
  };
}

async function loadOrganizerSetupState(token: string, tournamentId: number): Promise<OrganizerSetupStateResponse | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}`, {
    method: 'GET',
    headers,
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  const responseData = await response.json().catch(() => null) as { detail?: string } | OrganizerSetupStateResponse | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to load organizer setup (${response.status})`;
    throw new Error(detail);
  }

  return responseData as OrganizerSetupStateResponse;
}

async function listMyOrganizerSetupStates(token: string): Promise<OrganizerSetupStateSummary[]> {
  const response = await fetch('/api/v1/tc/organizer-setup/mine', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | OrganizerSetupStateSummary[] | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to load organizer setup list (${response.status})`;
    throw new Error(detail);
  }

  return Array.isArray(responseData) ? responseData : [];
}

async function listMyTournaments(token: string): Promise<UserTournamentSummary[]> {
  const response = await fetch('/api/v1/tc/tournaments/', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | UserTournamentSummary[] | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to load tournaments (${response.status})`;
    throw new Error(detail);
  }

  return Array.isArray(responseData) ? responseData : [];
}

type TournamentLogoUploadResponse = {
  ok: boolean;
  tournament_id: number;
  logo_file_name: string | null;
  logo_mime_type: string | null;
};

async function uploadTournamentLogo(params: {
  token: string;
  tournamentId: number;
  file: File;
}): Promise<TournamentLogoUploadResponse> {
  const { token, tournamentId, file } = params;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}/logo`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | TournamentLogoUploadResponse | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to upload tournament logo (${response.status})`;
    throw new Error(detail);
  }

  return responseData as TournamentLogoUploadResponse;
}

async function fetchTournamentLogoBlobUrl(token: string, tournamentId: number): Promise<string | null> {
  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}/logo`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load tournament logo (${response.status})`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    return null;
  }

  return URL.createObjectURL(blob);
}

async function deleteTournamentLogo(params: { token: string; tournamentId: number }): Promise<void> {
  const { token, tournamentId } = params;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}/logo`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!response.ok && response.status !== 404) {
    const responseData = await response.json().catch(() => null) as { detail?: string } | null;
    const detail = responseData && typeof responseData.detail === 'string'
      ? responseData.detail
      : `Failed to remove tournament logo (${response.status})`;
    throw new Error(detail);
  }
}

async function saveOrganizerSetupState(params: {
  token: string;
  tournamentId: number;
  payload: OrganizerSetupPayload;
  isPublished: boolean;
}): Promise<OrganizerSetupStateResponse> {
  const { token, tournamentId, payload, isPublished } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      payload,
      is_published: isPublished,
    }),
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | OrganizerSetupStateResponse | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to save organizer setup (${response.status})`;
    throw new Error(detail);
  }

  return responseData as OrganizerSetupStateResponse;
}

export default function TournamentSetupWorkspace() {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSection, setActiveSection] = useState<SetupSectionKey>('tournament-details');
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [details, setDetails] = useState<TournamentDetails>(defaultTournamentDetails);

  const [events, setEvents] = useState<EventConfig[]>([]);
  const [divisions, setDivisions] = useState<DivisionConfig[]>([]);
  const [squads, setSquads] = useState<SquadConfig[]>([]);
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [questions, setQuestions] = useState<CustomQuestionConfig[]>([]);
  const [fields, setFields] = useState<RegistrationFieldConfig[]>([]);
  const [squadViewMode, setSquadViewMode] = useState<'date' | 'squad'>('date');
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [openCardMenu, setOpenCardMenu] = useState<CardMenuState>(null);
  const [hasRulesDocument, setHasRulesDocument] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentProcessorConnected, setPaymentProcessorConnected] = useState(false);
  const [paymentPayoutConfigured, setPaymentPayoutConfigured] = useState(true);
  const [persistedTournamentId, setPersistedTournamentId] = useState<number | null>(null);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [userTournaments, setUserTournaments] = useState<UserTournamentSummary[]>([]);
  const [setupStateByTournamentId, setSetupStateByTournamentId] = useState<Record<number, OrganizerSetupStateSummary>>({});
  const [isLoadingTournamentLibrary, setIsLoadingTournamentLibrary] = useState(false);
  const [loadingTournamentId, setLoadingTournamentId] = useState<number | null>(null);
  const [deletingTournamentId, setDeletingTournamentId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSetupPublished, setIsSetupPublished] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState(false);
  const [hasHydratedInitialState, setHasHydratedInitialState] = useState(false);
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [autosaveSavedAt, setAutosaveSavedAt] = useState<string | null>(null);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const [isLogoDragActive, setIsLogoDragActive] = useState(false);
  const [isSubmittingSignupPreview, setIsSubmittingSignupPreview] = useState(false);
  const [signupPreviewSubmitMessage, setSignupPreviewSubmitMessage] = useState<string | null>(null);
  const [signupPreviewForm, setSignupPreviewForm] = useState<OrganizerRegistrationFormState>(EMPTY_ORGANIZER_REGISTRATION_FORM);

  useEffect(() => {
    if (!openCardMenu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(`.${styles.cardActions}`)) {
        return;
      }

      setOpenCardMenu(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [openCardMenu]);

  useEffect(() => {
    setActiveSection(getUrlActiveSection());
  }, []);

  useEffect(() => {
    if (!hasHydratedInitialState) {
      return;
    }

    syncUrlState({ activeSection, tournamentId: persistedTournamentId });
  }, [activeSection, persistedTournamentId, hasHydratedInitialState]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef(false);
  const autosaveFingerprintRef = useRef<string | null>(null);

  const setPreviewUrl = (nextUrl: string | null) => {
    setLogoPreviewUrl((previous) => {
      if (previous && previous.startsWith('blob:')) {
        URL.revokeObjectURL(previous);
      }
      return nextUrl;
    });
  };

  const autosaveFingerprint = useMemo(
    () => JSON.stringify({
      tournamentId: persistedTournamentId,
      details,
      events,
      divisions,
      squads,
      fees,
      locations,
      questions,
      fields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
      pendingLogoFile: pendingLogoFile
        ? {
            name: pendingLogoFile.name,
            size: pendingLogoFile.size,
            lastModified: pendingLogoFile.lastModified,
            type: pendingLogoFile.type,
          }
        : null,
    }),
    [
      persistedTournamentId,
      details,
      events,
      divisions,
      squads,
      fees,
      locations,
      questions,
      fields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
      pendingLogoFile,
    ],
  );

  const applyDraft = (draft: OrganizerDraft) => {
    setPersistedTournamentId(draft.tournamentId ?? null);
    setDetails(draft.details);
    setPendingLogoFile(null);
    setEvents(draft.events);
    setDivisions(draft.divisions);
    setSquads(draft.squads);
    setFees(draft.fees);
    setLocations(draft.locations);
    setQuestions(draft.questions);
    setFields(draft.fields);
    setHasRulesDocument(draft.hasRulesDocument);
    setPaymentMode(draft.paymentMode);
    setPaymentProcessorConnected(draft.paymentProcessorConnected);
    setPaymentPayoutConfigured(draft.paymentPayoutConfigured);
  };

  const hasLogoAsset = Boolean(logoPreviewUrl || details.logoFileName || pendingLogoFile);
  const logoAssetName = pendingLogoFile?.name || details.logoFileName || 'Tournament Logo';
  const logoAssetMeta = pendingLogoFile
    ? `${inferLogoFileLabel(pendingLogoFile.name)} · ${formatFileSize(pendingLogoFile.size)}`
    : `${inferLogoFileLabel(details.logoFileName)} · file uploaded`;

  const refreshTournamentLibrary = async (token: string) => {
    setIsLoadingTournamentLibrary(true);
    try {
      const [tournaments, setupStates] = await Promise.all([
        listMyTournaments(token),
        listMyOrganizerSetupStates(token),
      ]);

      setUserTournaments(tournaments);
      setSetupStateByTournamentId(
        Object.fromEntries(setupStates.map((state) => [state.tournament_id, state]))
      );

      return { tournaments, setupStates };
    } finally {
      setIsLoadingTournamentLibrary(false);
    }
  };

  useEffect(() => {
    const hasToken = typeof window !== 'undefined' && Boolean(sessionStorage.getItem('access_token'));
    const hasUser = typeof window !== 'undefined' && Boolean(localStorage.getItem('user_id'));
    if (!hasToken || !hasUser) {
      router.replace('/login?expired=true');
    }
  }, [router]);

  useEffect(() => {
    return () => {
      setLogoPreviewUrl((previous) => {
        if (previous && previous.startsWith('blob:')) {
          URL.revokeObjectURL(previous);
        }
        return null;
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const finishHydration = () => {
        if (!cancelled) {
          setHasHydratedInitialState(true);
        }
      };

      const draft = loadDraftFromStorage();
      applyDraft(draft);
      setIsSetupPublished(false);
      setPreviewUrl(null);
      setAutosaveEnabled(Boolean(draft.tournamentId));
      setAutosaveError(null);

      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
      if (!token) {
        finishHydration();
        return;
      }

      try {
        const { setupStates, tournaments } = await refreshTournamentLibrary(token);
        if (cancelled) {
          return;
        }

        const preferredTournamentId =
          getInitialTournamentId()
          ?? setupStates[0]?.tournament_id
          ?? null;

        if (!preferredTournamentId) {
          return;
        }

        const state = await loadOrganizerSetupState(token, preferredTournamentId);
        if (!state || cancelled) {
          return;
        }

        const hydratedDraft = normalizeOrganizerDraft({
          tournamentId: state.tournament_id,
          payload: state.payload,
        });
        applyDraft(hydratedDraft);
        setIsSetupPublished(Boolean(state.is_published));

        const selectedTournament = tournaments.find((entry) => entry.id === state.tournament_id);
        if (selectedTournament?.logo_file_name) {
          setDetails((prev) => ({ ...prev, logoFileName: selectedTournament.logo_file_name || '' }));
        }

        if (selectedTournament?.has_logo) {
          const previewUrl = await fetchTournamentLogoBlobUrl(token, state.tournament_id);
          if (!cancelled) {
            setPreviewUrl(previewUrl);
          }
        } else {
          setPreviewUrl(null);
        }

        if (!cancelled) {
          setAutosaveEnabled(true);
          setAutosaveError(null);
          autosaveFingerprintRef.current = null;
        }
      } catch {
        // Keep local draft when remote setup cannot be loaded.
      } finally {
        finishHydration();
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const draft: OrganizerDraft = {
      version: DRAFT_VERSION,
      tournamentId: persistedTournamentId,
      details,
      events,
      divisions,
      squads,
      fees,
      locations,
      questions,
      fields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
    };

    localStorage.setItem(getDraftStorageKey(), JSON.stringify(draft));
    localStorage.setItem('tc_active_tournament_name', details.name || '');
    window.dispatchEvent(new Event('storage'));
  }, [details, events, divisions, squads, fees, locations, questions, fields, hasRulesDocument, paymentMode, paymentProcessorConnected, paymentPayoutConfigured, persistedTournamentId]);

  useEffect(() => {
    if (!autosaveEnabled || !persistedTournamentId || isSavingDraft || isPublishing) {
      return;
    }

    if (autosaveFingerprintRef.current === autosaveFingerprint) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (autosaveInFlightRef.current) {
        return;
      }

      const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
      if (!token) {
        setAutosaveError('Autosave paused: session expired.');
        return;
      }

      const nextFingerprint = autosaveFingerprint;

      void (async () => {
        autosaveInFlightRef.current = true;
        setIsAutosaving(true);
        setAutosaveError(null);

        try {
          const payload = buildTournamentPayload(details, squads, details.visibility !== 'private');
          const saved = await saveTournamentRecord({
            token,
            payload,
            tournamentId: persistedTournamentId,
          });

          if (pendingLogoFile) {
            const logoResult = await uploadTournamentLogo({
              token,
              tournamentId: saved.id,
              file: pendingLogoFile,
            });
            setDetails((prev) => ({
              ...prev,
              logoFileName: logoResult.logo_file_name || prev.logoFileName,
            }));
            setPendingLogoFile(null);
          }

          const organizerPayload = buildOrganizerSetupPayload({
            details,
            events,
            divisions,
            squads,
            fees,
            locations,
            questions,
            fields,
            hasRulesDocument,
            paymentMode,
            paymentProcessorConnected,
            paymentPayoutConfigured,
          });

          await saveOrganizerSetupState({
            token,
            tournamentId: saved.id,
            payload: organizerPayload,
            isPublished: isSetupPublished,
          });

          setPersistedTournamentId(saved.id);
          autosaveFingerprintRef.current = nextFingerprint;
          setAutosaveSavedAt(new Date().toISOString());
        } catch (error) {
          setAutosaveError(error instanceof Error ? error.message : 'Autosave failed.');
        } finally {
          setIsAutosaving(false);
          autosaveInFlightRef.current = false;
        }
      })();
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    autosaveEnabled,
    autosaveFingerprint,
    details,
    divisions,
    events,
    fees,
    fields,
    hasRulesDocument,
    isPublishing,
    isSavingDraft,
    locations,
    paymentMode,
    paymentPayoutConfigured,
    paymentProcessorConnected,
    pendingLogoFile,
    persistedTournamentId,
    questions,
    squads,
    isSetupPublished,
  ]);

  const handleOpenTournamentModal = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setIsTournamentModalOpen(true);
    setSaveError(null);
    try {
      await refreshTournamentLibrary(token);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to load tournaments.');
    }
  };

  const handleLoadExistingTournament = async (tournamentId: number) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setSaveError(null);
    setLoadingTournamentId(tournamentId);

    try {
      const state = await loadOrganizerSetupState(token, tournamentId);
      const selectedTournament = userTournaments.find((entry) => entry.id === tournamentId) ?? null;
      if (state) {
        const hydratedDraft = normalizeOrganizerDraft({
          tournamentId: state.tournament_id,
          payload: state.payload,
        });
        applyDraft(hydratedDraft);
        setIsSetupPublished(Boolean(state.is_published));
        if (selectedTournament?.logo_file_name) {
          setDetails((prev) => ({ ...prev, logoFileName: selectedTournament.logo_file_name || '' }));
        }
      } else {
        const tournament = selectedTournament;
        if (!tournament) {
          throw new Error('Tournament was not found.');
        }

        applyDraft(toDraftFromTournament(tournament));
        setIsSetupPublished(false);
      }

      if (selectedTournament?.has_logo) {
        const previewUrl = await fetchTournamentLogoBlobUrl(token, tournamentId);
        setPreviewUrl(previewUrl);
      } else {
        setPreviewUrl(null);
      }

      setAutosaveError(null);
      setAutosaveEnabled(true);
      setAutosaveSavedAt(null);
      autosaveFingerprintRef.current = null;
      setActiveSection('tournament-details');
      setIsTournamentModalOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to load selected tournament.');
    } finally {
      setLoadingTournamentId(null);
    }
  };

  const handleDeleteTournament = async (tournamentId: number) => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    const shouldDelete = window.confirm('Delete this tournament? This action cannot be undone.');
    if (!shouldDelete) {
      return;
    }

    setSaveError(null);
    setDeletingTournamentId(tournamentId);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      const csrfToken = getCsrfTokenFromCookie();
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      const responseData = await response.json().catch(() => null) as { detail?: string } | null;
      if (!response.ok) {
        const detail = responseData && typeof responseData.detail === 'string'
          ? responseData.detail
          : `Failed to delete tournament (${response.status})`;
        throw new Error(detail);
      }

      if (persistedTournamentId === tournamentId) {
        applyDraft(buildDefaultDraft());
        setIsSetupPublished(false);
        setPreviewUrl(null);
      }

      await refreshTournamentLibrary(token);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to delete tournament.');
    } finally {
      setDeletingTournamentId(null);
    }
  };

  const validationIssues = useMemo<ValidationIssue[]>(() => {
    const issues: ValidationIssue[] = [];

    const detailsName = details.name.trim();
    const detailsSupportEmail = details.supportEmail.trim();
    const detailsCenter = details.bowlingCenter.trim();
    const enabledEvents = events.filter((event) => event.enabled);
    const visibleFields = fields.filter((field) => field.mode !== 'dont-ask');
    const firstNameField = fields.find((field) => field.key === 'first_name');
    const lastNameField = fields.find((field) => field.key === 'last_name');
    const optionQuestionTypes = new Set<CustomQuestionConfig['type']>(['dropdown', 'multiple-choice', 'checkbox']);
    const eventIds = new Set(events.map((event) => event.id));
    const divisionIds = new Set(divisions.map((division) => division.id));
    const squadIds = new Set(squads.map((squad) => squad.id));

    if (!detailsName) {
      issues.push({
        id: 'details-name-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Tournament name is required.',
      });
    }

    if (!detailsCenter) {
      issues.push({
        id: 'details-center-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Bowling center is required.',
      });
    }

    if (!detailsSupportEmail) {
      issues.push({
        id: 'details-support-email-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Support email is required.',
      });
    }

    if (!details.startDateIso || !details.endDateIso) {
      issues.push({
        id: 'details-tournament-dates-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Tournament start and end dates are required.',
      });
    } else if (details.startDateIso > details.endDateIso) {
      issues.push({
        id: 'details-tournament-dates-invalid',
        section: 'tournament-details',
        severity: 'error',
        message: 'Tournament end date must be on or after the start date.',
      });
    }

    if (!details.registrationOpenIso || !details.registrationCloseIso) {
      issues.push({
        id: 'details-registration-dates-missing',
        section: 'tournament-details',
        severity: 'error',
        message: 'Registration open and close dates are required.',
      });
    } else {
      if (details.registrationOpenIso > details.registrationCloseIso) {
        issues.push({
          id: 'details-registration-window-invalid',
          section: 'tournament-details',
          severity: 'error',
          message: 'Registration close date must be on or after the open date.',
        });
      }

      if (details.startDateIso && details.registrationCloseIso > details.startDateIso) {
        issues.push({
          id: 'details-registration-after-start',
          section: 'tournament-details',
          severity: 'warning',
          message: 'Registration currently closes after tournament start date.',
        });
      }
    }

    if (enabledEvents.length === 0) {
      issues.push({
        id: 'events-none-enabled',
        section: 'events-divisions',
        severity: 'error',
        message: 'Enable at least one event before publishing.',
      });
    }

    for (const event of enabledEvents) {
      if (!event.name.trim()) {
        issues.push({
          id: `event-name-missing-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: 'All enabled events need a name.',
        });
      }

      if (event.requireSquad && event.connectedSquadIds.length === 0) {
        issues.push({
          id: `event-squad-required-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An enabled event'} requires squad selection but has no squads assigned.`,
        });
      }

      if (event.requireDivision && event.connectedDivisionIds.length === 0) {
        issues.push({
          id: `event-division-required-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An enabled event'} requires division selection but has no divisions assigned.`,
        });
      }

      if (event.minPlayers < 1 || event.maxPlayers < 1 || event.maxPlayers < event.minPlayers) {
        issues.push({
          id: `event-player-count-invalid-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An enabled event'} has an invalid required bowler count.`,
        });
      }
    }

    if (squads.length === 0) {
      issues.push({
        id: 'squads-none-configured',
        section: 'squads-availability',
        severity: 'error',
        message: 'Add at least one squad before publishing.',
      });
    }

    for (const squad of squads) {
      if (!squad.dateIso || !squad.startTime) {
        issues.push({
          id: `squad-datetime-missing-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} is missing date or start time.`,
        });
      }

      if (!Number.isFinite(squad.requiredBowlerCount) || squad.requiredBowlerCount < 1) {
        issues.push({
          id: `squad-bowler-count-invalid-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} must require at least one bowler.`,
        });
      }

      if (squad.eventIds.length === 0) {
        issues.push({
          id: `squad-events-missing-${squad.id}`,
          section: 'squads-availability',
          severity: 'warning',
          message: `${squad.name || 'A squad'} is not assigned to any events.`,
        });
      }
    }

    if (visibleFields.length === 0) {
      issues.push({
        id: 'registration-fields-none-visible',
        section: 'registration-setup',
        severity: 'error',
        message: 'At least one registration field must be visible.',
      });
    }

    if (!firstNameField || firstNameField.mode !== 'required') {
      issues.push({
        id: 'registration-first-name-required',
        section: 'registration-setup',
        severity: 'error',
        message: 'First name must be required for registration.',
      });
    }

    if (!lastNameField || lastNameField.mode !== 'required') {
      issues.push({
        id: 'registration-last-name-required',
        section: 'registration-setup',
        severity: 'error',
        message: 'Last name must be required for registration.',
      });
    }

    for (const question of questions.filter((entry) => entry.enabled)) {
      if (!question.label.trim()) {
        issues.push({
          id: `question-label-missing-${question.id}`,
          section: 'registration-setup',
          severity: 'error',
          message: 'Enabled custom questions need a prompt.',
        });
      }

      if (optionQuestionTypes.has(question.type) && question.options.length === 0) {
        issues.push({
          id: `question-options-missing-${question.id}`,
          section: 'registration-setup',
          severity: 'error',
          message: `${question.label || 'An enabled question'} needs at least one option.`,
        });
      }
    }

    for (const event of events) {
      const hasMissingDivisionRef = event.connectedDivisionIds.some((divisionId) => !divisionIds.has(divisionId));
      if (hasMissingDivisionRef) {
        issues.push({
          id: `event-division-reference-invalid-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An event'} references one or more deleted divisions.`,
        });
      }

      const hasMissingSquadRef = event.connectedSquadIds.some((squadId) => !squadIds.has(squadId));
      if (hasMissingSquadRef) {
        issues.push({
          id: `event-squad-reference-invalid-${event.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${event.name || 'An event'} references one or more deleted squads.`,
        });
      }
    }

    for (const division of divisions) {
      const hasMissingEventRef = division.eventIds.some((eventId) => !eventIds.has(eventId));
      if (hasMissingEventRef) {
        issues.push({
          id: `division-event-reference-invalid-${division.id}`,
          section: 'events-divisions',
          severity: 'error',
          message: `${division.name || 'A division'} references one or more deleted events.`,
        });
      }
    }

    for (const squad of squads) {
      const hasMissingEventRef = squad.eventIds.some((eventId) => !eventIds.has(eventId));
      if (hasMissingEventRef) {
        issues.push({
          id: `squad-event-reference-invalid-${squad.id}`,
          section: 'squads-availability',
          severity: 'error',
          message: `${squad.name || 'A squad'} references one or more deleted events.`,
        });
      }
    }

    for (const fee of fees) {
      const hasMissingEventRef = fee.eventIds.some((eventId) => !eventIds.has(eventId));
      const hasMissingDivisionRef = fee.divisionIds.some((divisionId) => !divisionIds.has(divisionId));
      const hasMissingSquadRef = fee.squadIds.some((squadId) => !squadIds.has(squadId));
      if (hasMissingEventRef || hasMissingDivisionRef || hasMissingSquadRef) {
        issues.push({
          id: `fee-reference-invalid-${fee.id}`,
          section: 'fees-payments-documents',
          severity: 'error',
          message: `${fee.name || 'An add-on fee'} references deleted events, divisions, or squads.`,
        });
      }
    }

    for (const question of questions) {
      const hasMissingEventRef = question.scope.eventIds.some((eventId) => !eventIds.has(eventId));
      const hasMissingDivisionRef = question.scope.divisionIds.some((divisionId) => !divisionIds.has(divisionId));
      const hasMissingSquadRef = question.scope.squadIds.some((squadId) => !squadIds.has(squadId));
      if (hasMissingEventRef || hasMissingDivisionRef || hasMissingSquadRef) {
        issues.push({
          id: `question-reference-invalid-${question.id}`,
          section: 'registration-setup',
          severity: 'error',
          message: `${question.label || 'A custom question'} references deleted events, divisions, or squads.`,
        });
      }
    }

    if (!hasRulesDocument) {
      issues.push({
        id: 'rules-missing',
        section: 'fees-payments-documents',
        severity: 'warning',
        message: 'No rules document uploaded yet.',
      });
    }

    // Cash-only mode is active for this release; online processor checks come later.

    return issues;
  }, [hasRulesDocument]);

  const handleSaveDraft = async () => {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setSaveError(null);
    setIsSavingDraft(true);

    try {
      const payload = buildTournamentPayload(details, squads, details.visibility !== 'private');
      const saved = await saveTournamentRecord({
        token,
        payload,
        tournamentId: persistedTournamentId,
      });

      if (pendingLogoFile) {
        const logoResult = await uploadTournamentLogo({
          token,
          tournamentId: saved.id,
          file: pendingLogoFile,
        });
        setDetails((prev) => ({
          ...prev,
          logoFileName: logoResult.logo_file_name || prev.logoFileName,
        }));
        setPendingLogoFile(null);
      }

      const organizerPayload = buildOrganizerSetupPayload({
        details,
        events,
        divisions,
        squads,
        fees,
        locations,
        questions,
        fields,
        hasRulesDocument,
        paymentMode,
        paymentProcessorConnected,
        paymentPayoutConfigured,
      });
      await saveOrganizerSetupState({
        token,
        tournamentId: saved.id,
        payload: organizerPayload,
        isPublished: isSetupPublished,
      });

      await refreshTournamentLibrary(token);

      setPersistedTournamentId(saved.id);
      setDraftSavedAt(new Date().toISOString());
      setAutosaveError(null);
      setAutosaveEnabled(true);
      setAutosaveSavedAt(new Date().toISOString());
      autosaveFingerprintRef.current = null;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save tournament draft.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    if (validationIssues.some((issue) => issue.severity === 'error')) {
      setActiveSection('review-publish');
      return;
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setSaveError('Your session expired. Please sign in again.');
      router.replace('/login?expired=true');
      return;
    }

    setSaveError(null);
    setIsPublishing(true);

    try {
      const payload = buildTournamentPayload(details, squads, details.visibility !== 'private');
      const saved = await saveTournamentRecord({
        token,
        payload,
        tournamentId: persistedTournamentId,
      });

      if (pendingLogoFile) {
        const logoResult = await uploadTournamentLogo({
          token,
          tournamentId: saved.id,
          file: pendingLogoFile,
        });
        setDetails((prev) => ({
          ...prev,
          logoFileName: logoResult.logo_file_name || prev.logoFileName,
        }));
        setPendingLogoFile(null);
      }

      const organizerPayload = buildOrganizerSetupPayload({
        details,
        events,
        divisions,
        squads,
        fees,
        locations,
        questions,
        fields,
        hasRulesDocument,
        paymentMode,
        paymentProcessorConnected,
        paymentPayoutConfigured,
      });
      await saveOrganizerSetupState({
        token,
        tournamentId: saved.id,
        payload: organizerPayload,
        isPublished: true,
      });

      await refreshTournamentLibrary(token);

      setPersistedTournamentId(saved.id);
      setPublishedAt(new Date().toISOString());
      setIsSetupPublished(true);
      setDetails((prev) => ({ ...prev, tournamentStatus: 'active' }));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to publish tournament.');
      setActiveSection('review-publish');
    } finally {
      setIsPublishing(false);
    }
  };

  const statusBySection = useMemo<Record<SetupSectionKey, SetupStatus>>(() => {
    const hasError = (section: SetupSectionKey) => validationIssues.some((issue) => issue.section === section && issue.severity === 'error');
    const hasWarning = (section: SetupSectionKey) => validationIssues.some((issue) => issue.section === section && issue.severity === 'warning');

    const sectionStatus = (section: SetupSectionKey): SetupStatus => {
      if (hasError(section)) {
        return 'needs-attention';
      }
      if (hasWarning(section)) {
        return 'incomplete';
      }
      return 'complete';
    };

    return {
      'tournament-details': sectionStatus('tournament-details'),
      'events-divisions': sectionStatus('events-divisions'),
      'squads-availability': sectionStatus('squads-availability'),
      'registration-setup': sectionStatus('registration-setup'),
      'fees-payments-documents': sectionStatus('fees-payments-documents'),
      'review-publish': validationIssues.some((issue) => issue.severity === 'error')
        ? 'needs-attention'
        : validationIssues.length > 0
          ? 'incomplete'
          : 'complete',
    };
  }, [validationIssues]);

  const enabledEvents = useMemo(
    () => events.filter((event) => event.enabled),
    [events],
  );
  const baseEntryTotalCents = useMemo(
    () => enabledEvents.reduce((sum, event) => sum + Math.max(event.entryFeeCents, 0), 0),
    [enabledEvents],
  );
  const addOnFees = useMemo(
    () => fees.filter((fee) => fee.enabled && !fee.required),
    [fees],
  );
  const addOnsTotalCents = useMemo(
    () => addOnFees.reduce((sum, fee) => sum + Math.max(fee.amountCents, 0), 0),
    [addOnFees],
  );

  const paymentModeLabel = 'Cash Only';
  const paymentModeReady = true;

  const completion = useMemo(() => {
    const statuses = setupSections.map((section) => statusBySection[section.key]);
    const completeCount = statuses.filter((entry) => entry === 'complete').length;
    return Math.round((completeCount / statuses.length) * 100);
  }, [statusBySection]);

  const supportEmailLooksValid = useMemo(() => {
    const value = details.supportEmail.trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }, [details.supportEmail]);

  const hasTournamentDateRange = Boolean(details.startDateIso && details.endDateIso);
  const hasRegistrationWindow = Boolean(details.registrationOpenIso && details.registrationCloseIso);
  const tournamentDateOrderInvalid = hasTournamentDateRange && details.startDateIso > details.endDateIso;
  const registrationDateOrderInvalid = hasRegistrationWindow && details.registrationOpenIso > details.registrationCloseIso;
  const registrationAfterStartWarning = hasRegistrationWindow
    && Boolean(details.startDateIso)
    && details.registrationCloseIso > details.startDateIso;

  const visibilitySummary = details.visibility === 'public'
    ? 'Listed in directory and visible to everyone.'
    : details.visibility === 'unlisted'
      ? 'Only visible to users with a direct link.'
      : 'Hidden from public directory and invite-only.';

  const timelineWarnings = [
    tournamentDateOrderInvalid ? 'Tournament end date is before start date.' : null,
    registrationDateOrderInvalid ? 'Registration close date is before open date.' : null,
    registrationAfterStartWarning ? 'Registration currently closes after tournament start.' : null,
  ].filter((entry): entry is string => Boolean(entry));

  const timelineWarningEntries = timelineWarnings.map((message, index) => ({
    id: `timeline-warning-${index}`,
    section: 'tournament-details' as const,
    severity: 'warning' as const,
    message,
  }));

  const timelineWarningActions = [
    tournamentDateOrderInvalid ? {
      id: 'set-end-date-to-start',
      label: 'Set end date to start date',
      onClick: () => setDetails((prev) => ({ ...prev, endDateIso: prev.startDateIso })),
    } : null,
    registrationDateOrderInvalid ? {
      id: 'set-close-date-to-open',
      label: 'Set close date to open date',
      onClick: () => setDetails((prev) => ({ ...prev, registrationCloseIso: prev.registrationOpenIso })),
    } : null,
    !registrationDateOrderInvalid && registrationAfterStartWarning ? {
      id: 'align-close-with-start',
      label: 'Align close with start date',
      onClick: () => setDetails((prev) => ({ ...prev, registrationCloseIso: prev.startDateIso })),
    } : null,
  ].filter((entry): entry is { id: string; label: string; onClick: () => void } => Boolean(entry));

  const recommendedTournamentStatus = useMemo(() => {
    return recommendTournamentStatus({
      details,
      isTournamentDetailsComplete: statusBySection['tournament-details'] === 'complete',
    });
  }, [
    details,
    statusBySection,
  ]);

  const activeEvent = drawerState?.kind === 'event'
    ? events.find((entry) => entry.id === drawerState.id) ?? emptyEvent(events.length + 1)
    : null;

  const activeDivision = drawerState?.kind === 'division'
    ? divisions.find((entry) => entry.id === drawerState.id) ?? emptyDivision()
    : null;

  const activeSquad = drawerState?.kind === 'squad'
    ? squads.find((entry) => entry.id === drawerState.id) ?? emptySquad()
    : null;

  const activeQuestion = drawerState?.kind === 'question'
    ? questions.find((entry) => entry.id === drawerState.id) ?? emptyQuestion(questions.length + 1)
    : null;

  const activeField = drawerState?.kind === 'field'
    ? fields.find((entry) => entry.id === drawerState.id) ?? null
    : null;

  const activeFee = drawerState?.kind === 'fee'
    ? fees.find((entry) => entry.id === drawerState.id) ?? emptyFee(fees.length + 1)
    : null;

  const activeLocation = drawerState?.kind === 'location'
    ? locations.find((entry) => entry.id === drawerState.id) ?? emptyLocation()
    : null;

  const autosaveStatusLabel = !autosaveEnabled
    ? 'Autosave off'
    : isAutosaving
      ? 'Autosaving...'
      : autosaveSavedAt
        ? `Autosaved ${new Date(autosaveSavedAt).toLocaleTimeString()}`
        : 'Autosave on';

  const sortedSquads = useMemo(() => {
    return [...squads].sort((a, b) => {
      const byDate = a.dateIso.localeCompare(b.dateIso);
      if (byDate !== 0) {
        return byDate;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [squads]);

  const groupsByDate = useMemo(() => {
    const groups = new Map<string, SquadConfig[]>();
    for (const squad of sortedSquads) {
      const list = groups.get(squad.dateIso) ?? [];
      list.push(squad);
      groups.set(squad.dateIso, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sortedSquads]);

  const squadGroups = useMemo(() => {
    if (squadViewMode === 'squad') {
      return [{
        key: 'all-squads',
        label: 'All Squads',
        squads: sortedSquads,
      }];
    }

    return groupsByDate.map(([dateIso, dateSquads]) => ({
      key: dateIso,
      label: formatDateLabel(dateIso),
      squads: dateSquads,
    }));
  }, [groupsByDate, sortedSquads, squadViewMode]);

  const totalSquadCapacity = useMemo(
    () => squads.reduce((sum, squad) => sum + Math.max(squad.capacity, 0), 0),
    [squads],
  );

  const totalRegisteredSpots = useMemo(
    () => squads.reduce((sum, squad) => sum + Math.max(squad.registeredCount, 0), 0),
    [squads],
  );

  const waitlistEnabledCount = useMemo(
    () => squads.filter((squad) => squad.waitlistEnabled).length,
    [squads],
  );

  const eventCoverage = useMemo(() => {
    return events
      .filter((event) => event.enabled)
      .map((event) => ({
        id: event.id,
        name: event.name || 'Untitled Event',
        squadCount: squads.filter((squad) => squad.eventIds.includes(event.id)).length,
      }))
      .sort((a, b) => b.squadCount - a.squadCount || a.name.localeCompare(b.name));
  }, [events, squads]);

  const eventCoverageColors = ['#f97316', '#3b82f6', '#22c55e', '#a855f7', '#eab308'];
  const eventCoverageColorById = useMemo(
    () => Object.fromEntries(eventCoverage.map((entry, index) => [entry.id, eventCoverageColors[index % eventCoverageColors.length]])),
    [eventCoverage],
  );
  const totalEventCoverage = useMemo(
    () => eventCoverage.reduce((sum, entry) => sum + entry.squadCount, 0),
    [eventCoverage],
  );
  const eventCoverageRingStyle = useMemo(() => {
    if (totalEventCoverage <= 0) {
      return { background: 'conic-gradient(#2b3343 0deg 360deg)' };
    }

    let angle = 0;
    const segments = eventCoverage.map((entry, index) => {
      const segmentAngle = (entry.squadCount / totalEventCoverage) * 360;
      const start = angle;
      angle += segmentAngle;
      const color = eventCoverageColors[index % eventCoverageColors.length];
      return `${color} ${start}deg ${angle}deg`;
    });

    return { background: `conic-gradient(${segments.join(', ')})` };
  }, [eventCoverage, totalEventCoverage]);

  const fillPercent = totalSquadCapacity > 0
    ? Math.min(Math.round((totalRegisteredSpots / totalSquadCapacity) * 100), 100)
    : 0;
  const fillGaugeStyle = {
    background: `conic-gradient(#22c55e ${fillPercent * 3.6}deg, color-mix(in srgb, var(--bw-border-subtle) 75%, transparent) 0deg 360deg)`,
  };

  const eventNameById = useMemo(
    () => Object.fromEntries(events.map((event) => [event.id, event.name || 'Untitled Event'])),
    [events],
  );

  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.displayOrder - b.displayOrder), [fields]);
  const askedFields = useMemo(() => sortedFields.filter((field) => field.mode !== 'dont-ask'), [sortedFields]);
  const hiddenFields = useMemo(() => sortedFields.filter((field) => field.mode === 'dont-ask'), [sortedFields]);

  const sortedQuestions = useMemo(() => [...questions].sort((a, b) => a.displayOrder - b.displayOrder), [questions]);
  const enabledQuestions = useMemo(() => sortedQuestions.filter((question) => question.enabled), [sortedQuestions]);
  const disabledQuestions = useMemo(() => sortedQuestions.filter((question) => !question.enabled), [sortedQuestions]);

  const enabledDivisions = useMemo(
    () => divisions.filter((division) => division.enabled),
    [divisions],
  );

  const enabledSquads = useMemo(
    () => sortedSquads,
    [sortedSquads],
  );

  const eventsForSelectedPreviewSquad = useMemo(() => {
    if (!signupPreviewForm.squadId) {
      return enabledEvents;
    }

    const linked = enabledEvents.filter((event) => {
      const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];
      return connectedSquadIds.length === 0 || connectedSquadIds.includes(signupPreviewForm.squadId);
    });

    return linked.length > 0 ? linked : enabledEvents;
  }, [enabledEvents, signupPreviewForm.squadId]);

  const selectedPreviewSquad = useMemo(
    () => enabledSquads.find((squad) => squad.id === signupPreviewForm.squadId) ?? null,
    [enabledSquads, signupPreviewForm.squadId],
  );

  const selectedPreviewEvent = useMemo(
    () => enabledEvents.find((event) => event.id === signupPreviewForm.eventId) ?? eventsForSelectedPreviewSquad[0] ?? null,
    [enabledEvents, eventsForSelectedPreviewSquad, signupPreviewForm.eventId],
  );

  const requiredPreviewBowlerCount = useMemo(
    () => getRequiredBowlerCountFromSquad(selectedPreviewSquad) ?? getRequiredBowlerCountFromEvent(selectedPreviewEvent),
    [selectedPreviewEvent, selectedPreviewSquad],
  );

  useEffect(() => {
    setSignupPreviewForm((prev) => {
      const next = { ...prev };

      if (!next.squadId && enabledSquads.length > 0) {
        next.squadId = enabledSquads[0].id;
      }

      const squadLinkedEvents = enabledEvents.filter((event) => {
        const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];
        return connectedSquadIds.length === 0 || connectedSquadIds.includes(next.squadId);
      });

      const allowedEvents = squadLinkedEvents.length > 0 ? squadLinkedEvents : enabledEvents;
      if (!next.eventId || !allowedEvents.some((event) => event.id === next.eventId)) {
        next.eventId = allowedEvents[0]?.id ?? '';
      }

      if (!next.divisionId && enabledDivisions.length > 0) {
        next.divisionId = enabledDivisions[0].id;
      }

      if (next.divisionId && !enabledDivisions.some((division) => division.id === next.divisionId)) {
        next.divisionId = enabledDivisions[0]?.id ?? '';
      }

      const selectedSquad = enabledSquads.find((squad) => squad.id === next.squadId) ?? null;
      const selectedEvent = enabledEvents.find((event) => event.id === next.eventId) ?? null;
      const requiredCount = getRequiredBowlerCountFromSquad(selectedSquad) ?? getRequiredBowlerCountFromEvent(selectedEvent);

      if (next.bowlers.length !== requiredCount) {
        const nextBowlers = Array.from({ length: requiredCount }, (_, index) => next.bowlers[index] ?? {});
        const nextAnswers = Array.from({ length: requiredCount }, (_, index) => next.bowlerQuestionAnswers[index] ?? {});
        next.bowlers = nextBowlers;
        next.bowlerQuestionAnswers = nextAnswers;
      }

      return next;
    });
  }, [enabledDivisions, enabledEvents, enabledSquads]);

  const handleSignupPreviewSubmit = async () => {
    if (!signupPreviewForm.squadId) {
      setSignupPreviewSubmitMessage('Please select a squad first.');
      return;
    }

    if (signupPreviewForm.bowlers.length !== requiredPreviewBowlerCount) {
      setSignupPreviewSubmitMessage(`This squad requires ${requiredPreviewBowlerCount} bowler form${requiredPreviewBowlerCount === 1 ? '' : 's'}.`);
      return;
    }

    let missingFieldLabel = '';
    let missingFieldBowlerIndex = -1;
    signupPreviewForm.bowlers.some((bowlerFields, bowlerIndex) => {
      const missingRequiredField = askedFields.filter((field) => field.mode === 'required').find((field) => {
        const key = normalizeRegistrationFieldKey(field.key);
        const value = bowlerFields?.[key];
        return typeof value !== 'string' || value.trim().length === 0;
      });

      if (missingRequiredField) {
        missingFieldLabel = missingRequiredField.customLabel || missingRequiredField.label || 'Required field';
        missingFieldBowlerIndex = bowlerIndex;
        return true;
      }

      return false;
    });

    if (missingFieldBowlerIndex >= 0) {
      setSignupPreviewSubmitMessage(`Bowler ${missingFieldBowlerIndex + 1}: ${missingFieldLabel} is required.`);
      return;
    }

    if (!signupPreviewForm.acceptTerms) {
      setSignupPreviewSubmitMessage('Please accept the tournament terms before continuing.');
      return;
    }

    let missingQuestionLabel = '';
    let missingQuestionBowlerIndex = -1;
    enabledQuestions.filter((question) => question.required).some((question) => {
      return signupPreviewForm.bowlerQuestionAnswers.some((answersForBowler, bowlerIndex) => {
        const hasAnswer = isRegistrationQuestionAnswered(question, answersForBowler?.[question.id]);
        if (!hasAnswer) {
          missingQuestionLabel = question.label || 'Required question';
          missingQuestionBowlerIndex = bowlerIndex;
          return true;
        }

        return false;
      });
    });

    if (missingQuestionBowlerIndex >= 0) {
      setSignupPreviewSubmitMessage(`Bowler ${missingQuestionBowlerIndex + 1}: ${missingQuestionLabel} is required.`);
      return;
    }

    setIsSubmittingSignupPreview(true);
    setSignupPreviewSubmitMessage(null);

    try {
      await Promise.resolve();
      setSignupPreviewSubmitMessage('Preview looks good. This is the same public-facing signup experience bowlers will use.');
    } catch (error) {
      setSignupPreviewSubmitMessage(error instanceof Error ? error.message : 'Unable to submit registration preview.');
    } finally {
      setIsSubmittingSignupPreview(false);
    }
  };

  const handleSaveEvent = (nextEvent: EventConfig) => {
    const normalizedEvent = normalizeEventConfig(nextEvent);
    const exists = events.some((entry) => entry.id === normalizedEvent.id);
    const nextEvents = exists
      ? events.map((entry) => (entry.id === normalizedEvent.id ? normalizedEvent : entry))
      : [...events, normalizedEvent].sort((a, b) => a.displayOrder - b.displayOrder);
    setEvents(nextEvents);
    setDrawerState(null);
    void persistOrganizerChanges({ events: nextEvents });
  };

  const persistOrganizerChanges = async (overrides: {
    events?: EventConfig[];
    divisions?: DivisionConfig[];
    squads?: SquadConfig[];
    fees?: FeeConfig[];
    locations?: LocationConfig[];
    questions?: CustomQuestionConfig[];
    fields?: RegistrationFieldConfig[];
  }) => {
    if (!persistedTournamentId || autosaveInFlightRef.current || isSavingDraft || isPublishing) {
      return;
    }

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      setAutosaveError('Autosave paused: session expired.');
      return;
    }

    const nextEvents = overrides.events ?? events;
    const nextDivisions = overrides.divisions ?? divisions;
    const nextSquads = overrides.squads ?? squads;
    const nextFees = overrides.fees ?? fees;
    const nextLocations = overrides.locations ?? locations;
    const nextQuestions = overrides.questions ?? questions;
    const nextFields = overrides.fields ?? fields;

    const nextFingerprint = JSON.stringify({
      tournamentId: persistedTournamentId,
      details,
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
      fees: nextFees,
      locations: nextLocations,
      questions: nextQuestions,
      fields: nextFields,
      hasRulesDocument,
      paymentMode,
      paymentProcessorConnected,
      paymentPayoutConfigured,
      pendingLogoFile: pendingLogoFile
        ? {
            name: pendingLogoFile.name,
            size: pendingLogoFile.size,
            lastModified: pendingLogoFile.lastModified,
            type: pendingLogoFile.type,
          }
        : null,
    });

    autosaveInFlightRef.current = true;
    setIsAutosaving(true);
    setAutosaveError(null);

    try {
      const organizerPayload = buildOrganizerSetupPayload({
        details,
        events: nextEvents,
        divisions: nextDivisions,
        squads: nextSquads,
        fees: nextFees,
        locations: nextLocations,
        questions: nextQuestions,
        fields: nextFields,
        hasRulesDocument,
        paymentMode,
        paymentProcessorConnected,
        paymentPayoutConfigured,
      });

      await saveOrganizerSetupState({
        token,
        tournamentId: persistedTournamentId,
        payload: organizerPayload,
        isPublished: isSetupPublished,
      });

      await refreshTournamentLibrary(token);
      autosaveFingerprintRef.current = nextFingerprint;
      setAutosaveEnabled(true);
      setAutosaveSavedAt(new Date().toISOString());
      router.refresh();
    } catch (error) {
      setAutosaveError(error instanceof Error ? error.message : 'Autosave failed.');
    } finally {
      setIsAutosaving(false);
      autosaveInFlightRef.current = false;
    }
  };

  const handleDuplicateEvent = (eventId: string) => {
    const sourceEvent = events.find((entry) => entry.id === eventId);
    if (!sourceEvent) {
      return;
    }

    const duplicatedEvent = normalizeEventConfig({
      ...sourceEvent,
      id: buildClientId('ev'),
      name: buildDuplicateName(sourceEvent.name, 'Untitled Event'),
      displayOrder: events.length + 1,
    });

    const nextEvents = [...events, duplicatedEvent].sort((a, b) => a.displayOrder - b.displayOrder);
    const nextDivisions = divisions.map((entry) => (
      sourceEvent.connectedDivisionIds.includes(entry.id)
        ? { ...entry, eventIds: entry.eventIds.includes(duplicatedEvent.id) ? entry.eventIds : [...entry.eventIds, duplicatedEvent.id] }
        : entry
    ));
    const nextSquads = squads.map((entry) => (
      sourceEvent.connectedSquadIds.includes(entry.id)
        ? { ...entry, eventIds: entry.eventIds.includes(duplicatedEvent.id) ? entry.eventIds : [...entry.eventIds, duplicatedEvent.id] }
        : entry
    ));

    setEvents(nextEvents);
    setDivisions(nextDivisions);
    setSquads(nextSquads);
    setSelectedEventId(duplicatedEvent.id);
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this event?')) {
      return;
    }

    const nextEvents = events.filter((entry) => entry.id !== eventId);
    const nextDivisions = divisions.map((entry) => ({
      ...entry,
      eventIds: entry.eventIds.filter((id) => id !== eventId),
    }));
    const nextSquads = squads.map((entry) => ({
      ...entry,
      eventIds: entry.eventIds.filter((id) => id !== eventId),
    }));
    const nextFees = fees.map((entry) => ({
      ...entry,
      eventIds: entry.eventIds.filter((id) => id !== eventId),
    }));
    const nextQuestions = questions.map((entry) => ({
      ...entry,
      scope: {
        ...entry.scope,
        eventIds: entry.scope.eventIds.filter((id) => id !== eventId),
      },
    }));

    setEvents(nextEvents);
    setDivisions(nextDivisions);
    setSquads(nextSquads);
    setFees(nextFees);
    setQuestions(nextQuestions);
    setSelectedEventId((prev) => (prev === eventId ? null : prev));
    setDrawerState((prev) => (prev?.kind === 'event' && prev.id === eventId ? null : prev));
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      squads: nextSquads,
      fees: nextFees,
      questions: nextQuestions,
    });
  };

  const handleSaveDivision = (nextDivision: DivisionConfig) => {
    const exists = divisions.some((entry) => entry.id === nextDivision.id);
    const nextDivisions = exists
      ? divisions.map((entry) => (entry.id === nextDivision.id ? nextDivision : entry))
      : [...divisions, nextDivision];
    setDivisions(nextDivisions);
    setDrawerState(null);
    void persistOrganizerChanges({ divisions: nextDivisions });
  };

  const handleDuplicateDivision = (divisionId: string) => {
    const sourceDivision = divisions.find((entry) => entry.id === divisionId);
    if (!sourceDivision) {
      return;
    }

    const associatedEventIds = sourceDivision.eventIds.length > 0
      ? sourceDivision.eventIds
      : events.filter((entry) => entry.connectedDivisionIds.includes(sourceDivision.id)).map((entry) => entry.id);

    const duplicatedDivision: DivisionConfig = {
      ...sourceDivision,
      id: buildClientId('div'),
      name: buildDuplicateName(sourceDivision.name, 'Untitled Division'),
      eventIds: associatedEventIds,
    };

    const nextDivisions = [...divisions, duplicatedDivision];
    const nextEvents = events.map((entry) => (
      associatedEventIds.includes(entry.id)
        ? { ...entry, connectedDivisionIds: entry.connectedDivisionIds.includes(duplicatedDivision.id) ? entry.connectedDivisionIds : [...entry.connectedDivisionIds, duplicatedDivision.id] }
        : entry
    ));

    setDivisions(nextDivisions);
    setEvents(nextEvents);
    setSelectedDivisionId(duplicatedDivision.id);
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
    });
  };

  const handleDeleteDivision = (divisionId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this division?')) {
      return;
    }

    const nextDivisions = divisions.filter((entry) => entry.id !== divisionId);
    const nextEvents = events.map((entry) => {
      const connectedDivisionIds = entry.connectedDivisionIds.filter((id) => id !== divisionId);
      return {
        ...entry,
        connectedDivisionIds,
        requireDivision: connectedDivisionIds.length > 0 ? entry.requireDivision : false,
      };
    });
    const nextFees = fees.map((entry) => ({
      ...entry,
      divisionIds: entry.divisionIds.filter((id) => id !== divisionId),
    }));
    const nextQuestions = questions.map((entry) => ({
      ...entry,
      scope: {
        ...entry.scope,
        divisionIds: entry.scope.divisionIds.filter((id) => id !== divisionId),
      },
    }));

    setDivisions(nextDivisions);
    setEvents(nextEvents);
    setFees(nextFees);
    setQuestions(nextQuestions);
    setSelectedDivisionId((prev) => (prev === divisionId ? null : prev));
    setDrawerState((prev) => (prev?.kind === 'division' && prev.id === divisionId ? null : prev));
    setOpenCardMenu(null);
    void persistOrganizerChanges({
      events: nextEvents,
      divisions: nextDivisions,
      fees: nextFees,
      questions: nextQuestions,
    });
  };

  const handleSaveSquad = (nextSquad: SquadConfig) => {
    const normalizedSquad = normalizeSquadConfig(nextSquad, {
      locationName: details.bowlingCenter,
      registrationDeadlineIso: details.registrationCloseIso,
    });
    const exists = squads.some((entry) => entry.id === normalizedSquad.id);
    const nextSquads = exists
      ? squads.map((entry) => (entry.id === normalizedSquad.id ? normalizedSquad : entry))
      : [...squads, normalizedSquad];
    setSquads(nextSquads);
    setDrawerState(null);
    void persistOrganizerChanges({ squads: nextSquads });
  };

  const handleSaveQuestion = (nextQuestion: CustomQuestionConfig) => {
    const exists = questions.some((entry) => entry.id === nextQuestion.id);
    const nextQuestions = exists
      ? questions.map((entry) => (entry.id === nextQuestion.id ? nextQuestion : entry))
      : [...questions, nextQuestion];
    setQuestions(nextQuestions);
    setDrawerState(null);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleSaveField = (nextField: RegistrationFieldConfig) => {
    const normalizedField = nextField.key === 'bowling_hand'
      ? {
          ...nextField,
          mode: 'dont-ask' as RegistrationFieldConfig['mode'],
        }
      : nextField;
    const nextFields = fields.map((entry) => (entry.id === normalizedField.id ? normalizedField : entry));
    setFields(nextFields);
    setDrawerState(null);
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleDeleteField = (fieldId: string) => {
    const targetField = fields.find((entry) => entry.id === fieldId);
    if (!targetField) {
      return;
    }

    if (typeof window !== 'undefined' && !window.confirm(`Delete ${targetField.customLabel || targetField.label}?`)) {
      return;
    }

    const nextFields = builtInRegistrationFieldKeys.has(targetField.key)
      ? fields.map((entry) => (
        entry.id === fieldId
          ? {
              ...entry,
              mode: 'dont-ask' as RegistrationFieldConfig['mode'],
              customLabel: '',
              helpText: '',
            }
          : entry
      ))
      : fields.filter((entry) => entry.id !== fieldId);

    setFields(nextFields);
    setDrawerState((prev) => (prev?.kind === 'field' && prev.id === fieldId ? null : prev));
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleSetFieldMode = (fieldId: string, mode: RegistrationFieldConfig['mode']) => {
    const nextFields = fields.map((entry) => {
      if (entry.id !== fieldId) {
        return entry;
      }

      return {
        ...entry,
        mode,
      };
    });

    setFields(nextFields);
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleSetQuestionEnabled = (questionId: string, enabled: boolean) => {
    const nextQuestions = questions.map((entry) => (
      entry.id === questionId
        ? { ...entry, enabled }
        : entry
    ));

    setQuestions(nextQuestions);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleSetQuestionRequired = (questionId: string, required: boolean) => {
    const nextQuestions = questions.map((entry) => (
      entry.id === questionId
        ? { ...entry, required }
        : entry
    ));

    setQuestions(nextQuestions);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleFieldDragStart = (fieldId: string, event: DragEvent<HTMLElement>) => {
    setDraggingFieldId(fieldId);
    setDragOverFieldId(fieldId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleFieldDragOver = (targetFieldId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverFieldId((prev) => (prev === targetFieldId ? prev : targetFieldId));
  };

  const handleFieldDrop = (targetFieldId: string) => {
    if (!draggingFieldId) {
      return;
    }

    const draggedId = draggingFieldId;
    setDraggingFieldId(null);
    setDragOverFieldId(null);

    if (draggedId === targetFieldId) {
      return;
    }

    const nextFields = reorderItemsByDropTarget(fields, draggedId, targetFieldId);
    setFields(nextFields);
    void persistOrganizerChanges({ fields: nextFields });
  };

  const handleFieldDragEnd = () => {
    setDraggingFieldId(null);
    setDragOverFieldId(null);
  };

  const handleQuestionDragStart = (questionId: string, event: DragEvent<HTMLElement>) => {
    setDraggingQuestionId(questionId);
    setDragOverQuestionId(questionId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleQuestionDragOver = (targetQuestionId: string, event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverQuestionId((prev) => (prev === targetQuestionId ? prev : targetQuestionId));
  };

  const handleQuestionDrop = (targetQuestionId: string) => {
    if (!draggingQuestionId) {
      return;
    }

    const draggedId = draggingQuestionId;
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);

    if (draggedId === targetQuestionId) {
      return;
    }

    const nextQuestions = reorderItemsByDropTarget(questions, draggedId, targetQuestionId);
    setQuestions(nextQuestions);
    void persistOrganizerChanges({ questions: nextQuestions });
  };

  const handleQuestionDragEnd = () => {
    setDraggingQuestionId(null);
    setDragOverQuestionId(null);
  };

  const handleSaveFee = (nextFee: FeeConfig) => {
    const normalizedFee: FeeConfig = {
      ...nextFee,
      required: false,
    };

    const exists = fees.some((entry) => entry.id === normalizedFee.id);
    const nextFees = exists
      ? fees.map((entry) => (entry.id === normalizedFee.id ? normalizedFee : entry))
      : [...fees, normalizedFee];

    setFees(nextFees);
    setDrawerState(null);
    void persistOrganizerChanges({ fees: nextFees });
  };

  const handleSaveLocation = (nextLocation: LocationConfig) => {
    const exists = locations.some((entry) => entry.id === nextLocation.id);
    const nextLocations = exists
      ? locations.map((entry) => (entry.id === nextLocation.id ? nextLocation : entry))
      : [...locations, nextLocation];

    setLocations(nextLocations);
    setDrawerState(null);
    void persistOrganizerChanges({ locations: nextLocations });
  };

  const applyLogoFile = async (file: File | null) => {
    if (!file) {
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']);
    const isAllowedType = allowedTypes.has(file.type.toLowerCase());
    if (!isAllowedType) {
      setLogoUploadError('Please upload a PNG, JPG, or SVG file.');
      return;
    }

    if (file.size > maxBytes) {
      setLogoUploadError('Logo file is too large. Max size is 5MB.');
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    setLogoUploadError(null);
    setPendingLogoFile(file);
    setPreviewUrl(previewUrl);
    setDetails((prev) => ({
      ...prev,
      logoFileName: file.name,
    }));
  };

  const clearLogo = async () => {
    setLogoUploadError(null);

    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (token && persistedTournamentId) {
      try {
        await deleteTournamentLogo({ token, tournamentId: persistedTournamentId });
      } catch (error) {
        setLogoUploadError(error instanceof Error ? error.message : 'Failed to remove logo.');
        return;
      }
    }

    setPendingLogoFile(null);
    setPreviewUrl(null);
    setDetails((prev) => ({
      ...prev,
      logoFileName: '',
    }));
  };

  const handleLogoInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void applyLogoFile(event.target.files?.[0] ?? null);
    // Allow re-selecting the same file by clearing the current value.
    event.target.value = '';
  };

  const handleLogoDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsLogoDragActive(false);
    void applyLogoFile(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className={styles.shell}>
      <section className={styles.topOverviewCard} aria-label="Builder overview">
        <header className={styles.topBar}>
          <div>
            <p className={styles.eyebrow}>Organizer Setup</p>
            <h1>Tournament Builder</h1>
            <p>Build once, configure deeply, and preview exactly what bowlers will see.</p>
          </div>
          <div className={styles.topActions}>
            <span
              className={`${styles.autosaveBadge} ${autosaveEnabled ? styles.autosaveBadgeOn : styles.autosaveBadgeOff} ${isAutosaving ? styles.autosaveBadgeSaving : ''}`}
              aria-live="polite"
            >
              {autosaveStatusLabel}
            </span>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => { void handleOpenTournamentModal(); }}
              disabled={isLoadingTournamentLibrary}
            >
              <RotateCcw size={15} /> {isLoadingTournamentLibrary ? 'Loading...' : 'Load Tournament'}
            </button>
            <button type="button" className={styles.secondaryAction} onClick={() => { void handleSaveDraft(); }} disabled={isSavingDraft || isPublishing}>
              <Save size={15} /> {isSavingDraft ? 'Saving...' : 'Save Draft'}
            </button>
            <button type="button" className={styles.primaryAction} onClick={() => setActiveSection('review-publish')}>
              Review & Publish
            </button>
          </div>
        </header>

        <div className={styles.topOverviewMeta}>
          {(draftSavedAt || publishedAt || saveError || autosaveError) ? (
            <div
              className={styles.noticeRow}
              role={saveError ? 'alert' : 'status'}
              aria-live={saveError ? 'assertive' : 'polite'}
            >
              {publishedAt && <span className={styles.publishSuccess}>Tournament published {new Date(publishedAt).toLocaleString()}.</span>}
              {draftSavedAt && <span>Draft saved {new Date(draftSavedAt).toLocaleString()}.</span>}
              {autosaveError && <span className={styles.autosaveError}>{autosaveError}</span>}
              {saveError && <span className={styles.saveError}>{saveError}</span>}
            </div>
          ) : null}

          <div className={styles.progressStrip}>
            <span>Setup completion</span>
            <strong>{completion}% complete</strong>
            <div className={styles.progressTrack}>
              <span style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <aside className={styles.navRail}>
          <h2>Setup Sections</h2>
          <div className={styles.mobileSectionPicker}>
            <label htmlFor="section-picker">Section</label>
            <select id="section-picker" value={activeSection} onChange={(event) => setActiveSection(event.target.value as SetupSectionKey)}>
              {setupSections.map((section) => (
                <option key={section.key} value={section.key}>{section.label}</option>
              ))}
            </select>
          </div>
          <ul>
            {setupSections.map((section, index) => {
              const active = section.key === activeSection;
              const status = statusBySection[section.key];
              const statusLabel = status === 'complete'
                ? 'Complete'
                : status === 'needs-attention'
                  ? 'Needs Attention'
                  : 'Incomplete';
              return (
                <li key={section.key}>
                  <button
                    type="button"
                    className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                    onClick={() => setActiveSection(section.key)}
                  >
                    <span className={styles.navStepIndex}>{index + 1}</span>
                    <span className={styles.navText}>
                      <strong>{section.label}</strong>
                      <small className={`${styles.navStatusText} ${status === 'complete' ? styles.navStatusComplete : status === 'needs-attention' ? styles.navStatusNeedsAttention : styles.navStatusIncomplete}`}>
                        {statusLabel}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <section className={styles.navProgressCard} aria-label="Setup progress">
            <div className={styles.navProgressHead}>
              <strong>Setup Progress</strong>
              <span>{completion}% Complete</span>
            </div>
            <div className={styles.navProgressTrack}>
              <span style={{ width: `${completion}%` }} />
            </div>
            <p>Complete all required sections to publish your tournament.</p>
          </section>

          <section className={styles.navHelpCard}>
            <h3>Need Help?</h3>
            <p>View the Tournament Central setup guide.</p>
            <button type="button" className={styles.navHelpLink}>
              Setup Guide <Link2 size={12} />
            </button>
          </section>
        </aside>

        <main className={styles.workspace}>
          {activeSection === 'tournament-details' && (
            <TournamentDetailsSection
              details={details}
              setDetails={setDetails}
              statusBySection={statusBySection}
              supportEmailLooksValid={supportEmailLooksValid}
              recommendedTournamentStatus={recommendedTournamentStatus}
              hasLogoAsset={hasLogoAsset}
              logoAssetName={logoAssetName}
              logoAssetMeta={logoAssetMeta}
              logoPreviewUrl={logoPreviewUrl}
              isLogoDragActive={isLogoDragActive}
              logoUploadError={logoUploadError}
              pendingLogoFile={pendingLogoFile}
              tournamentDateOrderInvalid={tournamentDateOrderInvalid}
              registrationDateOrderInvalid={registrationDateOrderInvalid}
              registrationAfterStartWarning={registrationAfterStartWarning}
              visibilitySummary={visibilitySummary}
              timelineWarnings={timelineWarningEntries}
              warningActions={timelineWarningActions}
              showValidationWarnings={timelineWarnings.length > 0}
              usStates={US_STATES}
              timezones={TIMEZONES}
              logoInputRef={logoInputRef}
              handleLogoInputChange={handleLogoInputChange}
              handleLogoDrop={handleLogoDrop}
              clearLogo={clearLogo}
              setIsLogoDragActive={setIsLogoDragActive}
              shiftIsoDate={shiftIsoDate}
            />
          )}
              {activeSection === 'events-divisions' && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Events &amp; Divisions</h2>
                      <p>Set up event formats, connected divisions, and entry structure.</p>
                    </div>
                    <SetupStatusBadge status={statusBySection['events-divisions']} />
                  </div>

                  <div className={styles.evDivLayout}>
                    <div className={styles.evDivColumn}>
                      <div className={styles.evDivListCard}>
                        <div className={styles.evDivListHead}>
                          <div className={styles.evDivListHeadText}>
                            <span className={styles.evDivListHeadIcon}><Trophy size={14} /></span>
                            <h2>Events</h2>
                            <p>Configure event settings and entry fees.</p>
                          </div>
                          <div className={styles.evDivListHeadActions}>
                            <span className={styles.evDivCountPill}>{events.length} event{events.length === 1 ? '' : 's'}</span>
                            <button
                              type="button"
                              className={styles.inlineAction}
                              onClick={() => {
                                const next = emptyEvent(events.length + 1);
                                const nextEvents = [...events, next];
                                setEvents(nextEvents);
                                setSelectedEventId(next.id);
                                setOpenCardMenu(null);
                                void persistOrganizerChanges({ events: nextEvents });
                              }}
                            >
                              <Plus size={14} /> Add Event
                            </button>
                          </div>
                        </div>
                        <div className={styles.evDivListBody}>
                          {events.length === 0 && (
                            <p className={styles.evDivEmpty}>No events yet. Add one to get started.</p>
                          )}
                          {events.map((ev) => {
                            const squadCount = ev.connectedSquadIds.length;
                            const metaParts = [
                              ev.minPlayers === ev.maxPlayers ? `${ev.minPlayers} Bowler${ev.minPlayers !== 1 ? 's' : ''}` : `${ev.minPlayers}–${ev.maxPlayers} Bowlers`,
                              ev.scoring.charAt(0).toUpperCase() + ev.scoring.slice(1),
                              ev.requireDivision ? 'Division Required' : 'Division Optional',
                              `${squadCount} Squad${squadCount !== 1 ? 's' : ''}`,
                            ];
                            return (
                              <div
                                key={ev.id}
                                className={`${styles.evCardRow} ${selectedEventId === ev.id ? styles.evCardRowActive : ''}`}
                                onClick={() => {
                                  setSelectedEventId(ev.id);
                                  setOpenCardMenu(null);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setSelectedEventId(ev.id);
                                    setOpenCardMenu(null);
                                  }
                                }}
                              >
                                <div className={styles.dragHandle}><GripVertical size={15} /></div>
                                <div className={styles.evCardMain}>
                                  <div className={styles.evCardTitle}>
                                    <strong>{ev.name || 'Untitled Event'}</strong>
                                    <span className={`${styles.evCardBadge} ${ev.enabled ? styles.evCardBadgeEnabled : styles.evCardBadgeDraft}`}>
                                      {ev.enabled ? 'Enabled' : 'Draft'}
                                    </span>
                                  </div>
                                  <p className={styles.evCardMeta}>{metaParts.join(' • ')}</p>
                                  <p className={styles.evCardFee}>{formatMoney(ev.entryFeeCents)} Entry Fee</p>
                                </div>
                                <div className={styles.cardActions}>
                                  <button type="button" className={styles.iconButton} onClick={(e) => { e.stopPropagation(); setSelectedEventId(ev.id); }} aria-label="Edit event"><PencilLine size={14} /></button>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenCardMenu((prev) => prev?.kind === 'event' && prev.id === ev.id ? null : { kind: 'event', id: ev.id });
                                    }}
                                    aria-label="More actions"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {openCardMenu?.kind === 'event' && openCardMenu.id === ev.id ? (
                                    <div className={styles.cardMenu} onClick={(e) => e.stopPropagation()}>
                                      <button type="button" className={styles.cardMenuButton} onClick={() => handleDuplicateEvent(ev.id)}>Duplicate</button>
                                      <button type="button" className={`${styles.cardMenuButton} ${styles.cardMenuButtonDanger}`} onClick={() => handleDeleteEvent(ev.id)}>Delete</button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className={styles.evDivColumn}>
                      <div className={styles.evDivListCard}>
                        <div className={styles.evDivListHead}>
                          <div className={styles.evDivListHeadText}>
                            <span className={styles.evDivListHeadIcon}><ListOrdered size={14} /></span>
                            <h2>Divisions</h2>
                            <p>Define eligibility and scoring groups.</p>
                          </div>
                          <div className={styles.evDivListHeadActions}>
                            <span className={styles.evDivCountPill}>{divisions.length} division{divisions.length === 1 ? '' : 's'}</span>
                            <button
                              type="button"
                              className={styles.inlineAction}
                              onClick={() => {
                                const next: DivisionConfig = emptyDivision();
                                const nextDivisions = [...divisions, next];
                                setDivisions(nextDivisions);
                                setSelectedDivisionId(next.id);
                                setOpenCardMenu(null);
                                void persistOrganizerChanges({ divisions: nextDivisions });
                              }}
                            >
                              <Plus size={14} /> Add Division
                            </button>
                          </div>
                        </div>
                        <div className={styles.evDivListBody}>
                          {divisions.length === 0 && (
                            <p className={styles.evDivEmpty}>No divisions yet. Add one to get started.</p>
                          )}
                          {divisions.map((div) => {
                            const avgLabel = div.minAverage !== null && div.maxAverage !== null
                              ? `Avg ${div.minAverage}–${div.maxAverage}`
                              : div.minAverage !== null
                                ? `Avg ${div.minAverage}+`
                                : div.maxAverage !== null
                                  ? `Avg ${div.maxAverage} & Below`
                                  : 'No Avg Restriction';
                            const scoringLabel = div.mode.charAt(0).toUpperCase() + div.mode.slice(1);
                            const usedByNames = events.filter((ev) => ev.connectedDivisionIds.includes(div.id)).map((ev) => ev.name).filter(Boolean);
                            return (
                              <div
                                key={div.id}
                                className={`${styles.evCardRow} ${selectedDivisionId === div.id ? styles.evCardRowActive : ''}`}
                                onClick={() => {
                                  setSelectedDivisionId(div.id);
                                  setOpenCardMenu(null);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    setSelectedDivisionId(div.id);
                                    setOpenCardMenu(null);
                                  }
                                }}
                              >
                                <div className={styles.dragHandle}><ListOrdered size={15} /></div>
                                <div className={styles.evCardMain}>
                                  <div className={styles.evCardTitle}>
                                    <strong className={styles.evCardDivName}>{div.name || 'Untitled Division'}</strong>
                                    <span className={`${styles.evCardBadge} ${div.enabled ? styles.evCardBadgeEnabled : styles.evCardBadgeDraft}`}>
                                      {div.enabled ? 'Enabled' : 'Draft'}
                                    </span>
                                  </div>
                                  <p className={styles.evCardMeta}>{avgLabel} • {scoringLabel}</p>
                                  {usedByNames.length > 0 && (
                                    <p className={styles.evCardUsedBy}>Used by: {usedByNames.join(', ')}</p>
                                  )}
                                </div>
                                <div className={styles.cardActions}>
                                  <button type="button" className={styles.iconButton} onClick={(e) => { e.stopPropagation(); setSelectedDivisionId(div.id); }} aria-label="Edit division"><PencilLine size={14} /></button>
                                  <button
                                    type="button"
                                    className={styles.iconButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenCardMenu((prev) => prev?.kind === 'division' && prev.id === div.id ? null : { kind: 'division', id: div.id });
                                    }}
                                    aria-label="More actions"
                                  >
                                    <MoreHorizontal size={14} />
                                  </button>
                                  {openCardMenu?.kind === 'division' && openCardMenu.id === div.id ? (
                                    <div className={styles.cardMenu} onClick={(e) => e.stopPropagation()}>
                                      <button type="button" className={styles.cardMenuButton} onClick={() => handleDuplicateDivision(div.id)}>Duplicate</button>
                                      <button type="button" className={`${styles.cardMenuButton} ${styles.cardMenuButtonDanger}`} onClick={() => handleDeleteDivision(div.id)}>Delete</button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
          )}

          {/* ── Event editor modal ── */}
          {selectedEventId && events.find((e) => e.id === selectedEventId) && (
            <div className={styles.editorModal} role="dialog" aria-modal="true">
              <div className={styles.editorModalBox}>
                <div className={styles.editorModalHead}>
                  <div className={styles.divisionEditorHeadBlock}>
                    <span className={styles.divisionEditorHeadBadge}><Trophy size={14} /></span>
                    <div className={styles.divisionEditorHeadText}>
                      <span className={styles.editorModalTitle}>Event Details</span>
                      <small className={styles.divisionEditorHeadSubtitle}>{events.find((e) => e.id === selectedEventId)!.name || 'New Event'}</small>
                    </div>
                  </div>
                  <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={() => setSelectedEventId(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className={styles.editorModalBody}>
                  <InlineEventEditor
                    key={selectedEventId}
                    event={events.find((e) => e.id === selectedEventId)!}
                    divisions={divisions}
                    squads={squads}
                    onSave={(updated) => {
                      handleSaveEvent(updated);
                      setSelectedEventId(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Division editor modal ── */}
          {selectedDivisionId && divisions.find((d) => d.id === selectedDivisionId) && (
            <div className={styles.editorModal} role="dialog" aria-modal="true">
              <div className={styles.editorModalBox}>
                <div className={styles.editorModalHead}>
                  <div className={styles.divisionEditorHeadBlock}>
                    <span className={styles.divisionEditorHeadBadge}><Layers size={14} /></span>
                    <div className={styles.divisionEditorHeadText}>
                      <span className={styles.editorModalTitle}>Division Details</span>
                      <small className={styles.divisionEditorHeadSubtitle}>{divisions.find((d) => d.id === selectedDivisionId)!.name || 'New Division'}</small>
                    </div>
                  </div>
                  <button type="button" className={`${styles.iconButton} ${styles.modalCloseButton}`} onClick={() => setSelectedDivisionId(null)} aria-label="Close">
                    <X size={16} />
                  </button>
                </div>
                <div className={styles.editorModalBody}>
                  <InlineDivisionEditor
                    key={selectedDivisionId}
                    division={divisions.find((d) => d.id === selectedDivisionId)!}
                    events={events}
                    onSave={(updated) => {
                      handleSaveDivision(updated);
                      setSelectedDivisionId(null);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === 'squads-availability' && (
            <div className={styles.squadDashLayout}>
              <section className={styles.sectionCard}>
                <div className={`${styles.sectionHeader} ${styles.squadSectionHeader}`}>
                  <div>
                    <h2>Squads & Availability</h2>
                    <p className={styles.squadDashSubtitle}>
                      Manage squad dates, times, capacity, and event assignments.
                    </p>
                  </div>
                  <div className={styles.squadHeaderActions}>
                    <SetupStatusBadge status={statusBySection['squads-availability']} />
                    <span className={styles.evDivCountPill}>{squads.length} squads</span>
                    <div className={styles.squadDashActions}>
                    <button type="button" className={styles.secondaryAction} onClick={() => setActiveSection('registration-setup')}>
                      <Eye size={14} /> Preview Registration
                    </button>
                    <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'squad' })}>
                      <Plus size={14} /> Add Squad
                    </button>
                    </div>
                  </div>
                </div>

                <div className={styles.squadMetricGrid}>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><Users size={14} /></span>
                    <div>
                      <small>Total Squads</small>
                      <strong>{squads.length}</strong>
                    </div>
                  </article>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><CalendarDays size={14} /></span>
                    <div>
                      <small>Dates</small>
                      <strong>{groupsByDate.length}</strong>
                    </div>
                  </article>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><Users size={14} /></span>
                    <div>
                      <small>Total Capacity</small>
                      <strong>{totalSquadCapacity}</strong>
                    </div>
                  </article>
                  <article className={styles.squadMetricCard}>
                    <span className={styles.squadMetricIcon}><CircleCheck size={14} /></span>
                    <div>
                      <small>Spots Filled</small>
                      <strong>{totalRegisteredSpots}</strong>
                      <div className={styles.squadMetricFoot}>
                        <em>{fillPercent}% full</em>
                        <span className={styles.squadMetricGauge} style={fillGaugeStyle}>
                          <span>{fillPercent}%</span>
                        </span>
                      </div>
                    </div>
                  </article>
                </div>

                <div className={styles.squadToolbar}>
                  <div className={styles.segmentedControl}>
                    <button
                      type="button"
                      className={`${styles.segmentedButton} ${squadViewMode === 'date' ? styles.segmentedButtonActive : ''}`}
                      onClick={() => setSquadViewMode('date')}
                    >
                      <CalendarDays size={12} /> By Date
                    </button>
                    <button
                      type="button"
                      className={`${styles.segmentedButton} ${squadViewMode === 'squad' ? styles.segmentedButtonActive : ''}`}
                      onClick={() => setSquadViewMode('squad')}
                    >
                      <Users size={12} /> By Squad
                    </button>
                  </div>
                </div>

                <div className={styles.squadGroupStack}>
                  {squadGroups.map((group) => (
                    <section key={group.key} className={styles.squadGroupBlock}>
                      <header className={styles.squadGroupHead}>
                        <h3><CalendarDays size={14} /> {group.label}</h3>
                        <div className={styles.squadGroupHeadMeta}>
                          <span>{group.squads.length} squads • {group.squads.reduce((sum, squad) => sum + squad.capacity, 0)} capacity • {group.squads.reduce((sum, squad) => sum + squad.registeredCount, 0)} filled</span>
                          <button type="button" className={styles.squadChevronButton} aria-label="Collapse date group" disabled>
                            <ChevronUp size={13} />
                          </button>
                        </div>
                      </header>
                      <div className={styles.squadRowList}>
                        {group.squads.map((squad, rowIndex) => {
                          const fillRate = squad.capacity > 0 ? squad.registeredCount / squad.capacity : 0;
                          const fillToneClass = fillRate >= 0.75
                            ? styles.squadStatusHigh
                            : fillRate >= 0.35
                              ? styles.squadStatusMid
                              : styles.squadStatusLow;
                          const fillCountClass = fillRate >= 0.75
                            ? styles.squadCountHigh
                            : fillRate >= 0.35
                              ? styles.squadCountMid
                              : styles.squadCountLow;
                          const attachedEventNames = squad.eventIds
                            .map((eventId) => eventNameById[eventId])
                            .filter((name): name is string => Boolean(name));
                          return (
                            <article key={squad.id} className={styles.squadRowCard}>
                              <div className={styles.squadTimeRail}>
                                <span className={`${styles.squadStatusDot} ${fillToneClass}`} aria-hidden="true" />
                                {rowIndex < group.squads.length - 1 ? <span className={styles.squadStatusLine} aria-hidden="true" /> : null}
                                <div className={styles.squadTimeBadge}>
                                  <strong>{formatSquadTimeLabel(squad.startTime)}</strong>
                                  <span>Start</span>
                                </div>
                              </div>

                              <div className={styles.squadRowMain}>
                                <strong>{squad.name}</strong>
                                <p className={styles.squadRowMeta}>
                                  <span><Clock3 size={12} /> Check-in {formatSquadTimeLabel(squad.checkInTime)}</span>
                                  <span><MapPin size={12} /> {squad.locationName || 'Location TBD'}</span>
                                </p>
                                <div className={styles.metaChips}>
                                  {attachedEventNames.slice(0, 3).map((eventName) => (
                                    <span key={`${squad.id}-${eventName}`} className={styles.chip}>{eventName}</span>
                                  ))}
                                  {attachedEventNames.length > 3 ? <span className={styles.chip}>+{attachedEventNames.length - 3} more</span> : null}
                                </div>
                              </div>

                              <div className={styles.squadNumericCol}>
                                <strong>{squad.capacity}</strong>
                                <span>Capacity</span>
                              </div>

                              <div className={styles.squadNumericCol}>
                                <strong className={fillCountClass}>{squad.registeredCount}/{squad.capacity}</strong>
                                <span>Registered</span>
                              </div>

                              <div className={styles.squadRowActions}>
                                <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'squad', id: squad.id })} aria-label={`Edit ${squad.name}`}>
                                  <PencilLine size={14} /> Edit
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <button type="button" className={styles.squadAddDateAction} onClick={() => setDrawerState({ kind: 'squad' })}>
                  <span className={styles.squadAddDateTitle}><Plus size={14} /> Add Squad to New Date</span>
                  <small>Create a new date and add squads</small>
                </button>
              </section>

              <aside className={styles.squadDashSidebar}>
                <section className={`${styles.sectionCard} ${styles.registrationFieldsSection}`}>
                  <h3 className={styles.squadSideTitle}><Users size={14} /> Squad Summary</h3>
                  <dl className={styles.squadSummaryList}>
                    <div><dt>Total Squads</dt><dd>{squads.length}</dd></div>
                    <div><dt>Total Capacity</dt><dd>{totalSquadCapacity}</dd></div>
                    <div><dt>Registered</dt><dd className={styles.squadSummaryAccent}>{totalRegisteredSpots} <small>({fillPercent}%)</small></dd></div>
                    <div><dt>Waitlist</dt><dd>{waitlistEnabledCount}</dd></div>
                  </dl>
                </section>

                <section className={styles.sectionCard}>
                  <h3 className={styles.squadSideTitle}><CircleCheck size={14} /> Event Availability</h3>
                  <div className={styles.squadEventRingWrap}>
                    <div className={styles.squadEventRing} style={eventCoverageRingStyle}>
                      <span>{eventCoverage.length}</span>
                    </div>
                    <p>{totalEventCoverage} squad assignment{totalEventCoverage === 1 ? '' : 's'}</p>
                  </div>
                  <ul className={styles.squadEventList}>
                    {eventCoverage.map((eventEntry) => (
                      <li key={eventEntry.id}>
                        <span className={styles.squadEventName}>
                          <span className={styles.squadEventDot} style={{ backgroundColor: eventCoverageColorById[eventEntry.id] }} aria-hidden="true" />
                          {eventEntry.name}
                        </span>
                        <strong>{eventEntry.squadCount} squad{eventEntry.squadCount === 1 ? '' : 's'}</strong>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className={styles.sectionCard}>
                  <h3 className={styles.squadSideTitle}><Info size={14} /> Quick Tips</h3>
                  <ul className={styles.squadTipsList}>
                    <li><span className={styles.squadTipIcon}><CalendarDays size={12} /></span><span>Assign events to squads so bowlers only see relevant times.</span></li>
                    <li><span className={styles.squadTipIcon}><Users size={12} /></span><span>Enable waitlist on high-demand squads to reduce registration loss.</span></li>
                    <li><span className={styles.squadTipIcon}><Clock3 size={12} /></span><span>Squad deadlines can override tournament registration dates.</span></li>
                  </ul>
                  <button type="button" className={styles.squadHelpLink}>
                    View Help Article <Link2 size={12} />
                  </button>
                </section>
              </aside>
            </div>
          )}

          {activeSection === 'registration-setup' && (
            <div className={styles.sectionStack}>
              <div className={styles.registrationSetupLayout}>
                <div className={styles.registrationSetupMain}>
                <section className={`${styles.sectionCard} ${styles.registrationFieldsSection}`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 className={styles.registrationFieldsHeading}><span className={styles.registrationFieldsIcon}><ClipboardList size={16} /></span>Registration Fields</h2>
                      <p>Configure the built-in bowler information fields.</p>
                    </div>
                    <div className={styles.registrationHeaderActions}>
                      <span className={styles.evDivCountPill}>{askedFields.length} active</span>
                      <SetupStatusBadge status={statusBySection['registration-setup']} />
                    </div>
                  </div>

                  <div className={styles.registrationFieldGroupCard}>
                    <div className={styles.registrationGroupHeader}>
                      <strong>Asked During Registration</strong>
                      <span>{askedFields.length} field{askedFields.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className={`${styles.listStack} ${styles.registrationFieldList} ${styles.registrationFieldGroupBody}`}>
                      {askedFields.map((field) => (
                        <article
                          key={field.id}
                          className={`${styles.configCard} ${styles.registrationFieldCard} ${styles.draggableCard} ${field.mode === 'dont-ask' ? styles.registrationFieldCardDisabled : ''} ${draggingFieldId === field.id ? styles.draggingCard : ''} ${dragOverFieldId === field.id && draggingFieldId && draggingFieldId !== field.id ? styles.dragTargetCard : ''}`}
                          draggable
                          onDragStart={(event) => handleFieldDragStart(field.id, event)}
                          onDragOver={(event) => handleFieldDragOver(field.id, event)}
                          onDrop={() => handleFieldDrop(field.id)}
                          onDragEnd={handleFieldDragEnd}
                        >
                          <div className={styles.dragHandle} aria-hidden="true">
                            <GripVertical size={14} />
                          </div>
                          <div className={styles.cardMain}>
                            <div className={styles.registrationFieldTitleRow}>
                              <div className={styles.registrationFieldNameWrap}>
                                <strong>{field.customLabel || field.label}</strong>
                              </div>
                            </div>
                            <p className={styles.registrationFieldHelpText}>{field.helpText || registrationFieldFallbackHelp(field)}</p>
                          </div>
                          <div className={styles.registrationFieldActions}>
                              <div className={styles.registrationModeControl}>
                                <select
                                  className={`${styles.registrationModeSelect} ${field.mode === 'required' ? styles.registrationModeSelectRequired : styles.registrationModeSelectOptional}`}
                                  value={field.mode}
                                  onChange={(event) => handleSetFieldMode(field.id, event.target.value as RegistrationFieldConfig['mode'])}
                                  aria-label={`Requirement setting for ${field.customLabel || field.label}`}
                                >
                                  <option value="required">Required</option>
                                  <option value="optional">Optional</option>
                                </select>
                              </div>
                            <div className={styles.registrationFieldUtilityActions}>
                              <button
                                type="button"
                                className={styles.inlineAction}
                                onClick={() => setDrawerState({ kind: 'field', id: field.id })}
                                aria-label={`Edit ${field.label}`}
                              >
                                Edit
                              </button>
                              {builtInRegistrationFieldKeys.has(field.key) ? (
                                <button
                                  type="button"
                                  className={`${styles.iconButton} ${styles.registrationFieldDelete}`}
                                  onClick={() => handleSetFieldMode(field.id, 'dont-ask')}
                                  aria-label={`Hide ${field.customLabel || field.label}`}
                                  title="Hide field"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.iconButton} ${styles.registrationFieldDelete}`}
                                  onClick={() => handleDeleteField(field.id)}
                                  aria-label={`Delete ${field.customLabel || field.label}`}
                                  title="Delete field"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>

                  {hiddenFields.length > 0 ? (
                    <div className={`${styles.registrationFieldGroupCard} ${styles.registrationFieldGroupCardMuted}`}>
                      <div className={styles.registrationGroupHeader}>
                        <strong>Don&apos;t Ask Right Now</strong>
                        <span>{hiddenFields.length} hidden field{hiddenFields.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className={`${styles.listStack} ${styles.registrationFieldList} ${styles.registrationFieldGroupBody}`}>
                        {hiddenFields.map((field) => (
                          <article
                            key={field.id}
                            className={`${styles.configCard} ${styles.registrationFieldCard} ${styles.registrationFieldCardMuted}`}
                          >
                            <div className={styles.dragHandle} aria-hidden="true">
                              <GripVertical size={14} />
                            </div>
                            <div className={styles.cardMain}>
                              <div className={styles.registrationFieldTitleRow}>
                                <div className={styles.registrationFieldNameWrap}>
                                  <strong>{field.customLabel || field.label}</strong>
                                </div>
                              </div>
                              <p className={styles.registrationFieldHelpText}>This field is currently hidden from bowlers.</p>
                              <div className={styles.metaChips}>
                                <span className={`${styles.chip} ${styles.registrationFieldModeChip} ${styles.registrationFieldModeDontAsk}`}>Don&apos;t Ask</span>
                              </div>
                            </div>
                            <div className={styles.registrationFieldActions}>
                              <div className={styles.registrationFieldUtilityActions}>
                                <button
                                  type="button"
                                  className={styles.inlineAction}
                                  onClick={() => handleSetFieldMode(field.id, 'optional')}
                                  aria-label={`Ask ${field.customLabel || field.label}`}
                                >
                                  Ask Field
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.inlineAction} ${styles.requiredToggleButton}`}
                                  onClick={() => handleSetFieldMode(field.id, 'required')}
                                  aria-label={`Ask ${field.customLabel || field.label} as required`}
                                >
                                  Ask as Required
                                </button>
                                <button
                                  type="button"
                                  className={styles.inlineAction}
                                  onClick={() => setDrawerState({ kind: 'field', id: field.id })}
                                  aria-label={`Edit ${field.label}`}
                                >
                                  <PencilLine size={15} /> Edit
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.registrationFieldFooterActions}>
                    <button type="button" className={styles.registrationFieldFooterPrimary} onClick={() => setDrawerState({ kind: 'field' })}>
                      <Plus size={14} /> Add Field
                    </button>
                    <button type="button" className={styles.registrationFieldFooterSecondary}>
                      <ListOrdered size={14} /> Reorder Fields
                    </button>
                  </div>
                </section>
                </div>

                <aside className={styles.registrationSetupPreviewRail}>
                  <section className={styles.previewRegistrationShell}>
                    <TournamentRegistrationForm
                      tournamentName={details.name || 'Tournament Name'}
                      squads={enabledSquads}
                      events={eventsForSelectedPreviewSquad}
                      divisions={enabledDivisions}
                      fields={askedFields}
                      questions={enabledQuestions}
                      requiredBowlerCount={requiredPreviewBowlerCount}
                      formState={signupPreviewForm}
                      setFormState={setSignupPreviewForm}
                      submitMessage={signupPreviewSubmitMessage}
                      isSubmitting={isSubmittingSignupPreview}
                      onSubmit={() => {
                        void handleSignupPreviewSubmit();
                      }}
                      footerHint="Live preview updates as you configure fields and questions."
                    />
                  </section>
                </aside>
              </div>

                <section className={styles.sectionCard}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2>Custom Questions</h2>
                      <p>Collect only what this tournament needs.</p>
                    </div>
                    <div className={styles.registrationQuestionHeaderActions}>
                      <span className={styles.evDivCountPill}>{enabledQuestions.length} active</span>
                      <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'question' })}>
                        <Plus size={14} /> Add Question
                      </button>
                    </div>
                  </div>
                  <div className={styles.registrationGroupHeader}>
                    <strong>Asked During Registration</strong>
                    <span>{enabledQuestions.length} question{enabledQuestions.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className={styles.listStack}>
                    {enabledQuestions.map((question) => (
                      <article
                        key={question.id}
                        className={`${styles.configCard} ${styles.registrationQuestionCard} ${styles.draggableCard} ${draggingQuestionId === question.id ? styles.draggingCard : ''} ${dragOverQuestionId === question.id && draggingQuestionId && draggingQuestionId !== question.id ? styles.dragTargetCard : ''}`}
                        draggable
                        onDragStart={(event) => handleQuestionDragStart(question.id, event)}
                        onDragOver={(event) => handleQuestionDragOver(question.id, event)}
                        onDrop={() => handleQuestionDrop(question.id)}
                        onDragEnd={handleQuestionDragEnd}
                      >
                        <div className={styles.dragHandle} aria-hidden="true">
                          <GripVertical size={14} />
                        </div>
                        <div className={styles.cardMain}>
                          <strong>{question.label || 'Untitled question'}</strong>
                          <div className={styles.metaChips}>
                            <span className={styles.chip}>{question.type}</span>
                            <span className={styles.chip}>{question.required ? 'Required' : 'Optional'}</span>
                            <span className={styles.chip}>{question.scope.all ? 'All registrations' : 'Scoped'}</span>
                            <span className={`${styles.chip} ${question.enabled ? styles.chipEnabled : styles.chipMuted}`}>{question.enabled ? 'Enabled' : 'Disabled'}</span>
                          </div>
                        </div>
                        <div className={styles.questionCardActions}>
                          <div className={styles.requirementPill} role="group" aria-label={`Required setting for ${question.label || 'Untitled question'}`}>
                            <button
                              type="button"
                              className={`${styles.requirementPillButton} ${question.required ? styles.requirementPillButtonActive : ''}`}
                              onClick={() => handleSetQuestionRequired(question.id, true)}
                              aria-pressed={question.required}
                            >
                              Required
                            </button>
                            <button
                              type="button"
                              className={`${styles.requirementPillButton} ${!question.required ? styles.requirementPillButtonActive : ''}`}
                              onClick={() => handleSetQuestionRequired(question.id, false)}
                              aria-pressed={!question.required}
                            >
                              Optional
                            </button>
                          </div>
                          <button type="button" className={styles.inlineAction} onClick={() => handleSetQuestionEnabled(question.id, false)}>
                            Don&apos;t Ask
                          </button>
                          <button type="button" className={styles.iconButton} onClick={() => setDrawerState({ kind: 'question', id: question.id })} aria-label="Edit question">
                            <PencilLine size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>

                  {disabledQuestions.length > 0 ? (
                    <>
                      <div className={styles.registrationGroupHeader}>
                        <strong>Don&apos;t Ask Right Now</strong>
                        <span>{disabledQuestions.length} hidden question{disabledQuestions.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className={styles.listStack}>
                        {disabledQuestions.map((question) => (
                          <article key={question.id} className={`${styles.configCard} ${styles.registrationQuestionCard} ${styles.questionCardDisabled}`}>
                            <div className={styles.dragHandle} aria-hidden="true">
                              <GripVertical size={14} />
                            </div>
                            <div className={styles.cardMain}>
                              <strong>{question.label || 'Untitled question'}</strong>
                              <div className={styles.metaChips}>
                                <span className={styles.chip}>{question.type}</span>
                                <span className={styles.chip}>{question.required ? 'Required' : 'Optional'}</span>
                                <span className={`${styles.chip} ${styles.chipMuted}`}>Don&apos;t Ask</span>
                              </div>
                            </div>
                            <div className={styles.questionCardActions}>
                              <div className={styles.requirementPill} role="group" aria-label={`Required setting for ${question.label || 'Untitled question'}`}>
                                <button
                                  type="button"
                                  className={`${styles.requirementPillButton} ${question.required ? styles.requirementPillButtonActive : ''}`}
                                  onClick={() => handleSetQuestionRequired(question.id, true)}
                                  aria-pressed={question.required}
                                >
                                  Required
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.requirementPillButton} ${!question.required ? styles.requirementPillButtonActive : ''}`}
                                  onClick={() => handleSetQuestionRequired(question.id, false)}
                                  aria-pressed={!question.required}
                                >
                                  Optional
                                </button>
                              </div>
                              <button type="button" className={styles.inlineAction} onClick={() => handleSetQuestionEnabled(question.id, true)}>
                                Ask Question
                              </button>
                              <button type="button" className={styles.iconButton} onClick={() => setDrawerState({ kind: 'question', id: question.id })} aria-label="Edit question">
                                <PencilLine size={15} />
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : null}
                </section>
            </div>
          )}

          {activeSection === 'fees-payments-documents' && (
            <div className={styles.sectionStack}>
              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Add-ons & Fee Adjustments</h2>
                    <p>Base entry fees are managed in Events & Divisions. Use this section for optional extras.</p>
                  </div>
                  <div className={styles.feesHeaderActions}>
                    <span className={styles.evDivCountPill}>{addOnFees.length} active</span>
                    <button type="button" className={styles.inlineAction} onClick={() => setDrawerState({ kind: 'fee' })}>
                      <Plus size={14} /> Add Add-on
                    </button>
                  </div>
                </div>
                <div className={styles.feesSummaryStrip}>
                  <article className={styles.feesSummaryItem}>
                    <small>Base Entry Total</small>
                    <strong>{formatMoney(baseEntryTotalCents)}</strong>
                  </article>
                  <article className={styles.feesSummaryItem}>
                    <small>Add-ons Total</small>
                    <strong>{formatMoney(addOnsTotalCents)}</strong>
                  </article>
                  <article className={styles.feesSummaryItem}>
                    <small>Active Add-ons</small>
                    <strong>{addOnFees.length}</strong>
                  </article>
                </div>
                <div className={styles.feesGrid}>
                  <div className={styles.feePanel}>
                    <div className={styles.feePanelHeader}>
                      <h3>Base Entry Fees</h3>
                      <span>{enabledEvents.length}</span>
                    </div>
                    <div className={styles.listStack}>
                      {enabledEvents.map((event) => (
                        <article key={event.id} className={`${styles.configCard} ${styles.feeConfigCard}`}>
                          <div className={styles.cardMain}>
                            <strong>{event.name || 'Untitled Event'}</strong>
                            <div className={styles.metaChips}>
                              <span className={`${styles.chip} ${styles.chipEnabled}`}>Base Entry</span>
                              <span className={styles.chip}>Managed in Events</span>
                            </div>
                            <p>{formatMoney(event.entryFeeCents)}</p>
                          </div>
                        </article>
                      ))}
                      {enabledEvents.length === 0 ? <p className={styles.emptyInlineNote}>Enable an event to set a base entry fee.</p> : null}
                    </div>
                  </div>
                  <div className={styles.feePanel}>
                    <div className={styles.feePanelHeader}>
                      <h3>Optional Add-ons</h3>
                      <span>{addOnFees.length}</span>
                    </div>
                    <div className={styles.listStack}>
                      {addOnFees.map((fee) => (
                        <article key={fee.id} className={`${styles.configCard} ${styles.feeConfigCard}`}>
                          <div className={styles.cardMain}>
                            <strong>{fee.name}</strong>
                            <div className={styles.metaChips}>
                              <span className={styles.chip}>Add-on</span>
                            </div>
                            <p>{formatMoney(fee.amountCents)}</p>
                          </div>
                          <button type="button" className={styles.iconButton} onClick={() => setDrawerState({ kind: 'fee', id: fee.id })} aria-label="Edit fee">
                            <PencilLine size={15} />
                          </button>
                        </article>
                      ))}
                      {addOnFees.length === 0 ? <p className={styles.emptyInlineNote}>No add-ons yet.</p> : null}
                    </div>
                  </div>
                </div>
              </section>

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Payments</h2>
                    <p>Cash collection is active for this release. Online payments will be added later.</p>
                  </div>
                  <div className={styles.feesHeaderActions}>
                    <span className={styles.evDivCountPill}>Cash only</span>
                    <SetupStatusBadge status={statusBySection['fees-payments-documents']} />
                  </div>
                </div>
                <div className={styles.configSurface}>
                  <div className={styles.paymentSummaryStrip}>
                    <span className={styles.chip}>Mode: {paymentModeLabel}</span>
                    <span className={`${styles.chip} ${styles.chipEnabled}`}>
                      Processor: Not required
                    </span>
                    <span className={`${styles.chip} ${styles.chipEnabled}`}>
                      Payout: At venue / cash handling
                    </span>
                  </div>

                  <div className={styles.segmentedControl} role="group" aria-label="Payment mode">
                    <button
                      type="button"
                      className={`${styles.segmentedButton} ${styles.segmentedButtonActive}`}
                    >
                      Cash Only
                    </button>
                    <button
                      type="button"
                      className={styles.segmentedButton}
                      disabled
                    >
                      Online Payments (Soon)
                    </button>
                  </div>

                  <div className={styles.paymentStepGrid}>
                    <article className={styles.paymentStepCard}>
                      <strong>1. Collection Mode</strong>
                      <p>Select how entries are collected during registration.</p>
                      <span className={`${styles.paymentStepBadge} ${paymentModeReady ? styles.paymentStepBadgeComplete : styles.paymentStepBadgePending}`}>
                        {paymentModeReady ? 'Complete' : 'Needs Setup'}
                      </span>
                    </article>

                    <article className={styles.paymentStepCard}>
                      <strong>2. Processor Connection</strong>
                      <p>Online processor setup will be enabled in a future update.</p>
                      <span className={`${styles.paymentStepBadge} ${styles.paymentStepBadgeComplete}`}>
                        Deferred
                      </span>
                    </article>

                    <article className={styles.paymentStepCard}>
                      <strong>3. Payout Schedule</strong>
                      <p>Cash is collected at the venue and reconciled by organizers.</p>
                      <span className={`${styles.paymentStepBadge} ${styles.paymentStepBadgeComplete}`}>
                        Cash workflow
                      </span>
                    </article>
                  </div>

                  <p className={styles.emptyInlineNote}>Online payments and processor onboarding are intentionally disabled for now.</p>
                </div>
              </section>

              <section className={styles.sectionCard}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2>Rules & Documents</h2>
                    <p>Attach rules, payout sheets, and legal notices.</p>
                  </div>
                  <div className={styles.feesHeaderActions}>
                    <span className={`${styles.chip} ${hasRulesDocument ? styles.chipEnabled : styles.chipMuted}`}>
                      {hasRulesDocument ? 'Rules Uploaded' : 'Rules Missing'}
                    </span>
                  </div>
                </div>
                <div className={styles.configSurface}>
                  <div className={styles.documentSummaryStrip}>
                    <span className={`${styles.chip} ${hasRulesDocument ? styles.chipEnabled : styles.chipMuted}`}>
                      {hasRulesDocument ? 'Rules Uploaded' : 'Rules Missing'}
                    </span>
                    <span className={styles.chip}>Visible during registration</span>
                  </div>

                  <article className={styles.documentFileCard}>
                    <div className={styles.documentFileMain}>
                      <strong>{hasRulesDocument ? 'Tournament Rules.pdf' : 'No file uploaded yet'}</strong>
                      <p>
                        {hasRulesDocument
                          ? 'Latest version is attached and shown to bowlers during signup.'
                          : 'Upload a PDF so bowlers can review terms and tournament policies.'}
                      </p>
                    </div>
                    <div className={styles.documentActions}>
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        disabled={!hasRulesDocument}
                      >
                        Preview
                      </button>
                      <button type="button" className={styles.inlineAction} onClick={() => setHasRulesDocument((prev) => !prev)}>
                        {hasRulesDocument ? 'Replace Document' : 'Upload Document'}
                      </button>
                    </div>
                  </article>

                  <div className={styles.documentTypeRow}>
                    <span className={styles.chip}>Rules</span>
                    <span className={styles.chip}>Payout Sheet</span>
                    <span className={styles.chip}>Legal Notice</span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeSection === 'review-publish' && (
            <section className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2>Review & Publish</h2>
                  <p>Finalize setup and publish only when required checks pass.</p>
                </div>
                <SetupStatusBadge status={statusBySection['review-publish']} />
              </div>
              <PublishValidationSummary
                issues={validationIssues}
                sections={setupSections}
                onNavigate={(section) => setActiveSection(section)}
              />
              <div className={styles.reviewStatusRecommendation}>
                <div>
                  <strong>Suggested tournament status: {recommendedTournamentStatus.value}</strong>
                  <p>{recommendedTournamentStatus.reason}</p>
                </div>
                <button
                  type="button"
                  className={styles.inlineAction}
                  onClick={() => {
                    setDetails((prev) => ({ ...prev, tournamentStatus: recommendedTournamentStatus.value }));
                    setActiveSection('tournament-details');
                  }}
                  disabled={details.tournamentStatus === recommendedTournamentStatus.value}
                >
                  Apply Suggested Status
                </button>
              </div>
              <div className={styles.publishActionsRow}>
                <button type="button" className={styles.secondaryAction} onClick={() => { void handleSaveDraft(); }} disabled={isSavingDraft || isPublishing}>
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </button>
                <button type="button" className={styles.primaryAction} onClick={() => { void handlePublish(); }} disabled={validationIssues.some((issue) => issue.severity === 'error') || isSavingDraft || isPublishing}>
                  <CircleCheck size={15} /> {isPublishing ? 'Publishing...' : 'Publish Tournament'}
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      {isTournamentModalOpen && (
        <div className={styles.tournamentLibraryBackdrop} onClick={() => setIsTournamentModalOpen(false)}>
          <section
            className={styles.tournamentLibraryModal}
            role="dialog"
            aria-modal="true"
            aria-label="All Tournaments"
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.tournamentLibraryHeader}>
              <div>
                <h3>All Tournaments</h3>
                <p>{userTournaments.length} available tournament{userTournaments.length === 1 ? '' : 's'}</p>
              </div>
              <button
                type="button"
                className={`${styles.tournamentLibraryClose} ${styles.modalCloseButton}`}
                aria-label="Close tournament list"
                onClick={() => setIsTournamentModalOpen(false)}
              >
                <X size={16} />
              </button>
            </header>

            <div className={styles.tournamentLibraryBody}>
              {isLoadingTournamentLibrary ? (
                <p className={styles.tournamentLibraryHint}>Loading tournaments...</p>
              ) : userTournaments.length === 0 ? (
                <p className={styles.tournamentLibraryHint}>No tournaments found for this user.</p>
              ) : (
                <ul className={styles.tournamentLibraryList}>
                  {userTournaments.map((tournament) => {
                    const setupState = setupStateByTournamentId[tournament.id];
                    const squadCount = countTournamentSquads(tournament.squad_times);
                    const tournamentStatusLabel = setupState?.is_published || tournament.is_public ? 'ACTIVE' : 'DRAFT';

                    return (
                      <li key={tournament.id} className={styles.tournamentLibraryItem}>
                        <article className={styles.tournamentCard}>
                          <div className={styles.tournamentCardMain}>
                            <span className={styles.tournamentIconWrap}>
                              <Trophy size={16} />
                            </span>
                            <div className={styles.tournamentCardText}>
                              <div className={styles.tournamentCardTitleRow}>
                                <strong>{tournament.name}</strong>
                                <span className={styles.tournamentStatusBadge}>{tournamentStatusLabel}</span>
                              </div>
                              <p>{tournament.location || 'Location not set'}</p>
                              <p>{formatTournamentCardDate(tournament.start_date, tournament.end_date)}</p>
                              <div className={styles.tournamentChipRow}>
                                <span>{squadCount} Squad{squadCount === 1 ? '' : 's'}</span>
                                <span>{tournament.entry_count ?? 0} Entries</span>
                                <span>{tournament.brackets_configured ? 'Brackets Configured' : 'Brackets Pending'}</span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.tournamentCardActions}>
                            <button
                              type="button"
                              className={styles.secondaryAction}
                              onClick={() => { void handleLoadExistingTournament(tournament.id); }}
                              disabled={loadingTournamentId === tournament.id || deletingTournamentId === tournament.id}
                            >
                              <RotateCcw size={14} /> {loadingTournamentId === tournament.id ? 'Loading...' : 'Edit'}
                            </button>
                            <button
                              type="button"
                              className={styles.dangerAction}
                              onClick={() => { void handleDeleteTournament(tournament.id); }}
                              disabled={loadingTournamentId === tournament.id || deletingTournamentId === tournament.id}
                            >
                              <Trash2 size={14} /> {deletingTournamentId === tournament.id ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      <ConfigDrawer
        open={Boolean(drawerState)}
        title={drawerState
          ? `${drawerState.id ? 'Edit' : 'Add'} ${drawerState.kind === 'fee' ? 'Add-on' : `${drawerState.kind.charAt(0).toUpperCase()}${drawerState.kind.slice(1)}`}`
          : ''}
        subtitle={drawerState ? ({ squad: 'Squads & Availability', location: 'Squads & Availability', field: 'Registration Setup', question: 'Registration Setup', fee: 'Add-ons, Payments & Docs' } as Record<string, string>)[drawerState.kind] ?? '' : ''}
        onClose={() => setDrawerState(null)}
      >
        {drawerState?.kind === 'squad' && activeSquad && (
          <SquadEditor
            squad={activeSquad}
            events={events}
            locationName={details.bowlingCenter}
            registrationDeadlineIso={details.registrationCloseIso}
            onSave={handleSaveSquad}
          />
        )}
        {drawerState?.kind === 'question' && activeQuestion && (
          <QuestionEditor question={activeQuestion} events={events} divisions={divisions} squads={squads} onSave={handleSaveQuestion} />
        )}
        {drawerState?.kind === 'field' && activeField && (
          <FieldEditor field={activeField} onSave={handleSaveField} />
        )}
        {drawerState?.kind === 'fee' && activeFee && (
          <FeeEditor fee={activeFee} events={events} divisions={divisions} squads={squads} onSave={handleSaveFee} />
        )}
        {drawerState?.kind === 'location' && activeLocation && (
          <LocationEditor location={activeLocation} onSave={handleSaveLocation} />
        )}
      </ConfigDrawer>
    </div>
  );
}

type InlineEventEditorProps = {
  event: EventConfig;
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (event: EventConfig) => void;
};

function InlineEventEditor({ event, divisions, squads, onSave }: InlineEventEditorProps) {
  const [draft, setDraft] = useState<EventConfig>(normalizeEventConfig(event));
  const [entryFeeInput, setEntryFeeInput] = useState(() => formatEntryFeeInput(event.entryFeeCents));
  const requiredBowlerCount = Math.max(draft.minPlayers, draft.maxPlayers, 1);
  const hasAvailableDivisions = divisions.length > 0;
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
  const selectedDivisionCount = draft.connectedDivisionIds.length;
  const selectedSquadCount = draft.connectedSquadIds.length;

  return (
    <form
      className={`${styles.detailForm} ${styles.divisionEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <div className={styles.divisionEditorSummary}>
        <span className={styles.divisionEditorSummaryChip}>{requiredBowlerCount} Bowler{requiredBowlerCount === 1 ? '' : 's'}</span>
        <span className={styles.divisionEditorSummaryChip}>{selectedDivisionCount} Division{selectedDivisionCount === 1 ? '' : 's'}</span>
        <span className={styles.divisionEditorSummaryChip}>{selectedSquadCount} Squad{selectedSquadCount === 1 ? '' : 's'}</span>
        <span className={`${styles.divisionEditorSummaryChip} ${draft.enabled ? styles.divisionEditorSummaryChipEnabled : ''}`}>{draft.enabled ? 'Enabled' : 'Draft'}</span>
      </div>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Identity & Entry Rules</h4>
          <p>Set the event basics and who can enter.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Event Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label className={styles.detailFormField}>
            Re-entry
            <select value={draft.allowReentry ? 'enabled' : 'disabled'} onChange={(e) => setDraft({ ...draft, allowReentry: e.target.value === 'enabled' })}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Description
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className={styles.detailFormField}>
            Max Entries Per Bowler
            <input type="number" min={0} value={draft.maxReentries} onChange={(e) => setDraft({ ...draft, maxReentries: Number(e.target.value) })} disabled={!draft.allowReentry} />
          </label>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>
            Required Bowler Count
            <input
              type="number"
              min={1}
              value={requiredBowlerCount}
              onChange={(e) => {
                const playerCount = Math.max(Number(e.target.value) || 1, 1);
                setDraft({ ...draft, minPlayers: playerCount, maxPlayers: playerCount });
              }}
            />
          </label>
        </div>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Scoring & Availability</h4>
          <p>Choose scoring mode and assign divisions and squads.</p>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>
            Scoring
            <select value={draft.scoring} onChange={(e) => setDraft({ ...draft, scoring: e.target.value as EventConfig['scoring'] })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
              <option value="no-tap">No-Tap</option>
            </select>
          </label>
          <div className={styles.detailFormField}>
            Available Divisions (optional)
            <div className={styles.detailFormCheckList}>
              {divisions.map((div) => (
                <label key={div.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={draft.connectedDivisionIds.includes(div.id)}
                    onChange={() => setDraft((prev) => ({
                      ...prev,
                      connectedDivisionIds: prev.connectedDivisionIds.includes(div.id)
                        ? prev.connectedDivisionIds.filter((id) => id !== div.id)
                        : [...prev.connectedDivisionIds, div.id],
                    }))}
                  />
                  {div.name || 'Untitled'}
                </label>
              ))}
              {divisions.length === 0 && <span className={styles.detailFormNone}>No divisions configured for this tournament.</span>}
            </div>
          </div>
          <div className={styles.detailFormField}>
            Available Squads
            <div className={styles.detailFormCheckList}>
              {squads.map((sq) => (
                <label key={sq.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={draft.connectedSquadIds.includes(sq.id)}
                    onChange={() => setDraft((prev) => ({
                      ...prev,
                      connectedSquadIds: prev.connectedSquadIds.includes(sq.id)
                        ? prev.connectedSquadIds.filter((id) => id !== sq.id)
                        : [...prev.connectedSquadIds, sq.id],
                    }))}
                  />
                  {sq.name || sq.dateIso}
                </label>
              ))}
              {squads.length === 0 && <span className={styles.detailFormNone}>No squads yet</span>}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Registration Controls</h4>
          <p>Configure required selections and entry pricing.</p>
        </div>
        <div className={styles.detailFormRow}>
          {hasAvailableDivisions ? (
            <label className={styles.detailFormField}>
              Division Selection
              <select
                value={divisionSelectionValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (nextValue === 'none') {
                    setDraft({ ...draft, requireDivision: false, connectedDivisionIds: [] });
                    return;
                  }

                  setDraft({ ...draft, requireDivision: nextValue === 'required' });
                }}
              >
                <option value="none">No divisions</option>
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          ) : (
            <div className={styles.detailFormField}>
              Division Selection
              <span className={styles.detailFormNone}>Not needed because this tournament has no divisions.</span>
            </div>
          )}
          <label className={styles.detailFormField}>
            Squad Selection
            <select value={draft.requireSquad ? 'required' : 'optional'} onChange={(e) => setDraft({ ...draft, requireSquad: e.target.value === 'required' })}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Entry Fee (USD)
            <input
              type="text"
              inputMode="decimal"
              value={entryFeeInput}
              onChange={(e) => {
                const nextValue = normalizeEntryFeeInput(e.target.value);
                setEntryFeeInput(nextValue);
                setDraft({ ...draft, entryFeeCents: parseEntryFeeInputToCents(nextValue) });
              }}
              onBlur={() => {
                setEntryFeeInput(formatEntryFeeInput(draft.entryFeeCents));
              }}
            />
          </label>
        </div>
      </section>

      <div className={styles.detailFormSaveRow}>
        <button type="submit" className={styles.primaryAction}>Save Event</button>
      </div>
    </form>
  );
}

type InlineDivisionEditorProps = {
  division: DivisionConfig;
  events: EventConfig[];
  onSave: (division: DivisionConfig) => void;
};

function InlineDivisionEditor({ division, events, onSave }: InlineDivisionEditorProps) {
  const [draft, setDraft] = useState<DivisionConfig>(division);
  const selectedEventCount = draft.eventIds.length;

  return (
    <form
      className={`${styles.detailForm} ${styles.divisionEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <div className={styles.divisionEditorSummary}>
        <span className={styles.divisionEditorSummaryChip}>{selectedEventCount} Event{selectedEventCount === 1 ? '' : 's'}</span>
        <span className={styles.divisionEditorSummaryChip}>{draft.mode === 'both' ? 'Scratch + Handicap' : draft.mode === 'scratch' ? 'Scratch' : 'Handicap'}</span>
        <span className={`${styles.divisionEditorSummaryChip} ${draft.enabled ? styles.divisionEditorSummaryChipEnabled : ''}`}>{draft.enabled ? 'Enabled' : 'Draft'}</span>
      </div>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Identity & Scoring</h4>
          <p>Define this division and choose how it scores.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Division Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label className={styles.detailFormField}>
            Scoring Type
            <select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as DivisionConfig['mode'] })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
              <option value="both">Both</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Description
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className={styles.detailFormField}>
            Eligibility Notes (optional)
            <textarea
              value={draft.eligibilityNotes}
              onChange={(e) => setDraft({ ...draft, eligibilityNotes: e.target.value })}
              placeholder="Add any special eligibility notes for this division..."
            />
          </label>
        </div>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Eligibility Rules</h4>
          <p>Set average and age limits when needed.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Minimum Average
            <input type="number" placeholder="No restriction" value={draft.minAverage ?? ''} onChange={(e) => setDraft({ ...draft, minAverage: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className={styles.detailFormField}>
            Maximum Average
            <input type="number" placeholder="No restriction" value={draft.maxAverage ?? ''} onChange={(e) => setDraft({ ...draft, maxAverage: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Minimum Age
            <input type="number" placeholder="No restriction" value={draft.minAge ?? ''} onChange={(e) => setDraft({ ...draft, minAge: e.target.value ? Number(e.target.value) : null })} />
          </label>
          <label className={styles.detailFormField}>
            Maximum Age
            <input type="number" placeholder="No restriction" value={draft.maxAge ?? ''} onChange={(e) => setDraft({ ...draft, maxAge: e.target.value ? Number(e.target.value) : null })} />
          </label>
        </div>
      </section>

      <section className={styles.divisionEditorSection}>
        <div className={styles.divisionEditorSectionHeader}>
          <h4>Availability</h4>
          <p>Choose which events include this division.</p>
        </div>
        <div className={styles.detailFormField}>
          Associated Events
          <div className={styles.detailFormCheckList}>
            {events.map((ev) => (
              <label key={ev.id} className={styles.detailFormCheckItem}>
                <input
                  type="checkbox"
                  checked={draft.eventIds.includes(ev.id)}
                  onChange={() => setDraft((prev) => ({
                    ...prev,
                    eventIds: prev.eventIds.includes(ev.id)
                      ? prev.eventIds.filter((id) => id !== ev.id)
                      : [...prev.eventIds, ev.id],
                  }))}
                />
                {ev.name || 'Untitled'}
              </label>
            ))}
            {events.length === 0 && <span className={styles.detailFormNone}>No events yet</span>}
          </div>
        </div>
        <label className={styles.detailFormField}>
          Status
          <select value={draft.enabled ? 'enabled' : 'draft'} onChange={(e) => setDraft({ ...draft, enabled: e.target.value === 'enabled' })}>
            <option value="enabled">Enabled</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </section>

      <div className={styles.detailFormSaveRow}>
        <button type="submit" className={styles.primaryAction}>Save Division</button>
      </div>
    </form>
  );
}

type EventEditorProps = {
  event: EventConfig;
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (event: EventConfig) => void;
};

function EventEditor({ event, divisions, squads, onSave }: EventEditorProps) {
  const [draft, setDraft] = useState<EventConfig>(normalizeEventConfig(event));
  const [entryFeeInput, setEntryFeeInput] = useState(() => formatEntryFeeInput(event.entryFeeCents));
  const requiredBowlerCount = Math.max(draft.minPlayers, draft.maxPlayers, 1);
  const hasAvailableDivisions = divisions.length > 0;
  const divisionSelectionValue = draft.connectedDivisionIds.length === 0 ? 'none' : draft.requireDivision ? 'required' : 'optional';
  const selectedDivisionCount = draft.connectedDivisionIds.length;
  const selectedSquadCount = draft.connectedSquadIds.length;

  return (
    <form
      className={`${styles.detailForm} ${styles.eventEditorForm}`}
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
    >
      <div className={styles.eventEditorSummary}>
        <span className={styles.eventEditorSummaryChip}>{requiredBowlerCount} Bowler{requiredBowlerCount === 1 ? '' : 's'}</span>
        <span className={styles.eventEditorSummaryChip}>{selectedDivisionCount} Division{selectedDivisionCount === 1 ? '' : 's'}</span>
        <span className={styles.eventEditorSummaryChip}>{selectedSquadCount} Squad{selectedSquadCount === 1 ? '' : 's'}</span>
        <span className={`${styles.eventEditorSummaryChip} ${draft.enabled ? styles.eventEditorSummaryChipEnabled : ''}`}>{draft.enabled ? 'Enabled' : 'Draft'}</span>
      </div>

      <section className={styles.eventEditorSection}>
        <div className={styles.eventEditorSectionHeader}>
          <h4>Identity & Entry Rules</h4>
          <p>Set the event basics and who can enter.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Event Name
            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
          </label>
          <label className={styles.detailFormField}>
            Re-entry
            <select value={draft.allowReentry ? 'enabled' : 'disabled'} onChange={(e) => setDraft({ ...draft, allowReentry: e.target.value === 'enabled' })}>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Description
            <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className={styles.detailFormField}>
            Max Entries Per Bowler
            <input type="number" min={0} value={draft.maxReentries} onChange={(e) => setDraft({ ...draft, maxReentries: Number(e.target.value) })} disabled={!draft.allowReentry} />
          </label>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>
            Required Bowler Count
            <input
              type="number"
              min={1}
              value={requiredBowlerCount}
              onChange={(e) => {
                const playerCount = Math.max(Number(e.target.value) || 1, 1);
                setDraft({ ...draft, minPlayers: playerCount, maxPlayers: playerCount });
              }}
            />
          </label>
        </div>
      </section>

      <section className={styles.eventEditorSection}>
        <div className={styles.eventEditorSectionHeader}>
          <h4>Scoring & Availability</h4>
          <p>Choose scoring mode and assign divisions/squads.</p>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>
            Scoring
            <select value={draft.scoring} onChange={(e) => setDraft({ ...draft, scoring: e.target.value as EventConfig['scoring'] })}>
              <option value="handicap">Handicap</option>
              <option value="scratch">Scratch</option>
              <option value="no-tap">No-Tap</option>
            </select>
          </label>
          <div className={styles.detailFormField}>
            Available Divisions (optional)
            <div className={styles.detailFormCheckList}>
              {divisions.map((div) => (
                <label key={div.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={draft.connectedDivisionIds.includes(div.id)}
                    onChange={() => setDraft((prev) => ({
                      ...prev,
                      connectedDivisionIds: prev.connectedDivisionIds.includes(div.id)
                        ? prev.connectedDivisionIds.filter((id) => id !== div.id)
                        : [...prev.connectedDivisionIds, div.id],
                    }))}
                  />
                  {div.name || 'Untitled'}
                </label>
              ))}
              {divisions.length === 0 && <span className={styles.detailFormNone}>No divisions configured for this tournament.</span>}
            </div>
          </div>
          <div className={styles.detailFormField}>
            Available Squads
            <div className={styles.detailFormCheckList}>
              {squads.map((sq) => (
                <label key={sq.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={draft.connectedSquadIds.includes(sq.id)}
                    onChange={() => setDraft((prev) => ({
                      ...prev,
                      connectedSquadIds: prev.connectedSquadIds.includes(sq.id)
                        ? prev.connectedSquadIds.filter((id) => id !== sq.id)
                        : [...prev.connectedSquadIds, sq.id],
                    }))}
                  />
                  {sq.name || sq.dateIso}
                </label>
              ))}
              {squads.length === 0 && <span className={styles.detailFormNone}>No squads yet</span>}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.eventEditorSection}>
        <div className={styles.eventEditorSectionHeader}>
          <h4>Registration Controls</h4>
          <p>Define what bowlers must select and set pricing.</p>
        </div>
        <div className={styles.detailFormRow}>
          {hasAvailableDivisions ? (
            <label className={styles.detailFormField}>
              Division Selection
              <select
                value={divisionSelectionValue}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  if (nextValue === 'none') {
                    setDraft({ ...draft, requireDivision: false, connectedDivisionIds: [] });
                    return;
                  }

                  setDraft({ ...draft, requireDivision: nextValue === 'required' });
                }}
              >
                <option value="none">No divisions</option>
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          ) : (
            <div className={styles.detailFormField}>
              Division Selection
              <span className={styles.detailFormNone}>Not needed because this tournament has no divisions.</span>
            </div>
          )}
          <label className={styles.detailFormField}>
            Squad Selection
            <select value={draft.requireSquad ? 'required' : 'optional'} onChange={(e) => setDraft({ ...draft, requireSquad: e.target.value === 'required' })}>
              <option value="required">Required</option>
              <option value="optional">Optional</option>
            </select>
          </label>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Entry Fee (USD)
            <input
              type="text"
              inputMode="decimal"
              value={entryFeeInput}
              onChange={(e) => {
                const nextValue = normalizeEntryFeeInput(e.target.value);
                setEntryFeeInput(nextValue);
                setDraft({ ...draft, entryFeeCents: parseEntryFeeInputToCents(nextValue) });
              }}
              onBlur={() => {
                setEntryFeeInput(formatEntryFeeInput(draft.entryFeeCents));
              }}
            />
          </label>
        </div>
      </section>

      <div className={styles.detailFormSaveRow}>
        <button type="submit" className={styles.primaryAction}>Save Event</button>
      </div>
    </form>
  );
}

type SquadEditorProps = {
  squad: SquadConfig;
  events: EventConfig[];
  locationName: string;
  registrationDeadlineIso: string;
  onSave: (squad: SquadConfig) => void;
};

function SquadEditor({ squad, events, locationName, registrationDeadlineIso, onSave }: SquadEditorProps) {
  const [draft, setDraft] = useState<SquadConfig>(normalizeSquadConfig(squad, { locationName, registrationDeadlineIso }));
  const selectedEventCount = draft.eventIds.length;
  const fillPercent = draft.capacity > 0
    ? Math.max(0, Math.min(100, Math.round((draft.registeredCount / draft.capacity) * 100)))
    : 0;

  return (
    <form className={`${styles.detailForm} ${styles.squadEditorForm}`} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <div className={styles.squadEditorSummary}>
        <span className={styles.squadEditorSummaryChip}>{selectedEventCount} Event{selectedEventCount === 1 ? '' : 's'}</span>
        <span className={styles.squadEditorSummaryChip}>{draft.requiredBowlerCount} Bowler{draft.requiredBowlerCount === 1 ? '' : 's'} Required</span>
        <span className={styles.squadEditorSummaryChip}>{fillPercent}% Filled</span>
        <span className={`${styles.squadEditorSummaryChip} ${draft.waitlistEnabled ? styles.squadEditorSummaryChipEnabled : ''}`}>{draft.waitlistEnabled ? 'Waitlist On' : 'Waitlist Off'}</span>
      </div>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Schedule</h4>
          <p>Set squad date, start, and check-in timing.</p>
        </div>
        <div className={styles.detailFormRow3}>
          <label className={styles.detailFormField}>Date<input type="date" value={draft.dateIso} onChange={(eventInput) => setDraft({ ...draft, dateIso: eventInput.target.value })} required /></label>
          <label className={styles.detailFormField}>Start Time<input type="time" value={draft.startTime} onChange={(eventInput) => setDraft({ ...draft, startTime: eventInput.target.value })} required /></label>
          <label className={styles.detailFormField}>Check-in<input type="time" value={draft.checkInTime} onChange={(eventInput) => setDraft({ ...draft, checkInTime: eventInput.target.value })} required /></label>
        </div>
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Capacity & Rules</h4>
          <p>Control roster size and registration limits.</p>
        </div>
        <div className={styles.detailFormRow}>
          <label className={styles.detailFormField}>
            Required Bowler Count
            <input
              type="number"
              min={1}
              value={draft.requiredBowlerCount}
              onChange={(eventInput) => setDraft({ ...draft, requiredBowlerCount: Math.max(1, Number(eventInput.target.value) || 1) })}
            />
          </label>
          <label className={styles.detailFormField}>Capacity<input type="number" min={1} value={draft.capacity} onChange={(eventInput) => setDraft({ ...draft, capacity: Number(eventInput.target.value) })} /></label>
        </div>
        <label className={styles.detailFormField}>Notes<textarea value={draft.notes} onChange={(eventInput) => setDraft({ ...draft, notes: eventInput.target.value })} /></label>
      </section>

      <section className={styles.squadEditorSection}>
        <div className={styles.squadEditorSectionHeader}>
          <h4>Availability</h4>
          <p>Assign events and control waitlist behavior.</p>
        </div>
        <div className={styles.detailFormField}>
          Associated Events
          <div className={styles.detailFormCheckList}>
            {events.map((eventOption) => {
              const checked = draft.eventIds.includes(eventOption.id);
              return (
                <label key={eventOption.id} className={styles.detailFormCheckItem}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      setDraft((prev) => ({
                        ...prev,
                        eventIds: checked
                          ? prev.eventIds.filter((id) => id !== eventOption.id)
                          : [...prev.eventIds, eventOption.id],
                      }));
                    }}
                  />
                  {eventOption.name}
                </label>
              );
            })}
            {events.length === 0 && <span className={styles.detailFormNone}>No events yet</span>}
          </div>
        </div>
        <label className={styles.detailFormField}>
          Waitlist
          <select value={draft.waitlistEnabled ? 'enabled' : 'disabled'} onChange={(eventInput) => setDraft({ ...draft, waitlistEnabled: eventInput.target.value === 'enabled' })}>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </label>
      </section>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Squad</button>
      </div>
    </form>
  );
}

type QuestionEditorProps = {
  question: CustomQuestionConfig;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (question: CustomQuestionConfig) => void;
};

type FieldEditorProps = {
  field: RegistrationFieldConfig;
  onSave: (field: RegistrationFieldConfig) => void;
};

function FieldEditor({ field, onSave }: FieldEditorProps) {
  const [draft, setDraft] = useState<RegistrationFieldConfig>(field);
  const isModeLocked = draft.key === 'bowling_hand';

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <label>
        System Field
        <input value={draft.label} readOnly />
      </label>
      <label>
        Custom Label
        <input
          value={draft.customLabel}
          onChange={(eventInput) => setDraft({ ...draft, customLabel: eventInput.target.value })}
          placeholder="Leave blank to use the system field name"
        />
      </label>
      <label>
        Help Text
        <textarea
          value={draft.helpText}
          onChange={(eventInput) => setDraft({ ...draft, helpText: eventInput.target.value })}
          placeholder="Add guidance the bowler will see below this field"
        />
      </label>
      <label>
        Requirement
        <select
          value={isModeLocked ? 'dont-ask' : draft.mode}
          onChange={(eventInput) => setDraft({ ...draft, mode: eventInput.target.value as RegistrationFieldConfig['mode'] })}
          disabled={isModeLocked}
        >
          {isModeLocked ? <option value="dont-ask">Don&apos;t Ask (Locked)</option> : null}
          {!isModeLocked ? <option value="required">Required</option> : null}
          {!isModeLocked ? <option value="optional">Optional</option> : null}
          <option value="dont-ask">Don&apos;t Ask</option>
        </select>
      </label>
      <label>
        Validation Type
        <input value={draft.validation} readOnly />
      </label>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Field</button>
      </div>
    </form>
  );
}

function QuestionEditor({ question, events, divisions, squads, onSave }: QuestionEditorProps) {
  const [draft, setDraft] = useState<CustomQuestionConfig>(question);
  const optionsText = draft.options.join('\n');

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <label>Question<input value={draft.label} onChange={(eventInput) => setDraft({ ...draft, label: eventInput.target.value })} required /></label>
      <label>
        Field Type
        <select value={draft.type} onChange={(eventInput) => setDraft({ ...draft, type: eventInput.target.value as CustomQuestionConfig['type'] })}>
          <option value="short-text">Short text</option>
          <option value="long-text">Long text</option>
          <option value="number">Number</option>
          <option value="yes-no">Yes/No</option>
          <option value="dropdown">Dropdown</option>
          <option value="multiple-choice">Multiple choice</option>
          <option value="checkbox">Checkbox</option>
          <option value="date">Date</option>
        </select>
      </label>
      {(draft.type === 'dropdown' || draft.type === 'multiple-choice' || draft.type === 'checkbox') && (
        <label>
          Options (one per line)
          <textarea value={optionsText} onChange={(eventInput) => setDraft({ ...draft, options: eventInput.target.value.split('\n').map((option) => option.trim()).filter(Boolean) })} />
        </label>
      )}
      <label>Help Text<textarea value={draft.helpText} onChange={(eventInput) => setDraft({ ...draft, helpText: eventInput.target.value })} /></label>
      <div className={styles.inlineFields}>
        <label><input type="checkbox" checked={draft.required} onChange={(eventInput) => setDraft({ ...draft, required: eventInput.target.checked })} /> Required</label>
        <label><input type="checkbox" checked={draft.enabled} onChange={(eventInput) => setDraft({ ...draft, enabled: eventInput.target.checked })} /> Enabled</label>
      </div>
      <label><input type="checkbox" checked={draft.scope.all} onChange={(eventInput) => setDraft({ ...draft, scope: { ...draft.scope, all: eventInput.target.checked } })} /> Applies to all registrations</label>
      {!draft.scope.all && (
        <>
          <fieldset>
            <legend>Selected Events</legend>
            <div className={styles.checkboxGrid}>
              {events.map((eventOption) => {
                const checked = draft.scope.eventIds.includes(eventOption.id);
                return (
                  <label key={eventOption.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) => ({
                          ...prev,
                          scope: {
                            ...prev.scope,
                            eventIds: checked ? prev.scope.eventIds.filter((id) => id !== eventOption.id) : [...prev.scope.eventIds, eventOption.id],
                          },
                        }));
                      }}
                    />
                    {eventOption.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend>Selected Divisions</legend>
            <div className={styles.checkboxGrid}>
              {divisions.map((division) => {
                const checked = draft.scope.divisionIds.includes(division.id);
                return (
                  <label key={division.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) => ({
                          ...prev,
                          scope: {
                            ...prev.scope,
                            divisionIds: checked ? prev.scope.divisionIds.filter((id) => id !== division.id) : [...prev.scope.divisionIds, division.id],
                          },
                        }));
                      }}
                    />
                    {division.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend>Selected Squads</legend>
            <div className={styles.checkboxGrid}>
              {squads.map((squad) => {
                const checked = draft.scope.squadIds.includes(squad.id);
                return (
                  <label key={squad.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setDraft((prev) => ({
                          ...prev,
                          scope: {
                            ...prev.scope,
                            squadIds: checked ? prev.scope.squadIds.filter((id) => id !== squad.id) : [...prev.scope.squadIds, squad.id],
                          },
                        }));
                      }}
                    />
                    {squad.name}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </>
      )}
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Question</button>
      </div>
    </form>
  );
}

type FeeEditorProps = {
  fee: FeeConfig;
  events: EventConfig[];
  divisions: DivisionConfig[];
  squads: SquadConfig[];
  onSave: (fee: FeeConfig) => void;
};

function FeeEditor({ fee, events, divisions, squads, onSave }: FeeEditorProps) {
  const [draft, setDraft] = useState<FeeConfig>({ ...fee, required: false });

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave({ ...draft, required: false }); }}>
      <label>Name<input value={draft.name} onChange={(eventInput) => setDraft({ ...draft, name: eventInput.target.value })} required /></label>
      <label>Amount (USD)<input type="number" min={0} step="0.01" value={(draft.amountCents / 100).toFixed(2)} onChange={(eventInput) => setDraft({ ...draft, amountCents: Math.round(Number(eventInput.target.value || '0') * 100) })} /></label>
      <div className={styles.inlineFields}>
        <label className={styles.feeEditorHint}>Base entry fees are managed in Events & Divisions.</label>
        <label><input type="checkbox" checked={draft.enabled} onChange={(eventInput) => setDraft({ ...draft, enabled: eventInput.target.checked })} /> Enabled</label>
      </div>
      <fieldset>
        <legend>Applicable Events</legend>
        <div className={styles.checkboxGrid}>
          {events.map((eventOption) => {
            const checked = draft.eventIds.includes(eventOption.id);
            return (
              <label key={eventOption.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setDraft((prev) => ({
                      ...prev,
                      eventIds: checked
                        ? prev.eventIds.filter((id) => id !== eventOption.id)
                        : [...prev.eventIds, eventOption.id],
                    }));
                  }}
                />
                {eventOption.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend>Applicable Divisions</legend>
        <div className={styles.checkboxGrid}>
          {divisions.map((division) => {
            const checked = draft.divisionIds.includes(division.id);
            return (
              <label key={division.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setDraft((prev) => ({
                      ...prev,
                      divisionIds: checked
                        ? prev.divisionIds.filter((id) => id !== division.id)
                        : [...prev.divisionIds, division.id],
                    }));
                  }}
                />
                {division.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend>Applicable Squads</legend>
        <div className={styles.checkboxGrid}>
          {squads.map((squad) => {
            const checked = draft.squadIds.includes(squad.id);
            return (
              <label key={squad.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setDraft((prev) => ({
                      ...prev,
                      squadIds: checked
                        ? prev.squadIds.filter((id) => id !== squad.id)
                        : [...prev.squadIds, squad.id],
                    }));
                  }}
                />
                {squad.name}
              </label>
            );
          })}
        </div>
      </fieldset>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Add-on</button>
      </div>
    </form>
  );
}

type LocationEditorProps = {
  location: LocationConfig;
  onSave: (location: LocationConfig) => void;
};

function LocationEditor({ location, onSave }: LocationEditorProps) {
  const [draft, setDraft] = useState<LocationConfig>(location);

  return (
    <form className={styles.drawerForm} onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <label>Name<input value={draft.name} onChange={(eventInput) => setDraft({ ...draft, name: eventInput.target.value })} required /></label>
      <div className={styles.inlineFields}>
        <label>City<input value={draft.city} onChange={(eventInput) => setDraft({ ...draft, city: eventInput.target.value })} required /></label>
        <label>State<input value={draft.state} onChange={(eventInput) => setDraft({ ...draft, state: eventInput.target.value })} required maxLength={2} /></label>
      </div>
      <label><input type="checkbox" checked={draft.defaultLocation} onChange={(eventInput) => setDraft({ ...draft, defaultLocation: eventInput.target.checked })} /> Default location</label>
      <div className={styles.modalFormFooter}>
        <button type="submit" className={`${styles.primaryAction} ${styles.modalSubmitButton}`}>Save Location</button>
      </div>
    </form>
  );
}
