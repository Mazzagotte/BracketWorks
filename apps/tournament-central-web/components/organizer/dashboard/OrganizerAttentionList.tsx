import Link from 'next/link';

import type { OrganizerAttentionItem } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';

type OrganizerAttentionListProps = {
  items: OrganizerAttentionItem[];
};

export default function OrganizerAttentionList({ items }: OrganizerAttentionListProps) {
  return (
    <section className={styles.attentionCard} aria-label="Needs attention">
      <h2>Needs Attention <span className={styles.attentionCount}>{items.length}</span></h2>
      {items.length === 0 && <div className={styles.allClear}><strong>You&apos;re all caught up</strong><p>No setup or schedule alerts right now.</p></div>}
      <ul className={styles.attentionList}>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.message}</span>
            <Link href={organizerRoutes.overview(item.tournamentId)} className={styles.inlineLink} aria-label={`Manage: ${item.message}`}>Review</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
