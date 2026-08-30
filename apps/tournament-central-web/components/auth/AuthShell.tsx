import Image from 'next/image';
import Link from 'next/link';
import { Bell, ClipboardList, Search } from 'lucide-react';
import type { ReactNode } from 'react';

import FeatureIconCard from './FeatureIconCard';
import styles from './AuthShell.module.css';

const BRACKETWORKS_URL = 'https://bracketworks.app/login';

type AuthShellProps = {
  mode: 'login' | 'signup';
  title: string;
  subtitle: string;
  children: ReactNode;
  showSwitchRow?: boolean;
  showHeaderLogo?: boolean;
};

const featureCopy = [
  {
    icon: Search,
    label: 'Discover Tournaments',
    title: 'Discover Tournaments',
    description: 'Find upcoming bowling tournaments by location, date, and format.',
  },
  {
    icon: ClipboardList,
    label: 'Register in One Place',
    title: 'Register in One Place',
    description: 'Enter tournaments and select squads, divisions, and events.',
  },
  {
    icon: Bell,
    label: 'Stay Connected',
    title: 'Stay Connected',
    description: 'View tournament information, updates, availability, and results.',
  },
] as const;

export default function AuthShell({
  mode,
  title,
  subtitle,
  children,
  showSwitchRow = true,
  showHeaderLogo = true,
}: AuthShellProps) {
  const isLogin = mode === 'login';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.brandPanel}>
          <div className={styles.brandTop}>
            <Image
              src="/TC Banner.svg"
              alt="Tournament Central"
              width={540}
              height={104}
              className={styles.bannerImage}
              priority
            />
          </div>

          <h1 className={styles.brandHeadline}>
            Your Tournament Starts Here.<br />
            <span className={styles.brandHeadlineOrange}>Find. Register. Bowl.</span>
          </h1>

          <p className={styles.brandDescription}>
            Discover bowling tournaments near you, register your squad,
            and stay connected with everything happening on tournament day.
          </p>

          <ul className={styles.featureList}>
            {featureCopy.map(({ icon, label, title, description }) => (
              <li key={label} className={styles.featureItem}>
                <FeatureIconCard icon={icon} label={label} />
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.ecosystemCallout}>
            <span className={styles.ecosystemLabel}>Part of the Connected Tournament Platform</span>
            <div className={styles.ecosystemRow}>
              <Image
                src="/BW_logo_No_Text.svg"
                alt=""
                width={40}
                height={40}
                unoptimized
                className={styles.ecosystemLogo}
              />
              <span className={styles.ecosystemText}>
                Running a tournament?{' '}
                <a href={BRACKETWORKS_URL} className={styles.ecosystemLink}>
                  Manage brackets, scores &amp; payouts →
                </a>
              </span>
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            {showHeaderLogo && (
              <Image src="/TC_logo_No_Text.svg" alt="Tournament Central" width={40} height={40} priority />
            )}
            <h2 className={styles.cardTitle}>{title}</h2>
            <p className={styles.cardSubtitle}>{subtitle}</p>
          </div>

          {children}

          {showSwitchRow && (
            <div className={styles.switchRow}>
              {isLogin ? (
                <>
                  <span>New to Tournament Central?</span>
                  <Link href="/signup">Create account</Link>
                </>
              ) : (
                <>
                  <span>Already have an account?</span>
                  <Link href="/login">Sign in</Link>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      <footer className={styles.footer}>
        &copy; {new Date().getFullYear()} BracketWorks + Tournament Central. All rights reserved.
      </footer>
    </main>
  );
}
