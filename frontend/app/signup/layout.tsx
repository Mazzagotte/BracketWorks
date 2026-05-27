import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import '../styles/auth.css';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}