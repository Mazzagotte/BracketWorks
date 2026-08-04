import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import '../styles/auth.css';
import PageLayoutShell from '../components/layout/PageLayoutShell';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function VerifyEmailLayout({ children }: { children: ReactNode }) {
  return <PageLayoutShell>{children}</PageLayoutShell>;
}