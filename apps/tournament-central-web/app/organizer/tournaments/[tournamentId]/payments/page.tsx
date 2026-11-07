import { redirect } from 'next/navigation';

import { organizerRoutes } from '@/components/organizer/organizerRoutes';

// Payments are recorded from the Payment column on the Registrations page.
export default async function PaymentsRedirect({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  redirect(`${organizerRoutes.registrations(tournamentId)}?payment=unpaid`);
}
