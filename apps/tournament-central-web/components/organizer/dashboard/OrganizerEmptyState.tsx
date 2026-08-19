import Link from 'next/link';

import styles from './OrganizerDashboard.module.css';

export default function OrganizerEmptyState() {
  return (
    <section className={styles.emptyState} aria-label="No tournaments">
      <h2>Your Tournaments</h2>
      <p>You haven&apos;t created a tournament yet.</p>
      <p>Create your first tournament to configure events, squads, registration, fees, documents, and publishing.</p>
      <Link href="/organizer/tournaments/new/setup" className={styles.primaryButton}>Create Tournament</Link>
    </section>
  );
}
