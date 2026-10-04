import TournamentSetupWorkspace from '@/components/organizer/TournamentSetupWorkspace';

type OrganizerTournamentSetupPageProps = {
  params: Promise<{
    tournamentId: string;
  }>;
};

export default async function OrganizerTournamentSetupPage({ params }: OrganizerTournamentSetupPageProps) {
  const { tournamentId } = await params;
  const parsedTournamentId = Number(tournamentId);
  const initialTournamentId = Number.isInteger(parsedTournamentId) && parsedTournamentId > 0 ? parsedTournamentId : null;

  return <TournamentSetupWorkspace initialTournamentId={initialTournamentId} />;
}
