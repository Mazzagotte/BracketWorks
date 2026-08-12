import type { SquadId } from "./squad";
import type { IsoDateString, TournamentId } from "./tournament";

export interface RegistrationQuestionOption {
  value: string;
  label: string;
}

export interface RegistrationQuestion {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "tel" | "select" | "checkbox";
  required: boolean;
  placeholder?: string;
  options?: RegistrationQuestionOption[];
}

export interface PublicRegistrationPricing {
  currency: string;
  amount_cents: number;
  processing_fee_cents?: number;
  total_amount_cents?: number;
  effective_date?: IsoDateString;
}

export interface PublicTournamentRegistrationConfig {
  tournament_id: TournamentId;
  tournament_name: string;
  registration_open: boolean;
  registration_questions: RegistrationQuestion[];
  pricing?: PublicRegistrationPricing;
  available_squads?: Array<{
    id: SquadId;
    date: string;
    time: string;
    max_players: number;
  }>;
}

export interface PublicRegistrationSubmission {
  tournament_id: TournamentId;
  squad_id: SquadId;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  usbc_number?: string;
  average?: number;
  custom_answers?: Record<string, string | number | boolean>;
}

export interface PublicRegistrationSubmissionResult {
  registration_id: number;
  status: "pending" | "confirmed" | "waitlisted";
  message?: string;
}