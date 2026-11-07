import type { LiveFinals, LiveFinalsType, LiveStandings, StandingRow } from '@/components/live/liveStandingsTypes';
import { getJsonErrorDetail } from './organizerApi';

/** Director scoring: the qualifying score grid, standings, and finals (apps/api/app/api/v1/tc_scores.py). */

export type ScoreGridBowler = {
  bowler_id: number;
  name: string;
  average: number | null;
  handicap_per_game: number;
};

export type ScoreGridRow = {
  entry_id: number;
  label: string;
  division: string | null;
  squad: string | null;
  squad_id: string | null;
  bowlers: ScoreGridBowler[];
  /** Keyed by bowler id: one value per game (null = not bowled). */
  scores: Record<string, Array<number | null>>;
  totals: { games_bowled: number; scratch: number; handicap: number; total: number };
};

/** Squad key the API uses for entries without a squad when an event's finals are per squad. */
export const NO_SQUAD_KEY = '__no-squad__';

export type ScoreGridDivision = {
  id: string | null;
  name: string | null;
  /** Set when the event's finals are for each squad: one division entry per squad. */
  squad: { id: string; label: string } | null;
  entry_count: number;
  advancing_count: number | null;
  cashing_count: number | null;
  /** With finals: "Top 2 finishers in the finals cash." or "Places 6-8 cash from qualifying". */
  cash_note: string | null;
};

export type ScoreGridEvent = {
  id: string;
  name: string;
  format: string;
  scoring: string;
  scoring_label: string;
  games: number;
  /** 'squad': each squad has its own standings, cut, cash line, and finals. */
  finals_scope: 'tournament' | 'squad';
  divisions: ScoreGridDivision[];
};

export type ScoreGrid = {
  events: ScoreGridEvent[];
  event_id: string | null;
  squads: Array<{ id: string; label: string }>;
  squad_id: string | null;
  games: number;
  max_game: number;
  /** Scotch doubles and Baker team: one shared score per game, kept on the entry's first bowler. */
  shared_score: boolean;
  rows: ScoreGridRow[];
  updated_at: string | null;
};

export type ScoreChange = {
  entry_id: number;
  bowler_id: number;
  game: number;
  score: number | null;
};

export type FinalsSlot = {
  round: number;
  match: number;
  seed: number;
  name: string;
  label: string;
  /** Score as entered (scratch). */
  score: number | null;
  /** Added to the entered score when the event is handicap. */
  handicap: number;
};

export type FinalsSeed = {
  seed: number;
  key: string;
  name: string;
  entryIds: number[];
  bowlerIds: number[];
  handicapPerGame: number;
  qualifyingTotal: number;
};

export type FinalsState = {
  event_id: string;
  division_id: string | null;
  /** Per-squad finals: the squad key (squad id or NO_SQUAD_KEY) and its label. Null when tournament-wide. */
  squad_id: string | null;
  squad_label: string | null;
  event_name: string;
  division_name: string | null;
  finals_type: LiveFinalsType | 'none' | 'cut';
  started: boolean;
  can_start: boolean;
  advancing_count: number | null;
  qualifiers: StandingRow[];
  seeds: FinalsSeed[];
  finals: LiveFinals | null;
  slots: FinalsSlot[];
};

export type FinalsTarget = {
  event_config_id: string;
  division_config_id: string | null;
  /** Required when the event's finals are for each squad (NO_SQUAD_KEY for entries without one). */
  squad_config_id?: string | null;
};

function targetQuery(target: FinalsTarget): string {
  return query({
    event_config_id: target.event_config_id,
    division_config_id: target.division_config_id,
    squad_config_id: target.squad_config_id,
  });
}

export type FinalsGameChange = {
  round: number;
  match: number;
  seed: number;
  score: number | null;
};

async function request<T>(token: string, url: string, init: RequestInit, fallback: string): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(body, `${fallback} (${response.status})`));
  }
  return body as T;
}

function base(tournamentId: number): string {
  return `/api/v1/tc/tournaments/${tournamentId}`;
}

function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export function fetchScoreGrid(
  token: string,
  tournamentId: number,
  options: { eventId?: string | null; squadId?: string | null } = {},
): Promise<ScoreGrid> {
  const url = `${base(tournamentId)}/scores${query({ event_config_id: options.eventId, squad_config_id: options.squadId })}`;
  return request<ScoreGrid>(token, url, { method: 'GET' }, 'Failed to load scores');
}

export function saveScores(token: string, tournamentId: number, scores: ScoreChange[]): Promise<{ saved: number; updated_at: string | null }> {
  return request(token, `${base(tournamentId)}/scores`, { method: 'PUT', body: JSON.stringify({ scores }) }, 'Failed to save scores');
}

export function fetchStandings(token: string, tournamentId: number): Promise<LiveStandings> {
  return request<LiveStandings>(token, `${base(tournamentId)}/standings`, { method: 'GET' }, 'Failed to load standings');
}

export function fetchFinals(token: string, tournamentId: number, target: FinalsTarget): Promise<FinalsState> {
  const url = `${base(tournamentId)}/finals${targetQuery(target)}`;
  return request<FinalsState>(token, url, { method: 'GET' }, 'Failed to load finals');
}

export function startFinals(token: string, tournamentId: number, target: FinalsTarget): Promise<FinalsState> {
  return request<FinalsState>(token, `${base(tournamentId)}/finals/start`, { method: 'POST', body: JSON.stringify(target) }, 'Failed to start finals');
}

export function saveFinalsGames(token: string, tournamentId: number, target: FinalsTarget, games: FinalsGameChange[]): Promise<FinalsState> {
  return request<FinalsState>(
    token,
    `${base(tournamentId)}/finals/games`,
    { method: 'PUT', body: JSON.stringify({ ...target, games }) },
    'Failed to save finals scores',
  );
}

export async function resetFinals(token: string, tournamentId: number, target: FinalsTarget): Promise<void> {
  const url = `${base(tournamentId)}/finals${targetQuery(target)}`;
  await request(token, url, { method: 'DELETE' }, 'Failed to reset finals');
}
