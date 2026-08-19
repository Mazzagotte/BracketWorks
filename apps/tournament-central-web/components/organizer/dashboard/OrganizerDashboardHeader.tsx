import Link from 'next/link';
import { Plus } from 'lucide-react';

import styles from './OrganizerDashboard.module.css';

type OrganizerDashboardHeaderProps = {
  displayName: string;
};

export default function OrganizerDashboardHeader({ displayName }: OrganizerDashboardHeaderProps) {
  return (
    <header className={styles.heroBar}>
      <div className={styles.heroTextWrap}>
        <h1>
          Welcome back{displayName ? ', ' : '!'}
          {displayName ? <span className={styles.heroName}>{displayName}!</span> : null}
        </h1>
        <p className={styles.subtitle}>Manage your tournaments and track what matters.</p>
      </div>

      <div className={styles.headerActions} aria-label="Dashboard controls">
        <Link href="/organizer/tournaments/new/setup" className={styles.primaryButton}>
          <Plus className={styles.primaryIcon} aria-hidden="true" />
          <span>Create Tournament</span>
        </Link>
      </div>
    </header>
  );
}
