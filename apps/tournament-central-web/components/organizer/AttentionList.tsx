import { Badge, Card, CardHeader } from '@bracketworks/ui';
import Link from 'next/link';

import styles from './AttentionList.module.css';

export type AttentionListItem = {
  id: string;
  message: string;
  href: string;
  /** Accessible name for the row's link. Defaults to "<actionLabel>: <message>". */
  linkLabel?: string;
};

type AttentionListProps = {
  items: AttentionListItem[];
  description?: string;
  /** Visible link text on each row, for example "Review" or "Resolve". */
  actionLabel?: string;
};

/** "Needs attention" card: divider rows with one link each, or an all-clear line. */
export default function AttentionList({ items, description, actionLabel = 'Review' }: AttentionListProps) {
  return (
    <Card aria-label="Needs attention">
      <CardHeader
        title="Needs attention"
        description={description}
        actions={<Badge tone={items.length > 0 ? 'warning' : 'neutral'}>{items.length}</Badge>}
      />
      {items.length === 0 ? (
        <div className={styles.clear}>
          <strong className={styles.clearTitle}>You&apos;re all caught up</strong>
          <span className={styles.clearText}>No setup or schedule alerts right now.</span>
        </div>
      ) : (
        <ul className={styles.rows}>
          {items.map((item) => (
            <li key={item.id} className={styles.row}>
              <span>{item.message}</span>
              <Link href={item.href} className={styles.link} aria-label={item.linkLabel ?? `${actionLabel}: ${item.message}`}>
                {actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
