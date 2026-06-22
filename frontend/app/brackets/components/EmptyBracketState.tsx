import Link from 'next/link';
import styles from '../brackets.module.css';
import cardStyles from '../../styles/cards.module.css';
import buttonStyles from '../../styles/buttons.module.css';

export interface EmptyBracketStateProps {
  onGenerateClick: () => void;
  showDemo?: boolean;
  message?: string;
}

export function EmptyBracketState({ onGenerateClick }: EmptyBracketStateProps) {
  return (
    <div className={`${cardStyles.card} ${cardStyles.emptyStateCard} ${styles.emptyState}`}>
      <h2 className={styles.emptyTitle}>
        No Brackets Generated Yet
      </h2>
      <p className={styles.emptyMessage}>
        Your tournament is loaded. Generate brackets to seed matchups, start scoring, and track winners in real time.
      </p>
      <div className={cardStyles.emptyActions}>
        <button onClick={onGenerateClick} className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.medium}`}>
          Generate Brackets
        </button>
        <Link href="/dashboard" className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.medium}`}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
