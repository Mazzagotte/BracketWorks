import type { StatusTone } from '@bracketworks/ui';

import type { OrganizerDashboardTournament } from './useOrganizerDashboard';

type Dated = Pick<OrganizerDashboardTournament, 'startDate' | 'endDate'>;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A date as YYYY-MM-DD in the organizer's local time. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Finished once its last day is before today. Undated tournaments count as upcoming. */
export function isPast(tournament: Dated, today: string): boolean {
  const lastDay = tournament.endDate || tournament.startDate;
  return Boolean(lastDay && lastDay < today);
}

/** True when the tournament has at least one date. */
export function hasTournamentDate(tournament: Dated): boolean {
  return Boolean(tournament.endDate || tournament.startDate);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / DAY_MS);
}

/** "in 99 days", "Tomorrow", "Today", or "Underway"; null for past or undated tournaments. */
export function countdownLabel(tournament: Dated, today: string): string | null {
  if (!tournament.startDate || isPast(tournament, today)) return null;
  const days = daysBetween(today, tournament.startDate);
  if (days < 0) return 'Underway';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

export type TournamentStage = { label: string; tone: StatusTone };

type Staged = Dated & Pick<
  OrganizerDashboardTournament,
  'hasPublishedSetup' | 'isPublic' | 'registrationOpensAt' | 'registrationClosesAt' | 'spotsTotal' | 'spotsFilled'
>;

/** The opening day as the tournament sees it: the API sends local time with its offset, so read the date part. */
function formatOpensOn(iso: string): string {
  const day = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Where the tournament is in its life, as one badge: Opens <date>, Registration open, Full,
 * Registration closed, or Past. Drafts and private tournaments take no sign-ups, so they show
 * only Upcoming or Past. Undated drafts get nothing.
 */
export function tournamentStage(tournament: Staged, now: Date = new Date()): TournamentStage | null {
  const today = todayIso(now);
  if (isPast(tournament, today)) return { label: 'Past', tone: 'neutral' };

  const takesSignUps = tournament.hasPublishedSetup && tournament.isPublic;
  if (!takesSignUps) {
    return hasTournamentDate(tournament) ? { label: 'Upcoming', tone: 'info' } : null;
  }

  const opensAt = tournament.registrationOpensAt ? Date.parse(tournament.registrationOpensAt) : Number.NaN;
  const closesAt = tournament.registrationClosesAt ? Date.parse(tournament.registrationClosesAt) : Number.NaN;
  if (!Number.isNaN(opensAt) && now.getTime() < opensAt) {
    return { label: `Opens ${formatOpensOn(tournament.registrationOpensAt as string)}`, tone: 'neutral' };
  }
  if (!Number.isNaN(closesAt) && now.getTime() > closesAt) {
    return { label: 'Registration closed', tone: 'warning' };
  }
  if (tournament.spotsTotal && (tournament.spotsFilled ?? 0) >= tournament.spotsTotal) {
    return { label: 'Full', tone: 'warning' };
  }
  return { label: 'Registration open', tone: 'info' };
}
