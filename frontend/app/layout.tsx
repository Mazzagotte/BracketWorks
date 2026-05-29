import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './styles/main.css';

import { ToastProvider } from './components/Toast';
import { AuthProvider } from './lib/auth-context';
import { HeaderProvider } from './lib/header-context';

import AuthAwareLayout from '../components/AuthAwareLayout';

const backendOrigin = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const structuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://bracketworks.app/#organization',
      name: 'BracketWorks',
      url: 'https://bracketworks.app',
      logo: 'https://bracketworks.app/icons/icon-192.png',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://bracketworks.app/#website',
      name: 'BracketWorks',
      url: 'https://bracketworks.app',
      publisher: {
        '@id': 'https://bracketworks.app/#organization',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://bracketworks.app/#webapp',
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
        '@id': 'https://bracketworks.app/#organization',
      },
      isPartOf: {
        '@id': 'https://bracketworks.app/#website',
      },
    },
  ],
});

export const metadata: Metadata = {
  title: 'BracketWorks - Professional Bowling Tournament Manager',
  description: 'Create and manage bowling tournaments with smart brackets, live scoring, and automatic payouts. Professional tournament management made simple.',
  metadataBase: new URL('https://bracketworks.app'),
  alternates: {
    canonical: 'https://bracketworks.app/',
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
    url: 'https://bracketworks.app/',
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

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: 'var(--color-primary)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BracketWorks" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        
        {/* Performance optimizations */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        
        {/* Preconnect to backend API */}
        <link rel="preconnect" href={backendOrigin} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={backendOrigin} />
        
        <link rel="manifest" href="/manifest.json" />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: structuredData,
          }}
        />
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


