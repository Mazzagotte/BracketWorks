import styles from './OrganizerDashboard.module.css';

type TournamentStatusBadgeProps = {
  isPublic: boolean;
  hasPublishedSetup: boolean;
};

export default function TournamentStatusBadge({ isPublic, hasPublishedSetup }: TournamentStatusBadgeProps) {
  if (!hasPublishedSetup) {
    return <span className={`${styles.badge} ${styles.badgeWarning}`}>DRAFT</span>;
  }

  if (!isPublic) {
    return <span className={`${styles.badge} ${styles.badgeMuted}`}>PRIVATE</span>;
  }

  return <span className={`${styles.badge} ${styles.badgeSuccess}`}>PUBLISHED</span>;
}
