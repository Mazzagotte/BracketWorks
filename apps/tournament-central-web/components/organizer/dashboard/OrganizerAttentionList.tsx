import Link from 'next/link';

import type { OrganizerAttentionItem } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';

type OrganizerAttentionListProps = {
  items: OrganizerAttentionItem[];
};

export default function OrganizerAttentionList({ items }: OrganizerAttentionListProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={styles.attentionCard} aria-label="Needs attention">
      <h2>Needs Attention</h2>
      <ul className={styles.attentionList}>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.message}</span>
            <Link href={organizerRoutes.overview(item.tournamentId)} className={styles.inlineLink}>Manage</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
