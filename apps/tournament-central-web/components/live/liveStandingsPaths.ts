/* Shared by the live page's server component and its client hook (no 'use client' here). */

export function liveStandingsPath(tournamentId: number): string {
  return `/api/v1/public/tc-tournament/${tournamentId}/standings`;
}

/** The public page path for a tournament, for example "/live/tc-58". */
export function livePagePath(tournamentId: number | string): string {
  const id = String(tournamentId).replace(/^tc-/i, '');
  return `/live/tc-${id}`;
}

/** Accepts "58" or "tc-58"; returns null for anything else. */
export function parseLiveTournamentId(value: string | undefined | null): number | null {
  const match = /^(?:tc-)?([1-9]\d{0,9})$/i.exec((value ?? '').trim());
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}


/** The public finals page path, for example "/live/tc-58/finals". */
export function liveFinalsPagePath(tournamentId: number | string): string {
  return `${livePagePath(tournamentId)}/finals`;
}
