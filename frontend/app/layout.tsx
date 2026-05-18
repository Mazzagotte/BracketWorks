import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './styles/main.css';

import ProtectedRouteShell from './components/ProtectedRouteShell';

const PUBLIC_ROUTE_PREFIXES = ['/login', '/signup', '/reset-password', '/verify-email', '/view'];

function isPublicRoute(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  if (pathname === '/') {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const metadata: Metadata = {
  title: 'BracketWorks - Professional Bowling Tournament Manager',
  description: 'Create and manage bowling tournaments with smart brackets, live scoring, and automatic payouts. Professional tournament management made simple.',
  metadataBase: new URL('https://bracketworks.app'),
  alternates: {
    canonical: 'https://bracketworks.app',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    url: 'https://bracketworks.app',
    title: 'BracketWorks - Professional Bowling Tournament Manager',
    description: 'Create and manage bowling tournaments with smart brackets, live scoring, and automatic payouts.',
    siteName: 'BracketWorks',
    locale: 'en_US',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BracketWorks - Bowling Tournament Manager',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BracketWorks',
    description: 'Professional bowling tournament management platform',
    images: ['/twitter-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  keywords: ['bowling', 'tournament', 'brackets', 'scoring', 'competition', 'bowling league'],
  applicationName: 'BracketWorks',
  category: 'Sports',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerStore = await headers();
  const pathname = headerStore.get('x-pathname');
  const publicRoute = isPublicRoute(pathname);

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
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: 'BracketWorks',
              url: 'https://bracketworks.app',
              description: 'Professional bowling tournament management platform with smart brackets, live scoring, and automatic payouts',
              applicationCategory: 'SportsApplication',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
              },
              image: 'https://bracketworks.app/og-image.png',
              author: {
                '@type': 'Organization',
                name: 'BracketWorks',
                url: 'https://bracketworks.app',
              },
            }),
          }}
        />
      </head>
      <body>
        {publicRoute ? children : <ProtectedRouteShell>{children}</ProtectedRouteShell>}
      </body>
    </html>
  );
}


