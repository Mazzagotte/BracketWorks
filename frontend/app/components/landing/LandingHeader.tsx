import Link from 'next/link';
import Image from 'next/image';
import styles from './landing.module.css';

export function LandingHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/BW Logo No Text.svg"
            alt="BracketWorks"
            width={32}
            height={32}
            className={styles.logoImage}
            priority
          />
          <div className={styles.logoText}>
            <strong>BracketWorks</strong>
            <span>Bowling Brackets & Side Pots</span>
          </div>
        </Link>

        <nav className={styles.nav} aria-label="Main navigation">
          <a href="#features" className={styles.navLink}>Features</a>
          <a href="#live-view" className={styles.navLink}>Live View</a>
          <a href="#how-it-works" className={styles.navLink}>How It Works</a>
          <a href="#tournament-central" className={styles.navLink}>Tournament Central</a>
          <a href="#resources" className={styles.navLink}>Resources</a>
        </nav>

        <div className={styles.actions}>
          <Link href="/login" className={`${styles.button} ${styles.buttonSecondary}`}>
            Sign In
          </Link>
          <Link href="/signup" className={`${styles.button} ${styles.buttonPrimary}`}>
            Start Free
          </Link>
        </div>
      </div>
    </header>
  );
}
