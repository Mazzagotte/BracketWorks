export const organizerRoutes = {
  dashboard: '/organizer',
  account: '/organizer/account',
  newTournamentSetup: '/organizer/tournaments/new/setup',
  overview: (tournamentId: number | string) => tournamentRoute(tournamentId),
  registrations: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/registrations`,
  squads: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/squads`,
  participants: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/participants`,
  payments: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/payments`,
  documents: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/documents`,
  team: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/team`,
  activity: (tournamentId: number | string) => `${tournamentRoute(tournamentId)}/activity`,
  setup: (tournamentId: number | string, section?: string) => {
    const path = `${tournamentRoute(tournamentId)}/setup`;
    return section ? `${path}?section=${encodeURIComponent(section)}` : path;
  },
} as const;

function tournamentRoute(tournamentId: number | string): string {
  return `/organizer/tournaments/${encodeURIComponent(String(tournamentId))}`;
}

export function isOrganizerRouteActive(pathname: string, href: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/u, '') || '/';
  const normalizedHref = href.split('?', 1)[0].replace(/\/+$/u, '') || '/';
  if (normalizedPath === normalizedHref) return true;
  if (/^\/organizer\/tournaments\/[^/]+$/u.test(normalizedHref)) return false;
  return normalizedHref !== '/organizer' && normalizedPath.startsWith(`${normalizedHref}/`);
}
