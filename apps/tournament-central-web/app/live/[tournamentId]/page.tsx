import type { Metadata } from 'next';

import LiveStandingsView from '@/components/live/LiveStandingsView';
import type { LiveView } from '@/components/live/LiveStandingsView';
import { firstParam, isTvParam, loadFirstPayload } from '@/components/live/liveFirstLoad';
import type { LiveSearchParams } from '@/components/live/liveFirstLoad';
import { parseLiveTournamentId } from '@/components/live/liveStandingsPaths';

export const dynamic = 'force-dynamic';

type LivePageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<LiveSearchParams>;
};

export async function generateMetadata({ params }: LivePageProps): Promise<Metadata> {
  const { tournamentId } = await params;
  const first = await loadFirstPayload(parseLiveTournamentId(tournamentId));
  if (first.kind === 'ok') return { title: `${first.data.tournament.name} live standings` };
  return { title: first.kind === 'not-found' ? 'Live standings not available' : 'Live standings' };
}

const VIEWS: LiveView[] = ['standings', 'finals', 'all-events'];

export default async function LiveStandingsPage({ params, searchParams }: LivePageProps) {
  const [{ tournamentId: rawId }, query] = await Promise.all([params, searchParams]);
  const tournamentId = parseLiveTournamentId(rawId);
  const first = await loadFirstPayload(tournamentId);
  const view = firstParam(query, 'view');

  return (
    <LiveStandingsView
      tournamentId={tournamentId ?? 0}
      initialData={first.kind === 'ok' ? first.data : null}
      initialNotFound={first.kind === 'not-found'}
      tv={isTvParam(query)}
      initialView={VIEWS.find((item) => item === view) ?? 'standings'}
    />
  );
}
