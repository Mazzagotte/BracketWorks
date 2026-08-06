import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import AuthenticatedPageShell from '../components/authenticated/AuthenticatedPageShell';

export const metadata: Metadata = {
  title: 'Payouts | BracketWorks',
  robots: { index: false, follow: false },
};

export default function PayoutsLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedPageShell>{children}</AuthenticatedPageShell>;
}
