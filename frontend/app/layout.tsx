import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './styles/main.css';
import styles from './layout.module.css';

import ModernHeader from './components/ModernHeader';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './lib/auth-context';
import { HeaderProvider } from './lib/header-context';
import { DevAuthStatus } from './components/DevAuthStatus';
import { TimeSlotReminderModal } from './components/TimeSlotReminderModal';

import AuthAwareLayout from '../components/AuthAwareLayout';

export const metadata: Metadata = {
  title: 'BracketWorks',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="theme-color" content="var(--color-primary)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BracketWorks" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        
        {/* Preconnect to backend API */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'} />
        
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <AuthProvider>
          <HeaderProvider>
            <ToastProvider>
              <AuthAwareLayout>{children}</AuthAwareLayout>
            </ToastProvider>
          </HeaderProvider>
        </AuthProvider>
      </body>
    </html>
  );
}


