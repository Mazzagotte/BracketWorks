import { Badge, Card, CardHeader } from '@bracketworks/ui';
import Link from 'next/link';

import type { OrganizerAttentionItem } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';
import { organizerRoutes } from '../organizerRoutes';

type OrganizerAttentionListProps = {
  items: OrganizerAttentionItem[];
};

export default function OrganizerAttentionList({ items }: OrganizerAttentionListProps) {
  return (
    <Card aria-label="Needs attention">
      <CardHeader title="Needs attention" actions={<Badge tone={items.length > 0 ? 'warning' : 'neutral'}>{items.length}</Badge>} />
      {items.length === 0 ? (
        <div className={styles.rowText}>
          <strong className={styles.rowTitle}>You&apos;re all caught up</strong>
          <span className={styles.rowMeta}>No setup or schedule alerts right now.</span>
        </div>
      ) : (
        <ul className={styles.rows}>
          {items.map((item) => (
            <li key={item.id} className={styles.attentionRow}>
              <span>{item.message}</span>
              <Link href={organizerRoutes.overview(item.tournamentId)} className={styles.rowLink} aria-label={`Manage: ${item.message}`}>Review</Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
