import type { ReactNode } from 'react';

import { ToastProvider } from '../components/Toast';
import { AuthProvider } from '../lib/auth-context';
import '../styles/auth.css';

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  );
}