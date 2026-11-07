import type { Metadata } from 'next';

import LiveStandingsView from '@/components/live/LiveStandingsView';
import { liveStandingsPath, parseLiveTournamentId } from '@/components/live/liveStandingsPaths';
import type { LiveStandings } from '@/components/live/liveStandingsTypes';

const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001')
  .replace(/\/+$/, '');

export const dynamic = 'force-dynamic';

type LivePageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type FirstLoad =
  | { kind: 'ok'; data: LiveStandings }
  | { kind: 'not-found' }
  /** The API could not be reached; the page loads in the browser and keeps retrying. */
  | { kind: 'unavailable' };

/** First payload for a fast first paint. Next memoizes this fetch, so metadata and the page share it. */
async function loadFirstPayload(tournamentId: number | null): Promise<FirstLoad> {
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

export async function generateMetadata({ params }: LivePageProps): Promise<Metadata> {
  const { tournamentId } = await params;
  const first = await loadFirstPayload(parseLiveTournamentId(tournamentId));
  if (first.kind === 'ok') return { title: `${first.data.tournament.name} live standings` };
  return { title: first.kind === 'not-found' ? 'Live standings not available' : 'Live standings' };
}

export default async function LiveStandingsPage({ params, searchParams }: LivePageProps) {
  const [{ tournamentId: rawId }, query] = await Promise.all([params, searchParams]);
  const tournamentId = parseLiveTournamentId(rawId);
  const first = await loadFirstPayload(tournamentId);
  const tvParam = Array.isArray(query.tv) ? query.tv[0] : query.tv;

  return (
    <LiveStandingsView
      tournamentId={tournamentId ?? 0}
      initialData={first.kind === 'ok' ? first.data : null}
      initialNotFound={first.kind === 'not-found'}
      tv={tvParam === '1' || tvParam === 'true'}
    />
  );
}
