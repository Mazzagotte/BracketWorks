import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card, ICON_SIZE } from '@bracketworks/ui';

import styles from './AuthShell.module.css';

const BRACKETWORKS_URL = 'https://bracketworks.app/login';

type AuthShellProps = {
  mode: 'login' | 'signup';
  title: string;
  subtitle: string;
  children: ReactNode;
  showSwitchRow?: boolean;
};

const features = [
  { title: 'Discover tournaments', description: 'Find upcoming bowling tournaments by location, date, and format.' },
  { title: 'Register in one place', description: 'Enter tournaments and choose squads, divisions, and events.' },
  { title: 'Stay connected', description: 'See tournament information, availability, and results.' },
] as const;

/** Shared frame for sign-in, signup, forgot password, and verify email: a short intro beside one form card. */
export default function AuthShell({ mode, title, subtitle, children, showSwitchRow = true }: AuthShellProps) {
  const isLogin = mode === 'login';

  return (
    <div className={styles.page}>
      <main className={`bw-page ${styles.shell}`}>
        <section className={styles.intro} aria-labelledby="auth-intro-title">
          <Link href="/" className={styles.brand} aria-label="Tournament Central home">
            <Image src="/TC_logo_No_Text.svg" alt="" width={ICON_SIZE['3xl']} height={ICON_SIZE['3xl']} priority />
            Tournament Central
          </Link>
          <div className={styles.introText}>
            <h2 id="auth-intro-title" className={styles.introTitle}>Your tournament starts here.</h2>
            <p className={styles.body}>
              Find bowling tournaments near you, register your squad, and keep up with everything on tournament day.
            </p>
          </div>
          <ul className={styles.features}>
            {features.map((feature) => (
              <li key={feature.title}>
                <span className={styles.featureTitle}>{feature.title}</span>
                <span className={styles.helper}>{feature.description}</span>
              </li>
            ))}
          </ul>
          <p className={styles.helper}>
            Running a tournament? <a href={BRACKETWORKS_URL}>Manage brackets, scores, and payouts in BracketWorks</a>.
          </p>
        </section>

        <Card className={styles.card}>
          <header className={styles.cardHeader}>
            <h1 className={styles.cardTitle}>{title}</h1>
            <p className={styles.body}>{subtitle}</p>
          </header>

          {children}

          {showSwitchRow ? (
            <p className={styles.switchRow}>
              {isLogin ? (
                <>New to Tournament Central? <Link href="/signup">Create an account</Link></>
              ) : (
                <>Already have an account? <Link href="/login">Sign in</Link></>
              )}
            </p>
          ) : null}
        </Card>
      </main>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} BracketWorks and Tournament Central. All rights reserved.
      </footer>
    </div>
  );
}
