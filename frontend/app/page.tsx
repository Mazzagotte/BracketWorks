import type { Metadata } from 'next';
import Link from 'next/link';
// ...existing code...
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
  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Professional Bowling Tournament Management Made Simple
          </h1>
          <p className={styles.heroSubtitle}>
            Create tournament brackets, track live scores, calculate payouts automatically, and manage bowling leagues with our all-in-one platform
          </p>
          <div className={styles.heroCTA}>
            <Link href="/signup" className={`${styles.button} ${styles.buttonPrimary}`}>
              Start Your Tournament
            </Link>
            <Link href="/login" className={`${styles.button} ${styles.buttonSecondary}`}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featuresContainer}>
          <h2 className={styles.sectionTitle}>Everything You Need for Bowling Tournaments</h2>
          
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🎯</div>
              <h3>Smart Bracket Generation</h3>
              <p>
                Automatically create tournament brackets with intelligent player seeding. Support both scratch and handicap tournaments for bowling competitions of any size.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Live Score Tracking</h3>
              <p>
                Update scores in real-time with automatic winner advancement. Track player performance across multiple brackets in your bowling league with instant updates.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>💰</div>
              <h3>Automated Payout Calculator</h3>
              <p>
                Calculate payouts instantly based on customizable prize pools and entry fees. Manage house percentages transparently and distribute tournament winnings automatically.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📈</div>
              <h3>Player Performance Analytics</h3>
              <p>
                Track detailed statistics on wins, losses, and earnings. Analyze player participation and tournament results to identify top performers in your bowling league.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>📱</div>
              <h3>Mobile-Optimized Design</h3>
              <p>
                Manage tournaments on any device with our responsive web application. Full PWA support lets you work offline and sync when reconnected.
              </p>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>🔐</div>
              <h3>Secure & Reliable</h3>
              <p>
                Keep tournament data safe with enterprise-grade security. Complete audit trails of all scores, payouts, and tournament changes for transparency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className={styles.howItWorks}>
        <div className={styles.howItWorksContainer}>
          <h2 className={styles.sectionTitle}>How BracketWorks Simplifies Tournament Management</h2>
          
          <div className={styles.stepsGrid}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>1</div>
              <h3>Create Your Tournament</h3>
              <p>Set up a new bowling tournament with custom brackets, entry fees, and prize pools in minutes</p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>2</div>
              <h3>Register Players</h3>
              <p>Add bowlers to your tournament and organize them into squads and bracket groups</p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>3</div>
              <h3>Track Scores in Real-Time</h3>
              <p>Update match scores as games are played. Our bracket management system automatically advances winners</p>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>4</div>
              <h3>Calculate Payouts Instantly</h3>
              <p>Generate comprehensive payout reports with automatic calculations based on your tournament rules</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className={styles.benefits}>
        <div className={styles.benefitsContainer}>
          <h2 className={styles.sectionTitle}>Why Choose BracketWorks for Your Bowling League</h2>
          
          <div className={styles.benefitsList}>
            <div className={styles.benefit}>
              <h3>Save Time on Tournament Administration</h3>
              <p>
                Eliminate manual bracket creation and payout calculations. Automate the tedious aspects of tournament management and focus on the bowlers.
              </p>
            </div>

            <div className={styles.benefit}>
              <h3>Reduce Errors in Scoring & Payouts</h3>
              <p>
                Our bracket management system ensures scores are tracked accurately and payouts calculated correctly every time. Complete audit trails provide transparency.
              </p>
            </div>

            <div className={styles.benefit}>
              <h3>Professional Tournament Experience</h3>
              <p>
                Give your bowlers a polished experience with instant access to tournament brackets, live scores, and payout results via our mobile-friendly platform.
              </p>
            </div>

            <div className={styles.benefit}>
              <h3>Scale from Small Leagues to Large Events</h3>
              <p>
                Whether you&apos;re running a casual bowling league or a major tournament, BracketWorks adapts to your needs with flexible bracket types and payout structures.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <h2>Ready to Simplify Your Bowling Tournament Management?</h2>
          <p>
            Join tournament organizers who are already using BracketWorks to manage their bowling leagues and tournaments
          </p>
          <Link href="/signup" className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonLarge}`}>
            Create Your Free Account
          </Link>
        </div>
      </section>
    </div>
  );
}


