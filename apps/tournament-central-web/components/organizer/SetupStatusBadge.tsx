import type { SetupStatus } from './types';
import styles from './tournament-setup.module.css';

type SetupStatusBadgeProps = {
  status: SetupStatus;
};

const statusLabel: Record<SetupStatus, string> = {
  complete: 'Complete',
  incomplete: 'Incomplete',
  'needs-attention': 'Needs Attention',
};

export default function SetupStatusBadge({ status }: SetupStatusBadgeProps) {
  const badgeClass =
    status === 'complete'
      ? styles.statusComplete
      : status === 'needs-attention'
        ? styles.statusNeedsAttention
        : styles.statusIncomplete;

  return <span className={`${styles.statusBadge} ${badgeClass}`}>{statusLabel[status]}</span>;
}
