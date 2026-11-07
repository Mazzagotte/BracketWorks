import type { Metadata } from 'next';

import LiveFinalsView from '@/components/live/LiveFinalsView';
import { firstParam, isTvParam, loadFirstPayload } from '@/components/live/liveFirstLoad';
import type { LiveSearchParams } from '@/components/live/liveFirstLoad';
import { parseLiveTournamentId } from '@/components/live/liveStandingsPaths';

export const dynamic = 'force-dynamic';

type LiveFinalsPageProps = {
  params: Promise<{ tournamentId: string }>;
  searchParams: Promise<LiveSearchParams>;
};

export async function generateMetadata({ params }: LiveFinalsPageProps): Promise<Metadata> {
  const { tournamentId } = await params;
  const first = await loadFirstPayload(parseLiveTournamentId(tournamentId));
  if (first.kind === 'ok') return { title: `${first.data.tournament.name} live finals` };
  return { title: first.kind === 'not-found' ? 'Live finals not available' : 'Live finals' };
}

export default async function LiveFinalsPage({ params, searchParams }: LiveFinalsPageProps) {
  const [{ tournamentId: rawId }, query] = await Promise.all([params, searchParams]);
  const tournamentId = parseLiveTournamentId(rawId);
  const first = await loadFirstPayload(tournamentId);

  return (
    <LiveFinalsView
      tournamentId={tournamentId ?? 0}
      initialData={first.kind === 'ok' ? first.data : null}
      initialNotFound={first.kind === 'not-found'}
      tv={isTvParam(query)}
      initialSelection={{
        event: firstParam(query, 'event') ?? null,
        division: firstParam(query, 'division') ?? null,
        squad: firstParam(query, 'squad') ?? null,
      }}
    />
  );
}
