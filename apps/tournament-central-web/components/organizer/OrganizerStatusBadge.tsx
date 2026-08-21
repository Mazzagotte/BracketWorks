import styles from './OrganizerStatusBadge.module.css';

const labels: Record<string, string> = {
  mixed: 'Partial',
  private: 'Private',
};

const variants: Record<string, string> = {
  paid: 'success', published: 'success', open: 'success', available: 'success', completed: 'success',
  pending: 'warning', waitlisted: 'warning', 'nearly full': 'warning', mixed: 'warning',
  cancelled: 'danger', refunded: 'danger', closed: 'danger', full: 'danger',
  unpaid: 'neutral', draft: 'neutral', private: 'neutral',
};

export default function OrganizerStatusBadge({ status }: { status: string | null | undefined }) {
  const normalized = (status || 'pending').trim().toLowerCase();
  const label = labels[normalized] ?? normalized.replace(/\b\w/gu, (character) => character.toUpperCase());
  const variant = variants[normalized] ?? 'neutral';
  return <span className={`${styles.badge} ${styles[variant]}`} data-status={normalized}>{label}</span>;
}
