"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../app/lib/auth-context';
import { logger } from '../app/lib/logger';
import { navLinks } from './nav-links';
import styles from './Sidebar.module.css';

interface SidebarProps {
  firstName?: string;
  isMobile?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
}

export default function Sidebar({ firstName, isMobile = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();

  const handleLogout = () => {
    logger.userAction('User logged out');
    logout();
    window.location.href = '/login';
  };

  const sidebarClass = [
    styles.sidebar,
    isMobile ? styles.sidebarMobile : '',
    isMobile && isOpen ? styles.sidebarMobileOpen : ''
  ].filter(Boolean).join(' ');

  return (
    <aside className={sidebarClass}>
      <div className={styles.brand}>
        {isMobile && (
          <button onClick={onClose} className={styles.closeBtn}>×</button>
        )}
        <Link href="/" className={styles.logoLink}>
          <Image
            src="/logo.svg"
            alt="BracketWorks Logo"
            width={160}
            height={160}
            className={styles.logoImg}
          />
        </Link>
      </div>

      <div className={styles.welcome}>
        <span className={styles.welcomeText}>
          Welcome, {firstName || 'User'}
        </span>
      </div>

      <nav className={styles.nav}>
        {navLinks.map(link => {
          const isActive = pathname === link.href;
          return (
            <div key={link.href} className={styles.navItem}>
              <Link
                href={link.href}
                prefetch={true}
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
              >
                {link.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className={styles.spacer} />

      <div className={styles.logoutWrap}>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </aside>
  );
}
