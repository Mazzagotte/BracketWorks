import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Entries | BracketWorks',
  robots: { index: false, follow: false },
};

export default function EntriesLayout({ children }: { children: ReactNode }) {
  return children;
}
