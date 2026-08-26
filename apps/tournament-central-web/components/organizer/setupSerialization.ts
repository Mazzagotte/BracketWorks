import { buildSquadDisplayName, buildSquadTimesPayload } from './setupFormatting';
import { normalizeSquadDefaults } from './setupFactories';
import { DRAFT_VERSION, defaultTournamentDetails, getDraftStorageKey } from './setupDefaults';
import { initialRegistrationFields } from './setupConfig';
import type {
  CustomQuestionConfig,
  DivisionConfig,
  EventConfig,
  FeeConfig,
  LocationConfig,
  RegistrationFieldConfig,
  SquadConfig,
} from './types';
import type {
  OrganizerDraft,
  OrganizerSetupPayload,
  PaymentMode,
  TournamentDetails,
  TournamentStatusRecommendation,
  TournamentWritePayload,
  UserTournamentSummary,
} from './setupTypes';

export type LegacyEventConfig = Omit<EventConfig, 'scoring'> & {
  scoring: EventConfig['scoring'] | 'both';
};

function normalizeTimezone(value: string | undefined): string {
  return (value || defaultTournamentDetails.timezone).replace(/\s+\([^)]*\)$/, '');
}

export function normalizeSquadConfig(squad: SquadConfig, defaults?: { locationName?: string; registrationDeadlineIso?: string | null }): SquadConfig {
  const normalizedDefaults = normalizeSquadDefaults(defaults ?? {});
  const normalizedRequiredBowlerCount = Number.isFinite(Number(squad.requiredBowlerCount))
    ? Math.max(1, Math.round(Number(squad.requiredBowlerCount)))
    : 1;

  return {
    ...squad,
    name: buildSquadDisplayName(squad),
    requiredBowlerCount: normalizedRequiredBowlerCount,
    locationName: normalizedDefaults.locationName || squad.locationName?.trim() || '',
    registrationDeadlineIso: normalizedDefaults.registrationDeadlineIso || squad.registrationDeadlineIso || null,
  };
}

export function normalizeSquadList(squads: SquadConfig[], defaults?: { locationName?: string; registrationDeadlineIso?: string | null }): SquadConfig[] {
  return squads.map((squad) => normalizeSquadConfig(squad, defaults));
}

export function normalizeEventConfig(event: LegacyEventConfig): EventConfig {
  const connectedDivisionIds = Array.isArray(event.connectedDivisionIds) ? event.connectedDivisionIds : [];
  const connectedSquadIds = Array.isArray(event.connectedSquadIds) ? event.connectedSquadIds : [];

  return {
    ...event,
    connectedDivisionIds,
    connectedSquadIds,
    scoring: event.scoring === 'both' ? 'no-tap' : event.scoring,
    enabled: event.enabled !== false,
    requireDivision: Boolean(event.requireDivision),
    requireSquad: Boolean(event.requireSquad),
  };
}

export function normalizeEventList(events: LegacyEventConfig[]): EventConfig[] {
  return events.map(normalizeEventConfig);
}

export function normalizeRegistrationFieldsList(fields: RegistrationFieldConfig[] | null | undefined): RegistrationFieldConfig[] {
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

export const builtInRegistrationFieldKeys = new Set(initialRegistrationFields.map((field) => field.key));

export function reorderItemsByDropTarget<T extends { id: string; displayOrder: number }>(items: T[], draggedId: string, targetId: string): T[] {
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

export function buildDefaultDraft(): OrganizerDraft {
  return {
    version: DRAFT_VERSION,
    tournamentId: null,
    details: defaultTournamentDetails,
    events: [],
    divisions: [],
    squads: [],
    fees: [],
    locations: [],
    questions: [],
    fields: initialRegistrationFields,
    hasRulesDocument: false,
    paymentMode: 'cash',
    paymentProcessorConnected: false,
    paymentPayoutConfigured: true,
  };
}

export function loadDraftFromStorage(): OrganizerDraft {
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
      timezone: normalizeTimezone(parsed.details?.timezone),
      registrationOpenTime: parsed.details?.registrationOpenTime || '00:00',
      registrationCloseTime: parsed.details?.registrationCloseTime || '23:59',
      contactName: parsed.details?.contactName || parsed.details?.organizer || '',
      preferredContactMethod: parsed.details?.preferredContactMethod || 'email',
    };

    return {
      version: DRAFT_VERSION,
      tournamentId: typeof parsed.tournamentId === 'number' ? parsed.tournamentId : null,
      details: normalizedDetails,
      events: Array.isArray(parsed.events) ? normalizeEventList(parsed.events as EventConfig[]) : [],
      divisions: Array.isArray(parsed.divisions) ? parsed.divisions : [],
      squads: Array.isArray(parsed.squads)
        ? normalizeSquadList(parsed.squads as SquadConfig[], {
          locationName: normalizedDetails.bowlingCenter,
          registrationDeadlineIso: normalizedDetails.registrationCloseIso,
        })
        : [],
      fees: Array.isArray(parsed.fees) ? parsed.fees : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
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

export function buildTournamentLocation(details: TournamentDetails): string {
  const parts = [details.bowlingCenter, details.city, details.state]
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join(', ');
}

export function parseTournamentLocation(location: string | null | undefined): { bowlingCenter: string; city: string; state: string } {
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

export function toDraftFromTournament(tournament: UserTournamentSummary): OrganizerDraft {
  const location = parseTournamentLocation(tournament.location);
  const venue = tournament.venue || null;
  const draft = buildDefaultDraft();

  return {
    ...draft,
    tournamentId: tournament.id,
    details: {
      ...draft.details,
      name: tournament.name || draft.details.name,
      venueId: typeof tournament.venue_id === 'number' ? tournament.venue_id : null,
      bowlingCenter: (venue?.name || location.bowlingCenter || draft.details.bowlingCenter),
      venueAddressLine1: venue?.address_line_1 || '',
      venueAddressLine2: venue?.address_line_2 || '',
      city: (venue?.city || location.city || draft.details.city),
      state: (venue?.state || location.state || draft.details.state),
      venueZip: venue?.zip || '',
      venueCountry: venue?.country || 'US',
      venueLatitude: venue?.latitude ?? null,
      venueLongitude: venue?.longitude ?? null,
      venueExternalProvider: venue?.external_provider || '',
      venueExternalPlaceId: venue?.external_place_id || '',
      startDateIso: tournament.start_date || draft.details.startDateIso,
      endDateIso: tournament.end_date || draft.details.endDateIso,
      visibility: tournament.is_public ? 'public' : 'private',
      tournamentStatus: tournament.is_public ? 'active' : 'draft',
      logoFileName: tournament.logo_file_name || '',
    },
  };
}

export function buildTournamentPayload(details: TournamentDetails, squads: SquadConfig[], isPublic: boolean): TournamentWritePayload {
  const location = buildTournamentLocation(details);

  return {
    name: details.name.trim() || 'Untitled Tournament',
    venue_id: details.venueId,
    location: location || null,
    start_date: details.startDateIso.trim() || null,
    end_date: details.endDateIso.trim() || null,
    squad_times: buildSquadTimesPayload(squads),
    is_public: isPublic,
  };
}

export function recommendTournamentStatus(params: {
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

export function buildOrganizerSetupPayload(input: {
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
    details: {
      ...input.details,
      name: input.details.name.trim(),
      subtitle: input.details.subtitle.trim(),
      organizer: input.details.organizer.trim(),
      supportEmail: input.details.supportEmail.trim(),
      supportPhone: input.details.supportPhone.trim(),
      contactName: input.details.contactName.trim(),
      contactRole: input.details.contactRole.trim(),
      contactNote: input.details.contactNote.trim(),
    },
    events: input.events,
    divisions: input.divisions,
    squads: input.squads.map((squad) => ({
      ...squad,
      name: buildSquadDisplayName(squad),
      locationName: input.details.bowlingCenter.trim(),
      registrationDeadlineIso: input.details.registrationCloseIso || null,
    })),
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

export function normalizeOrganizerDraft(params: {
  tournamentId: number | null;
  payload: Partial<OrganizerSetupPayload>;
}): OrganizerDraft {
  const { tournamentId, payload } = params;

  const normalizedDetails = {
    ...defaultTournamentDetails,
    ...(payload.details ?? {}),
    timezone: normalizeTimezone(payload.details?.timezone),
    registrationOpenTime: payload.details?.registrationOpenTime || '00:00',
    registrationCloseTime: payload.details?.registrationCloseTime || '23:59',
    contactName: payload.details?.contactName || payload.details?.organizer || '',
    preferredContactMethod: payload.details?.preferredContactMethod || 'email',
  };

  return {
    version: DRAFT_VERSION,
    tournamentId,
    details: normalizedDetails,
    events: Array.isArray(payload.events) ? normalizeEventList(payload.events as EventConfig[]) : [],
    divisions: Array.isArray(payload.divisions) ? payload.divisions : [],
    squads: Array.isArray(payload.squads)
      ? normalizeSquadList(payload.squads as SquadConfig[], {
        locationName: normalizedDetails.bowlingCenter,
        registrationDeadlineIso: normalizedDetails.registrationCloseIso,
      })
      : [],
    fees: Array.isArray(payload.fees) ? payload.fees : [],
    locations: Array.isArray(payload.locations) ? payload.locations : [],
    questions: Array.isArray(payload.questions) ? payload.questions : [],
    fields: normalizeRegistrationFieldsList(payload.fields as RegistrationFieldConfig[] | undefined),
    hasRulesDocument: Boolean(payload.hasRulesDocument),
    paymentMode: 'cash',
    paymentProcessorConnected: Boolean(payload.paymentProcessorConnected),
    paymentPayoutConfigured: payload.paymentPayoutConfigured === undefined ? true : Boolean(payload.paymentPayoutConfigured),
  };
}
