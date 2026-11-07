import { redirect } from 'next/navigation';

import { organizerRoutes } from '@/components/organizer/organizerRoutes';

// Squad capacity and availability are on the tournament overview.
export default async function SquadsRedirect({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  redirect(organizerRoutes.overview(tournamentId));
}
