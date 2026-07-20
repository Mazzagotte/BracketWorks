import Link from 'next/link';
import styles from './landing.module.css';

export function FinalCtaSection() {
  return (
    <section className={styles.ctaSection}>
      <div className={styles.ctaCard}>
        <h2>Your next tournament starts here</h2>
        <p>
          Replace scattered spreadsheets with one organized system for entries, brackets, scores, standings, side pots, payouts, and live results.
        </p>

        <div className={styles.ctaTrust}>
          <span className={styles.trustChip}>No credit card required</span>
          <span className={styles.trustChip}>Set up in minutes</span>
          <span className={styles.trustChip}>Works on any device</span>
        </div>

        <div className={styles.ctaButtons}>
          <Link href="/signup" className={`${styles.button} ${styles.buttonPrimary}`}>
            Create Free Account
          </Link>
          <Link href="/view" className={`${styles.button} ${styles.buttonSecondary}`}>
            View Live Demo
          </Link>
        </div>

        <p className={styles.ctaNote}>Free to start. No long-term commitment.</p>
      </div>
    </section>
  );
}
