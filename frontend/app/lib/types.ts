// Central type definitions for the application

// Tournament related types
export interface Tournament {
  id: number;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  squad_times?: Record<string, string[]>;
}

export interface Squad {
  id: number;
  name: string;
  tournament_id?: number;
  date?: string;
  time: string;
}

// Player related types
export interface Player {
  id: number;
  usbc?: string;
  firstName: string;
  lastName: string;
  name?: string; // Sometimes used as full name
  average: number;
  handicap: number;
  scratch?: number;
  lane?: string | number | null;
  division?: string;
  totalCost?: number;
  amountPaid?: number;
  squad?: Squad;
  bowler_id?: number;
  player_id?: number;
  scores?: {
    game1_scratch?: number;
    game1_total?: number;
    game2_scratch?: number;
    game2_total?: number;
    game3_scratch?: number;
    game3_total?: number;
  };
}

// Bracket related types
export interface Match {
  seedA?: number;
  seedB?: number;
  playerA?: string;
  playerB?: string;
  scoreA?: number;
  scoreB?: number;
  match_score_a?: number; // Legacy field
  match_score_b?: number; // Legacy field
  winner?: 'A' | 'B' | null;
  status?: 'pending' | 'in_progress' | 'completed' | 'tied' | 'both_advance' | 'next_up';
  matchStatus?: 'pending' | 'in_progress' | 'completed' | 'tied' | 'both_advance' | 'next_up';
  both_advance?: boolean;
  split_pot?: boolean;
  eliminated_player?: 'A' | 'B' | null;
  elimination_notes?: string | null;
}

export interface BracketRound {
  name: string;
  matches: Match[];
}

export interface BracketData {
  id?: number;
  name?: string;
  title?: string;
  players?: Player[];
  type?: string;
  rounds?: BracketRound[];
}

export interface MultipleBracketsData {
  scratch_brackets?: BracketData[];
  handicap_brackets?: BracketData[];
}

export interface BracketResponse {
  scratch_brackets?: BracketData[];
  handicap_brackets?: BracketData[];
  multiple_brackets?: MultipleBracketsData;
}

export interface BracketSettings {
  id?: number;
  tournament_id: number;
  scratch_brackets?: BracketData[];
  handicap_brackets?: BracketData[];
  bracket_size: number;
  cost_per_bracket: number;
  first_place: number;
  second_place: number;
  house_amount: number;
  handicap_percentage: number;
  handicap_base: number;
}

// Score related types
export interface PendingScoreSave {
  token: string;
  data: {
    bowler_id: number;
    tournament_id: number;
    squad_id: number;
    game1_scratch: number;
    game2_scratch: number;
    game3_scratch: number;
  };
}

export interface ScoreData {
  id: number;
  player_id: number;
  squad_id: number;
  score?: number;
  game_number?: number;
  bowler_id: number;
  game1_scratch?: number;
  game1_total?: number;
  game2_scratch?: number;
  game2_total?: number;
  game3_scratch?: number;
  game3_total?: number;
}

// Winner related types
export interface WinnerData {
  id: number;
  player_id: number;
  bracket_id: number;
  position: number | string;
  payout: number;
  bracket_name?: string;
  bracket_type?: string;
  payout_amount?: number;
  place?: number;
}

// UI related types
export type SavingStatus = 'idle' | 'saving' | 'success' | 'error';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

// Form related types
export interface TournamentForm {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  squad_times: Record<string, string[]>;
  user_id?: number;
}

export interface ToastMessage {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

// Performance monitoring types
export interface PerformanceMetrics {
  [key: string]: number | string | boolean;
}

// Error types
export interface ErrorDetails {
  [key: string]: unknown;
}
