"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '../app/lib/auth-context';
import { buildApiUrl } from '../app/lib/api';
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
  const [tournamentId, setTournamentId] = useState<string | null>(null);

  useEffect(() => {
    const read = () =>
      setTournamentId(localStorage.getItem('tournament_id') || localStorage.getItem('lastTournamentId'));
    read();
    window.addEventListener('tournament-changed', read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener('tournament-changed', read);
      window.removeEventListener('storage', read);
    };
  }, []);

  const slugifyTournamentName = (name: string) => {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const openBowlerView = async () => {
    if (!tournamentId) return;

    try {
      const res = await fetch(buildApiUrl(`/api/v1/public/tournament/${encodeURIComponent(tournamentId)}`));
      if (res.ok) {
        const tournament = await res.json() as { name?: string };
        const name = (tournament.name || '').trim();
        if (name) {
          const slug = slugifyTournamentName(name);
          if (slug) {
            window.open(`/view/${slug}`, '_blank', 'noopener,noreferrer');
            return;
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to resolve tournament name for public view URL', { tournamentId, error });
    }

    // Fallback keeps the button working if name lookup fails.
    window.open(`/view/${tournamentId}`, '_blank', 'noopener,noreferrer');
  };

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
          <div className={styles.logoWrap}>
            <Image
              src="/logo.svg"
              alt="BracketWorks Logo"
              width={160}
              height={160}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              priority
            />
          </div>
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
        {tournamentId && (
          <button onClick={openBowlerView} className={styles.bowlerViewBtn} title="Open public bowler view">
            Bowler View ↗
          </button>
        )}
        <Link
          href="/settings"
          prefetch={true}
          className={`${styles.settingsBtn} ${pathname === '/settings' ? styles.settingsBtnActive : ''}`}
        >
          Settings
        </Link>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          Logout
        </button>
      </div>
    </aside>
  );
}
