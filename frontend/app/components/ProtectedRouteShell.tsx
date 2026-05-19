"use client";

import { ToastProvider } from './Toast';
import { AuthProvider } from '../lib/auth-context';
import { HeaderProvider } from '../lib/header-context';
import AuthAwareLayout from './AuthAwareLayout';

export default function ProtectedRouteShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <HeaderProvider>
        <ToastProvider>
          <AuthAwareLayout>{children}</AuthAwareLayout>
        </ToastProvider>
      </HeaderProvider>
    </AuthProvider>
  );
}