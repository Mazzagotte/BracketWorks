/* Server-side first payload for the public live pages (standings and finals). No 'use client'. */

import { liveStandingsPath } from './liveStandingsPaths';
import type { LiveStandings } from './liveStandingsTypes';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001')
  .replace(/\/+$/, '');

export type FirstLoad =
  | { kind: 'ok'; data: LiveStandings }
  | { kind: 'not-found' }
  /** The API could not be reached; the page loads in the browser and keeps retrying. */
  | { kind: 'unavailable' };

/** First payload for a fast first paint. Next memoizes this fetch, so metadata and the page share it. */
export async function loadFirstPayload(tournamentId: number | null): Promise<FirstLoad> {
  if (tournamentId === null) return { kind: 'not-found' };
  try {
    const response = await fetch(`${backendUrl}${liveStandingsPath(tournamentId)}`, { cache: 'no-store' });
    if (response.status === 404) return { kind: 'not-found' };
    if (!response.ok) return { kind: 'unavailable' };
    return { kind: 'ok', data: (await response.json()) as LiveStandings };
  } catch {
    return { kind: 'unavailable' };
  }
}

export type LiveSearchParams = Record<string, string | string[] | undefined>;

/** The first value of a query parameter. */
export function firstParam(query: LiveSearchParams, name: string): string | undefined {
  const value = query[name];
  return Array.isArray(value) ? value[0] : value;
}

export function isTvParam(query: LiveSearchParams): boolean {
  const tv = firstParam(query, 'tv');
  return tv === '1' || tv === 'true';
}
