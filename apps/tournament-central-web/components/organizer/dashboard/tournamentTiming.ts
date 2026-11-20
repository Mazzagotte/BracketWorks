import type { OrganizerDashboardTournament } from './useOrganizerDashboard';

type Dated = Pick<OrganizerDashboardTournament, 'startDate' | 'endDate'>;

/** Today's date as YYYY-MM-DD in the organizer's local time. */
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** Finished once its last day is before today. Undated tournaments count as upcoming. */
export function isPast(tournament: Dated, today: string): boolean {
  const lastDay = tournament.endDate || tournament.startDate;
  return Boolean(lastDay && lastDay < today);
}

/** True when the tournament has at least one date, so a Past or Upcoming label means something. */
export function hasTournamentDate(tournament: Dated): boolean {
  return Boolean(tournament.endDate || tournament.startDate);
}
