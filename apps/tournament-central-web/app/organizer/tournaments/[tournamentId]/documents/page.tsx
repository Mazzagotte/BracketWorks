import { redirect } from 'next/navigation';

import { organizerRoutes } from '@/components/organizer/organizerRoutes';

// Documents are managed in Setup, on the "Add-ons, payments, and documents" step.
export default async function DocumentsRedirect({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  redirect(organizerRoutes.setup(tournamentId, 'fees-payments-documents'));
}
