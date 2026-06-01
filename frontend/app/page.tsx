import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';
import { PublicViewDemo } from './PublicViewDemo';

export const metadata: Metadata = {
  title: 'Bowling Tournament Bracket Software | BracketWorks',
  description: 'Run bowling brackets, side pots, live scoring, and payouts from one clean dashboard. Built for tournament directors. Start free with BracketWorks.',
  alternates: {
    canonical: 'https://bracketworks.app/',
  },
  robots: {
    index: true,
    follow: true,
  },
  keywords: 'bowling tournament software, bowling brackets, live score tracking, bowling payouts, tournament director tools',
  openGraph: {
    title: 'Bowling Tournament Bracket Software | BracketWorks',
    description: 'Run bowling brackets, side pots, live scoring, and payouts from one clean dashboard. Built for tournament directors.',
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
    title: 'Bowling Tournament Bracket Software | BracketWorks',
    description: 'Run bowling brackets, side pots, live scoring, and payouts from one clean dashboard. Built for tournament directors.',
  },
};

const homeSoftwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BracketWorks',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://bracketworks.app/',
  description: 'Bowling tournament software for managing brackets, side pots, live scoring, and payouts.',
};

export default function HomePage() {
  const features = [
    {
      title: 'Build clean brackets',
      body: 'Create tournament brackets quickly with predictable setup, round tracking, and clear winner advancement.',
    },
    {
      title: 'Track every side pot',
      body: 'Manage optional side action like high game, eliminator, brackets, and custom event pools from the same event dashboard.',
    },
    {
      title: 'Enter scores live',
      body: 'Enter scores as games finish and keep bracket progress updated throughout the tournament.',
    },
    {
      title: 'Review payouts clearly',
      body: 'Calculate projected payouts from your event settings, then review and export clean results for verification.',
    },
    {
      title: 'Use it from the desk or lanes',
      body: 'Run the event from the front desk, tournament office, counter, or lane-side on mobile.',
    },
    {
      title: 'Verify every result',
      body: 'Keep important score, bracket, and payout changes easier to review before final results are shared.',
    },
  ];

  const steps = [
    {
      title: 'Build the tournament',
      text: 'Set bracket sizes, squads, fees, prize rules, and event options before competition starts.',
    },
    {
      title: 'Add bowlers',
      text: 'Register players, assign squads, and organize entries so the event is ready to run.',
    },
    {
      title: 'Run tournament play',
      text: 'Enter scores, advance winners, and keep staff aligned as games are completed.',
    },
    {
      title: 'Finalize results',
      text: 'Review winners, verify payout totals, and export polished results for records or posting.',
    },
  ];

  return (
    <div className={styles.container}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(homeSoftwareApplicationJsonLd),
        }}
      />
      <header className={styles.navWrap}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <Image
              src="/logo_no_text.svg"
              alt="BracketWorks"
              width={138}
              height={40}
              className={styles.brandLogo}
              priority
            />
            <div className={styles.brandText}>
              <strong>BracketWorks</strong>
              <span>Bowling brackets and side pots</span>
            </div>
          </div>

          <nav className={styles.navLinks} aria-label="Primary">
            <Link href="#features">Features</Link>
            <Link href="#live-view">Live View</Link>
            <Link href="#how-it-works">How It Works</Link>
            <Link href="#benefits">Benefits</Link>
            <Link href="#pricing">Get Started</Link>
          </nav>

          <div className={styles.navActions}>
            <Link href="/login" className={`${styles.navBtn} ${styles.navBtnSecondary}`}>
              Sign In
            </Link>
            <Link href="/signup" className={`${styles.navBtn} ${styles.navBtnPrimary}`}>
              Start Free
            </Link>
          </div>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroGrid}>
          <div className={styles.heroContent}>
            <p className={styles.kicker}>Bowling Tournament Operations</p>
            <h1 className={styles.heroTitle}>
              Smarter Brackets. Cleaner Payouts. Better Tournaments.
            </h1>
            <p className={styles.heroSubtitle}>
              BracketWorks brings brackets, side pots, scoring, and payout review into one clean app for bowling tournament directors.
            </p>
            <div className={styles.heroCTA}>
              <Link href="/signup" className={`${styles.navBtn} ${styles.navBtnPrimary}`}>
                Start Free
              </Link>
              <Link href="/login" className={`${styles.navBtn} ${styles.navBtnSecondary}`}>
                Sign In
              </Link>
            </div>
            <p className={styles.heroCtaHelper}>No credit card required. Set up your first event in minutes.</p>
            <div className={styles.trustRow}>
              <span>Brackets</span>
              <span>Side Pots</span>
              <span>Scores</span>
              <span>Payouts</span>
            </div>
            <div className={styles.proofRow}>
              <div className={styles.proofCard}>
                <span className={styles.proofIcon}>SETUP</span>
                <strong className={styles.proofStat}>Under 10 min</strong>
                <span className={styles.proofLabel}>Tournament setup</span>
              </div>
              <div className={styles.proofCard}>
                <span className={styles.proofIcon}>EXPORT</span>
                <strong className={styles.proofStat}>Under 60 sec</strong>
                <span className={styles.proofLabel}>Export generated</span>
              </div>
              <div className={styles.proofCard}>
                <span className={styles.proofIcon}>ACCESS</span>
                <strong className={styles.proofStat}>Any device</strong>
                <span className={styles.proofLabel}>Desktop &amp; lane-side mobile</span>
              </div>
            </div>
          </div>

          <div className={styles.heroPanel}>
            <div className={styles.panelHeaderRow}>
              <h2 className={styles.heroPanelTitle}>Live Tournament Board</h2>
              <span className={styles.liveBadge}>LIVE DEMO</span>
            </div>

            <div className={styles.tournamentMetaCard}>
              <h3 className={styles.tournamentName}>Idaho Scratch Classic</h3>
              <p className={styles.tournamentSquad}>Squad: 11:00 AM</p>
              <p className={styles.demoNote}>Sample event data shown for product preview only.</p>
            </div>

            <div className={styles.heroStats}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>16</span>
                <span className={styles.statLabel}>Active Brackets</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>42/64</span>
                <span className={styles.statLabel}>Scores Entered</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>8</span>
                <span className={styles.statLabel}>Side Pots Tracked</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>$2,480</span>
                <span className={styles.statLabel}>Projected Payouts</span>
              </div>
            </div>

            <div className={styles.activityCard}>
              <h4 className={styles.activityTitle}>Recent Activity</h4>
              <ul className={styles.activityList}>
                <li>Game 2 scores updated</li>
                <li>Bracket Round 2 advanced</li>
                <li>High Game side pot recalculated</li>
                <li>Payout export ready for review</li>
              </ul>
            </div>

            <div className={styles.bracketPreview} aria-label="Bracket preview">
              <h4 className={styles.bracketPreviewTitle}>Bracket Preview</h4>
              <div className={styles.bracketPreviewGrid}>
                <div className={styles.bracketRound}>
                  <span className={styles.roundLabel}>R1</span>
                  <div className={styles.matchNode}>Bowler A</div>
                  <div className={styles.matchNode}>Bowler B</div>
                  <div className={styles.matchNode}>Bowler C</div>
                  <div className={styles.matchNode}>Bowler D</div>
                </div>
                <div className={styles.bracketRound}>
                  <span className={styles.roundLabel}>R2</span>
                  <div className={`${styles.matchNode} ${styles.matchNodeWinner}`}>Winner 1</div>
                  <div className={`${styles.matchNode} ${styles.matchNodeWinner}`}>Winner 2</div>
                </div>
                <div className={styles.bracketRound}>
                  <span className={styles.roundLabel}>Final</span>
                  <div className={`${styles.matchNode} ${styles.matchNodeChampion}`}>Champion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.features}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Built for the way bowling tournaments actually run</h2>
          <p className={styles.sectionSubtitle}>
            From setup to final payout review, BracketWorks keeps brackets, scores, side pots, and results connected so tournament staff can focus on running the event.
          </p>
        </div>

        <div className={styles.featureGrid}>
          {features.map(feature => (
            <article key={feature.title} className={styles.featureCard}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="live-view" className={styles.publicViewSection}>
        <div className={styles.publicViewGrid}>

          <PublicViewDemo />

          <div className={styles.publicViewContent}>
            <p className={styles.kicker}>Public Tournament View</p>
            <h2 className={styles.publicViewTitle}>Bowlers Follow Along in Real Time</h2>
            <p className={styles.publicViewSubtitle}>
              Share a live tournament link so bowlers can follow bracket standings, check scores after each game, and view side pot results from any device. No login required.
            </p>
            <ul className={styles.publicViewList}>
              <li>Live bracket summary with win totals by game</li>
              <li>Drill into individual brackets and side pots</li>
              <li>Auto-refreshes as scores are entered</li>
              <li>Search by bowler name</li>
              <li>Works on phones at the lanes</li>
            </ul>
          </div>

        </div>
      </section>

      <section id="how-it-works" className={styles.howItWorks}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>From setup to results in four steps</h2>
          <p className={styles.sectionSubtitle}>Every tournament follows the same simple flow. No guesswork required.</p>
        </div>

        <div className={styles.stepsGrid}>
          {steps.map((step, index) => (
            <article key={step.title} className={styles.step}>
              <div className={styles.stepBadge}>{String(index + 1).padStart(2, '0')}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="benefits" className={styles.benefits}>
        <div className={styles.sectionHeading}>
          <h2 className={styles.sectionTitle}>Why organizers choose BracketWorks</h2>
          <p className={styles.sectionSubtitle}>Less time managing tools. More time running a great event.</p>
        </div>

        <div className={styles.benefitsList}>
          <article className={styles.benefit}>
            <h3>One place for everything</h3>
            <p>
              Replace disconnected spreadsheets and manual tracking with one place for tournament settings, brackets, scores, side pots, and payouts.
            </p>
          </article>

          <article className={styles.benefit}>
            <h3>Fewer mistakes</h3>
            <p>
              Structured score entry and automatic calculations help reduce bracket and payout mistakes during live event operations.
            </p>
          </article>

          <article className={styles.benefit}>
            <h3>A professional experience</h3>
            <p>
              Give staff and bowlers consistent, readable tournament information across desktop and mobile views.
            </p>
          </article>

          <article className={styles.benefit}>
            <h3>Grows with your events</h3>
            <p>
              Use the same workflow for weekly events, local tournaments, and larger open events as your needs grow.
            </p>
          </article>
        </div>
      </section>

      <section id="pricing" className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <span className={styles.ctaBadge}>Get Started Free</span>
          <h2>Your next tournament<br />starts here</h2>
          <p>
            Set up brackets, track scores, manage side pots, and review payouts — all from one clean tournament dashboard.
          </p>
          <div className={styles.ctaPills}>
            <span className={styles.ctaPill}>No credit card required</span>
            <span className={styles.ctaPill}>Up and running in minutes</span>
            <span className={styles.ctaPill}>Works on any device</span>
          </div>
          <div className={styles.ctaButtons}>
            <Link href="/signup" className={`${styles.navBtn} ${styles.navBtnPrimary}`}>
              Create Free Account
            </Link>
            <Link href="/login" className={`${styles.navBtn} ${styles.navBtnSecondary}`}>
              Sign In
            </Link>
          </div>
          <p className={styles.ctaTrust}>Free to start. No commitment.</p>
        </div>
      </section>
    </div>
  );
}


