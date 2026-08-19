import TournamentSetupWorkspace from '@/components/organizer/TournamentSetupWorkspace';

type OrganizerTournamentSetupPageProps = {
  params: {
    tournamentId: string;
  };
};

export default function OrganizerTournamentSetupPage({ params }: OrganizerTournamentSetupPageProps) {
  const parsedTournamentId = Number(params.tournamentId);
  const initialTournamentId = Number.isInteger(parsedTournamentId) && parsedTournamentId > 0 ? parsedTournamentId : null;

  return <TournamentSetupWorkspace initialTournamentId={initialTournamentId} />;
}
