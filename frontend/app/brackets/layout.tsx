import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import PageLayoutShell from '../components/layout/PageLayoutShell';

export const metadata: Metadata = {
  title: 'Brackets | BracketWorks',
  robots: { index: false, follow: false },
};

export default function BracketsLayout({ children }: { children: ReactNode }) {
  return <PageLayoutShell>{children}</PageLayoutShell>;
}
