'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import styles from './OrganizerTopNav.module.css';

const navLinks = [
  { href: '/organizer', label: 'Dashboard' },
  { href: '/organizer#entries', label: 'Entries' },
  { href: '/organizer#scores', label: 'Scores' },
  { href: '/organizer#brackets', label: 'Brackets' },
  { href: '/organizer#payouts', label: 'Payouts' },
] as const;

export default function OrganizerTopNav() {
  const pathname = usePathname();
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const [displayName, setDisplayName] = useState('Organizer');
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState('');

  const avatarInitials = useMemo(
    () => displayName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'TC',
    [displayName],
  );

  useEffect(() => {
    const syncHash = () => {
      setActiveHash(window.location.hash || '');
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);

    return () => {
      window.removeEventListener('hashchange', syncHash);
    };
  }, [pathname]);

  useEffect(() => {
    const readContext = () => {
      const firstName = localStorage.getItem('first_name');
      const fallbackName = localStorage.getItem('last_username');
      const tournament = localStorage.getItem('tc_active_tournament_name');
      const squad = localStorage.getItem('tc_active_squad_name');

      setDisplayName(firstName || fallbackName || 'Organizer');
      setActiveTournament(tournament);
      setActiveSquad(squad);
    };

    readContext();
    window.addEventListener('storage', readContext);
    return () => {
      window.removeEventListener('storage', readContext);
    };
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!userMenuRef.current?.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  const handleLogout = () => {
    sessionStorage.removeItem('access_token');
    localStorage.removeItem('user_id');
    localStorage.removeItem('first_name');
    localStorage.removeItem('is_admin');
    localStorage.removeItem('session_id');
    window.location.replace('/login');
  };

  const isNavLinkActive = (href: string) => {
    if (pathname !== '/organizer') {
      return false;
    }

    const hashIndex = href.indexOf('#');
    if (hashIndex === -1) {
      return activeHash === '';
    }

    return activeHash === href.slice(hashIndex);
  };

  return (
    <>
      <header className={styles.topNav}>
        <Link href="/organizer" className={styles.logoLink}>
          <Image
            src="/TC_logo_No_Text.svg"
            alt="Tournament Central"
            width={36}
            height={36}
            className={styles.logoIcon}
            priority
          />
          <span className={styles.logoText}>Tournament Central</span>
        </Link>

        {activeTournament && (
          <div
            className={styles.tournamentContext}
            title={activeSquad ? `${activeTournament} / ${activeSquad}` : activeTournament}
          >
            <span className={styles.tournamentContextName}>{activeTournament}</span>
            {activeSquad && <span className={styles.squadContextName}>{activeSquad}</span>}
          </div>
        )}

        <nav className={styles.navPills} aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navPill} ${isNavLinkActive(link.href) ? styles.navPillActive : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.rightZone}>
          <div className={styles.userMenu} ref={userMenuRef}>
            <button
              className={styles.userMenuTrigger}
              onClick={() => setIsUserMenuOpen((previous) => !previous)}
              aria-label="Open user menu"
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
            >
              <span className={styles.avatarChip} title={displayName}>{avatarInitials}</span>
              <span className={styles.userMenuCaret} aria-hidden="true" />
            </button>

            {isUserMenuOpen && (
              <div className={styles.userMenuPanel} role="menu" aria-label="User menu">
                <div className={styles.userMenuHeader}>{displayName}</div>
                <button
                  className={`${styles.userMenuItemButton} ${styles.userMenuItemDanger}`}
                  onClick={handleLogout}
                  role="menuitem"
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <header className={styles.topNavMobile}>
        <Link href="/organizer" className={styles.mobileBrand}>
          <Image
            src="/TC_logo_No_Text.svg"
            alt="Tournament Central"
            width={28}
            height={28}
            className={styles.mobileLogoIcon}
            priority
          />
          <span className={styles.mobileBrandText}>Tournament Central</span>
        </Link>

        {activeTournament && (
          <span
            className={styles.mobileTournamentBadge}
            title={activeSquad ? `${activeTournament} / ${activeSquad}` : activeTournament}
          >
            {activeTournament}
          </span>
        )}
      </header>
    </>
  );
}
