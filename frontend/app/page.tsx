
import styles from './page.module.css';
import Link from 'next/link';

export default function Page() {
  return (
    <main className={styles.main}>
      <div className={styles.heroCard}>
        <h2 className={styles.heroTitle}>Welcome to BracketWorks Web</h2>
        <p className={styles.heroText}>Use the navigation to manage players, enter scores, and preview brackets.</p>
        <Link href="/dashboard" legacyBehavior>
          <a className={styles.primaryBtn}>Dashboard</a>
        </Link>
      </div>
      <div className={styles.row}>
        <div className={styles.card}>
          <h3>Quick Actions</h3>
          <ul className={styles.actionList}>
            <li><span className={styles.actionIcon}>➕</span> Create a new bracket</li>
            <li><span className={styles.actionIcon}>⬆️</span> Import players (CSV)</li>
            <li><span className={styles.actionIcon}>📝</span> Record game scores</li>
          </ul>
        </div>
        <div className={styles.card}>
          <h3>Today</h3>
          <p>Squads: <b>A</b> (9AM), <b>B</b> (1PM), <b>C</b> (5PM)</p>
        </div>
      </div>
    </main>
  )
}
