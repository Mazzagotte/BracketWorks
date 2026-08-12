import type { SquadContract } from "./squad";
import type { TournamentContract } from "./tournament";

export interface ImportedPlayerContract {
  full_name: string;
  lane?: string;
  average?: number;
  usbc_number?: string;
  email?: string;
}

export interface ImportedSquadContract extends SquadContract {
  players: ImportedPlayerContract[];
}

export interface TournamentImportPayload {
  source: "tournament-central";
  tournament: TournamentContract;
  squads: ImportedSquadContract[];
}

export interface TournamentImportResult {
  success: boolean;
  tournament_id: number;
  imported_players: number;
  imported_squads: number;
  warnings?: string[];
}