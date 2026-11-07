/** Tournament Central to BracketWorks handoff: link status and the send (sync) call. */

export type BracketWorksSyncSummary = {
  dry_run: boolean;
  include_pending: boolean;
  bw_tournament_id: number | null;
  bw_tournament_name: string | null;
  created_tournament: boolean;
  squads_created: number;
  players_created: number;
  players_updated: number;
  unchanged: number;
  skipped: Array<{ name: string; reason: string }>;
  possible_duplicates: Array<{ name: string; bw_player_id: number; bw_name: string; squad: string }>;
  not_in_tc: Array<{ bw_player_id: number; name: string }>;
  squads_needing_regeneration: Array<{ squad_id: number; label: string }>;
};

export type BracketWorksLinkStatus = {
  linked: boolean;
  bw_tournament_id: number | null;
  bw_tournament_name: string | null;
  last_synced_at: string | null;
  last_sync_summary: BracketWorksSyncSummary | null;
};

export const BRACKETWORKS_URL = process.env.NEXT_PUBLIC_BRACKETWORKS_URL || 'https://bracketworks.app';

function errorDetail(body: unknown, fallback: string): string {
  if (body && typeof body === 'object' && 'detail' in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  return fallback;
}

async function request<T>(token: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'include',
  });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(errorDetail(body, `Request failed (${response.status})`));
  }
  return body as T;
}

export function getBracketWorksLink(token: string, tournamentId: number): Promise<BracketWorksLinkStatus> {
  return request(token, `/api/v1/tc/tournaments/${tournamentId}/bracketworks`);
}

export function syncToBracketWorks(
  token: string,
  tournamentId: number,
  options: { dryRun: boolean; includePending: boolean },
): Promise<BracketWorksSyncSummary> {
  return request(token, `/api/v1/tc/tournaments/${tournamentId}/bracketworks/sync`, {
    method: 'POST',
    body: JSON.stringify({ dry_run: options.dryRun, include_pending: options.includePending }),
  });
}
