import type { ReactNode } from 'react';
import type { Metadata } from 'next';

import '../styles/auth.css';
import './styles/reset-password.css';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: true,
  },
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}