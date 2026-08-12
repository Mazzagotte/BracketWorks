import Image from 'next/image';
import Link from 'next/link';
import { CalendarDays, GitFork, Users } from 'lucide-react';
import type { ReactNode } from 'react';

import FeatureIconCard from './FeatureIconCard';
import styles from './AuthShell.module.css';

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
    icon: CalendarDays,
    label: 'Create Your Tournament',
    title: 'Create Your Tournament',
    description: 'Build dates, squads, divisions, events and fees.',
  },
  {
    icon: Users,
    label: 'Manage Registration',
    title: 'Manage Registration',
    description: 'Keep entries, bowlers and payments organized.',
  },
  {
    icon: GitFork,
    label: 'Run It With BracketWorks',
    title: 'Run It With BracketWorks',
    description: 'Send your tournament directly into BracketWorks.',
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
        <section className={styles.brandPanel} aria-hidden="true">
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
            Everything Your Tournament Needs.<br />
            <span className={styles.brandHeadlineOrange}>From Registration to Results.</span>
          </h1>

          <p className={styles.brandDescription}>
            Create tournaments, manage registration, organize squads,
            and connect directly with BracketWorks when it&apos;s time to run your tournament.
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
        &copy; {new Date().getFullYear()} Tournament Central. All rights reserved.
      </footer>
    </main>
  );
}
