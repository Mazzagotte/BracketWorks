import type { ReactNode } from 'react';
import './styles/globals.css';
import './styles/colors.global.css';
import './styles/login.css';
import './styles/bowling-animations.css';
import styles from './layout.module.css';

import ModernHeader from './components/ModernHeader';
import { ToastProvider } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './lib/auth-context';
import { HeaderProvider } from './lib/header-context';
import { DevAuthStatus } from './components/DevAuthStatus';
import { TimeSlotReminderModal } from './components/TimeSlotReminderModal';

import AuthAwareLayout from '../components/AuthAwareLayout';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />
        <meta name="theme-color" content="var(--color-primary)" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BracketWorks" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        
        {/* Preconnect to backend API */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'} />
        
        {/* Favicon configuration */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        
        {/* Additional favicon sizes for better compatibility */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-192.png" />
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


