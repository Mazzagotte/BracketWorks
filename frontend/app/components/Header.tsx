'use client';
import styles from '../page.module.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  return (
    <header className={styles.header}>
      <div className={styles.logoTitle}>
        <img src="/logo.png" alt="BracketWorks Logo" width={56} height={56} style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 2px 8px rgba(240,165,0,0.08)', marginRight: '1.1rem' }} />
        <span className={styles.title}>BracketWorks</span>
      </div>
      <nav className={styles.nav}>
        <Link href="/dashboard" className={pathname?.startsWith('/dashboard') ? styles.navLinkActive : styles.navLink}>Dashboard</Link>
        <Link href="/brackets" className={pathname?.startsWith('/brackets') ? styles.navLinkActive : styles.navLink}>Brackets</Link>
        <Link href="/players" className={pathname?.startsWith('/players') ? styles.navLinkActive : styles.navLink}>Players</Link>
        <Link href="/scores" className={pathname?.startsWith('/scores') ? styles.navLinkActive : styles.navLink}>Scores</Link>
      </nav>
    </header>
  );
}