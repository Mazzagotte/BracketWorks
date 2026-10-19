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
        <span className={styles.dashboardEyebrow}>Organizer workspace</span>
        <h1>
          Your tournament command center
        </h1>
        <p className={styles.subtitle}>{`${displayName ? `${displayName}, here` : 'Here'} is what's happening across your tournaments.`}</p>
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
