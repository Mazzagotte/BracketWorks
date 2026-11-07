import { redirect } from 'next/navigation';

import { organizerRoutes } from '@/components/organizer/organizerRoutes';

// Bowlers are listed on the Registrations page (List by: Bowlers).
export default async function ParticipantsRedirect({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  redirect(`${organizerRoutes.registrations(tournamentId)}?view=bowlers`);
}
