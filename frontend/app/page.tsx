import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'BracketWorks - Professional Bowling Tournament Management Software',
  description: 'Create tournament brackets, track live scores, and calculate payouts automatically. The #1 bowling tournament management platform for leagues and competitions.',
  keywords: 'bowling tournament software, tournament bracket management, bowling league management, score tracking, payout calculator, tournament manager',
  openGraph: {
    title: 'BracketWorks - Professional Bowling Tournament Manager',
    description: 'Create smart tournament brackets, track live scores, and calculate payouts automatically for bowling tournaments',
    type: 'website',
    url: 'https://bracketworks.app',
    images: [
      {
        url: 'https://bracketworks.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BracketWorks Tournament Management Platform',
      },
    ],
  },
};

export default function HomePage() {
  const features = [
    {
      title: 'Smart Bracket Engine',
      body: 'Generate brackets instantly with clean seeding, bracket-aware progression, and support for the formats your tournaments already use.',
      tag: 'Brackets',
    },
    {
      title: 'Live Score Control',
      body: 'Keep scores current as games finish and advance winners in real time, so bowlers and staff always see the latest board.',
      tag: 'Scoring',
    },
    {
      title: 'Automatic Payout Logic',
      body: 'Calculate distributions from your configured prize pools without spreadsheets or manual math at the end of the night.',
      tag: 'Payouts',
    },
    {
      title: 'Tournament Audit Trail',
      body: 'Track meaningful score and settings changes with a clear activity history built for transparency and confidence.',
      tag: 'Integrity',
    },
    {
      title: 'Built For Mobile Floors',
      body: 'Run operations from desk, counter, or lanes with a touch-friendly interface that stays fast on phones and tablets.',
      tag: 'Mobile',
    },
    {
      title: 'League-Ready Workflow',
      body: 'Move from setup to results using a connected workflow across tournament settings, entries, scoring, and payouts.',
      tag: 'Workflow',
    },
  ];

  const steps = [
    {
      title: 'Configure Tournament',
      text: 'Create your event, define bracket size, and set fees and payout rules in a guided dashboard flow.',
    },
    {
      title: 'Add Players And Squads',
      text: 'Register bowlers quickly, keep squads organized, and prepare the event board before games begin.',
    },
    {
      title: 'Run Live Scoring',
      text: 'Enter scores, resolve outcomes, and keep bracket progression synchronized across every round.',
    },
    {
      title: 'Finalize Results',
      text: 'Generate payout outcomes and share polished tournament results with confidence.',
    },
  ];

  return (
    <div className={styles.container}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.kicker}>Tournament Ops Platform</p>
            <h1 className={styles.heroTitle}>
              Tournament Operations, In One Interface
            </h1>
            <p className={styles.heroSubtitle}>
              Configure events, manage entries, update scores, and finalize payouts without switching tools.
            </p>
            <div className={styles.heroCTA}>
              <Link href="/signup" className="ds-btn ds-btn-primary ds-btn-lg">
                Start Free
              </Link>
              <Link href="/login" className="ds-btn ds-btn-secondary ds-btn-lg">
                Sign In
              </Link>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Core Areas</span>
                <span className={styles.statValue}>4</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Access</span>
                <span className={styles.statValue}>Mobile And Desktop</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statLabel}>Workflow</span>
                <span className={styles.statValue}>Setup To Closeout</span>
              </div>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.heroPanelHeader}>
              <Image
                src="/logo.svg"
                alt="BracketWorks"
                width={96}
                height={96}
                className={styles.heroLogo}
                priority
              />
              <div>
                <h2 className={styles.heroPanelTitle}>BracketWorks</h2>
                <p className={styles.heroPanelText}>Built for bowling tournament directors and staff.</p>
              </div>
            </div>
            <ul className={styles.panelList}>
              <li>Bracket creation with predictable progression</li>
              <li>Score entry and winner advancement in real time</li>
              <li>Payout calculations from configured event rules</li>
              <li>Clear flow from tournament setup through final results</li>
            </ul>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Everything You Need On Tournament Day</h2>
          <p className={styles.sectionSubtitle}>
            A single product surface for bracket setup, live operations, and payout finalization.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map(feature => (
            <article key={feature.title} className={styles.featureCard}>
              <span className={styles.featureTag}>{feature.tag}</span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.howItWorks}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
        </div>

        <div className={styles.stepsGrid}>
          {steps.map((step, index) => (
            <article key={step.title} className={styles.step}>
              <div className={styles.stepNumber}>{index + 1}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.benefits}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Why Organizers Choose BracketWorks</h2>
        </div>

        <div className={styles.benefitsList}>
          <article className={styles.benefit}>
            <h3>Reduce Administrative Overhead</h3>
            <p>
              Replace disconnected tools with one operational surface for tournament settings, brackets, scores, and payouts.
            </p>
          </article>

          <article className={styles.benefit}>
            <h3>Cut Manual Errors</h3>
            <p>
              Structured workflows and automatic calculations help reduce scoring and payout mistakes during event operations.
            </p>
          </article>

          <article className={styles.benefit}>
            <h3>Deliver A Professional Experience</h3>
            <p>
              Provide staff and bowlers with consistent, readable tournament data across desktop and mobile views.
            </p>
          </article>

          <article className={styles.benefit}>
            <h3>Scale With Your Events</h3>
            <p>
              From weekly league events to larger tournaments, the workflow remains consistent as event complexity increases.
            </p>
          </article>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <h2>Ready To Run Your Next Tournament?</h2>
          <p>
            Start with BracketWorks and move from setup to results in one connected workflow.
          </p>
          <div className={styles.ctaButtons}>
            <Link href="/signup" className="ds-btn ds-btn-primary ds-btn-lg">
              Create Your Account
            </Link>
            <Link href="/login" className="ds-btn ds-btn-secondary ds-btn-lg">
              Return To Dashboard
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}


