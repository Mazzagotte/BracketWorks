import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';
import type { CustomQuestionConfig, DivisionConfig, EventConfig, FeeConfig, LocationConfig, RegistrationFieldConfig, SquadConfig } from './types';

export type TournamentDetails = {
  name: string;
  subtitle: string;
  series: string;
  certification: string;
  organizer: string;
  tournamentType: string;
  startDateIso: string;
  endDateIso: string;
  venueId: number | null;
  bowlingCenter: string;
  venueAddressLine1: string;
  venueAddressLine2: string;
  city: string;
  state: string;
  venueZip: string;
  venueCountry: string;
  venueLatitude: number | null;
  venueLongitude: number | null;
  venueExternalProvider: string;
  venueExternalPlaceId: string;
  timezone: string;
  visibility: 'public' | 'unlisted' | 'private';
  tournamentStatus: string;
  supportEmail: string;
  supportPhone: string;
  registrationOpenIso: string;
  registrationCloseIso: string;
  logoFileName: string;
};

export type TournamentStatusRecommendation = {
  value: TournamentDetails['tournamentStatus'];
  reason: string;
};

export type PaymentMode = 'unconfigured' | 'cash' | 'stripe';

export type OrganizerDraft = {
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

export type PersistedTournament = {
  id: number;
  name: string;
  venue_id?: number | null;
  venue?: {
    id: number;
    name: string;
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    external_provider?: string | null;
    external_place_id?: string | null;
  } | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  squad_times: Record<string, string[]>;
  is_public: boolean;
  has_logo?: boolean;
  logo_file_name?: string | null;
  logo_mime_type?: string | null;
};

export type TournamentWritePayload = {
  name: string;
  venue_id: number | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  squad_times: Record<string, string[]>;
  is_public: boolean;
};

export type OrganizerSetupPayload = {
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

export type OrganizerSetupStateResponse = {
  id: number;
  tournament_id: number;
  user_id: number;
  payload: OrganizerSetupPayload;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type TournamentTemplate = {
  format: 'tc-tournament-template';
  version: 1;
  exported_at: string;
  payload: OrganizerSetupPayload;
};

export type OrganizerSetupStateSummary = TournamentSetupStateSummaryContract;

export type UserTournamentSummary = TournamentContract;

export type TournamentLogoUploadResponse = {
  ok: boolean;
  tournament_id: number;
  logo_file_name: string | null;
  logo_mime_type: string | null;
};
