import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Public Tournaments | BracketWorks',
  description: 'Browse published BracketWorks bowling tournaments and live results.',
  alternates: { canonical: 'https://bracketworks.app/view' },
};

export default function PublicViewLayout({ children }: { children: React.ReactNode }) {
  return children
}
