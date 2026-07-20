import type { Metadata } from 'next';
import './styles/landing-global.css';
import {
  LandingHeader,
  HeroSection,
  FeaturesSection,
  LiveViewSection,
  WorkflowSection,
  BenefitsSection,
  TournamentCentralIntegration,
  FinalCtaSection,
  LandingFooter,
} from './components/landing';
import landingStyles from './components/landing/landing.module.css';

export const metadata: Metadata = {
  title: 'Bowling Tournament Management Software | BracketWorks',
  description:
    'BracketWorks helps bowling tournament directors manage entries, brackets, side pots, scores, standings, payouts, and live results from one organized platform.',
  alternates: {
    canonical: 'https://bracketworks.app/',
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords:
    'bowling tournament software, bowling brackets, live score tracking, bowling payouts, tournament director tools, side pots',
  openGraph: {
    title: 'Bowling Tournament Management Software | BracketWorks',
    description:
      'BracketWorks helps bowling tournament directors manage entries, brackets, side pots, scores, standings, payouts, and live results.',
    type: 'website',
    url: 'https://bracketworks.app/',
    siteName: 'BracketWorks',
    images: [
      {
        url: 'https://bracketworks.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BracketWorks Tournament Management Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bowling Tournament Management Software | BracketWorks',
    description: 'Professional tournament management platform for bowling directors.',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'BracketWorks',
  url: 'https://bracketworks.app/',
  logo: 'https://bracketworks.app/BW Logo No Text.svg',
  description: 'Bowling tournament management software for tournament directors',
};

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BracketWorks',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://bracketworks.app/',
  description:
    'BracketWorks helps bowling tournament directors manage entries, brackets, side pots, scores, standings, payouts, and live results.',
};

export default function HomePage() {
  return (
    <div className={landingStyles.page}>
      <a href="#main-content" className={landingStyles.skipLink}>Skip to main content</a>
      
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd),
        }}
      />

      <LandingHeader />

      <main id="main-content">
        <HeroSection />
        <FeaturesSection />
        <LiveViewSection />
        <WorkflowSection />
        <BenefitsSection />
        <TournamentCentralIntegration />
        <FinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}


