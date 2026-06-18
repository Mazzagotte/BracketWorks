import Link from 'next/link';
import styles from '../brackets.module.css';

export interface EmptyBracketStateProps {
  onGenerateClick: () => void;
  showDemo?: boolean;
  message?: string;
}

export function EmptyBracketState({ onGenerateClick }: EmptyBracketStateProps) {
  return (
    <div className={styles.emptyState}>
      <h2 className={styles.emptyTitle}>
        No Brackets Generated Yet
      </h2>
      <p className={styles.emptyMessage}>
        Your tournament is loaded. Generate brackets to seed matchups, start scoring, and track winners in real time.
      </p>
      <div className={styles.emptyActions}>
        <button onClick={onGenerateClick} className="ds-btn ds-btn-primary ds-btn-md">
          Generate Brackets
        </button>
        <Link href="/dashboard" className="ds-btn ds-btn-secondary ds-btn-md">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
