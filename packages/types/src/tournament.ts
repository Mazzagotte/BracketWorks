export type TournamentId = number;

export type IsoDateString = string;
export type IsoDateTimeString = string;

export interface TournamentContract {
  id: TournamentId;
  name: string;
  venue_id?: number | null;
  location?: string | null;
  start_date?: IsoDateString | null;
  end_date?: IsoDateString | null;
  squad_times?: Record<string, string[]>;
  is_public?: boolean;
  has_logo?: boolean;
  logo_file_name?: string | null;
  logo_mime_type?: string | null;
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
    phone?: string | null;
    website?: string | null;
  } | null;
  entry_count?: number;
  brackets_configured?: boolean;
}

export interface TournamentSetupStateSummaryContract {
  tournament_id: TournamentId;
  tournament_name: string;
  tournament_location: string | null;
  tournament_start_date: IsoDateString | null;
  tournament_end_date: IsoDateString | null;
  is_published: boolean;
  created_at: IsoDateTimeString;
  updated_at: IsoDateTimeString;
}

export interface PublicTournamentDirectoryItem {
  id: number | string;
  name: string;
  slug?: string;
  location: string | null;
  venue?: {
    id: number;
    name: string;
    city?: string | null;
    state?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  latitude?: number | null;
  longitude?: number | null;
  state_code?: string | null;
  state_name?: string | null;
  start_date: IsoDateString | null;
  end_date: IsoDateString | null;
  squad_count?: number;
  public_url?: string | null;
  registration_url?: string | null;
  has_logo?: boolean;
  logo_url?: string | null;
  last_activity_at?: IsoDateTimeString | null;
  live_fingerprint?: string | null;
}

export interface PublicTournamentDirectoryResponse {
  tournaments?: PublicTournamentDirectoryItem[];
}