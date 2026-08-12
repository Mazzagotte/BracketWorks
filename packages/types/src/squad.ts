import type { TournamentId } from "./tournament";

export type SquadId = number;

export interface SquadContract {
  id: SquadId;
  name?: string;
  tournament_id?: TournamentId;
  date: string;
  time: string;
  max_players?: number;
  game_count?: number;
  status?: string;
  starts_at?: string;
  lane_count?: number;
  created_at?: string;
}