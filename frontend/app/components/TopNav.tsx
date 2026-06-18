"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { logger } from '../lib/logger';
import { getActiveSquadLabel, getActiveTournamentName } from '../lib/selection-session';
import { preparePublicTournamentView } from '../lib/public-view';
import {
  shouldRequireTimeSlotBeforeLeavingDashboard,
  showSelectTimeSlotReminder,
} from '../lib/selection-session';
import { navLinks } from '../../components/nav-links';
import ShareQRModal from './ShareQRModal';
import { useToastHelpers } from './Toast';
import styles from './TopNav.module.css';

interface TopNavProps {
  firstName?: string;
  isMobile?: boolean;
  onMobileMenuOpen?: () => void;
}

export default function TopNav({ firstName, onMobileMenuOpen, isMobile = false }: TopNavProps) {
  const pathname = usePathname();
  const { logoutUser, currentUser } = useAuth();
  const { error: showErrorToast } = useToastHelpers();
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isShareQROpen, setIsShareQROpen] = useState(false);
  const [sharePublicUrl, setSharePublicUrl] = useState<string | null>(null);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const visibleLinks = useMemo(() => [...navLinks], []);

  const displayName = firstName || currentUser?.name || 'User';
  const avatarInitials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('') || 'BW';

  useEffect(() => {
    setMounted(true);

    const readContext = () => {
      setTournamentId(
        localStorage.getItem('tournament_id') || localStorage.getItem('lastTournamentId')
      );
      setActiveTournament(getActiveTournamentName());
      setActiveSquad(getActiveSquadLabel());
    };

    readContext();
    window.addEventListener('tournament-changed', readContext);
    window.addEventListener('squad-changed', readContext);
    window.addEventListener('storage', readContext);
    return () => {
      window.removeEventListener('tournament-changed', readContext);
      window.removeEventListener('squad-changed', readContext);
      window.removeEventListener('storage', readContext);
    };
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!userMenuRef.current?.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const handleLogout = () => {
    logger.userAction('User logged out');
    logoutUser({ fastRedirect: true });
    window.location.replace('/login');
  };

  const handleProtectedNavigation = (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string
  ) => {
    const currentPath = pathname || '';
    if (currentPath === '/dashboard') {
      try {
        if (shouldRequireTimeSlotBeforeLeavingDashboard(currentPath, targetPath)) {
          event.preventDefault();
          showSelectTimeSlotReminder();
          return;
        }
      } catch {
        // fail open
      }
    }
  };

  const openBowlerView = async () => {
    if (!tournamentId) return;
    try {
      const publicViewUrl = await preparePublicTournamentView(tournamentId);
      window.open(publicViewUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      logger.error('Failed to prepare public tournament view', { tournamentId, error });
      showErrorToast('Unable to open Live View. Please confirm the tournament is loaded and try again.');
    }
  };

  const openShareQR = async () => {
    if (!tournamentId || !activeTournament) return;
    setIsPreparingShare(true);
    try {
      const publicViewUrl = await preparePublicTournamentView(tournamentId);
      setSharePublicUrl(new URL(publicViewUrl, window.location.origin).toString());
      setIsShareQROpen(true);
    } catch (error) {
      logger.error('Failed to prepare public tournament share link', { tournamentId, error });
      showErrorToast('Unable to prepare QR share link. Please confirm the tournament is loaded and try again.');
    } finally {
      setIsPreparingShare(false);
    }
  };

  if (isMobile) {
    return (
      <header className={styles.topNavMobile}>
        <button
          onClick={onMobileMenuOpen}
          aria-label="Open navigation menu"
          className={styles.hamburgerBtn}
        >
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
          <span className={styles.hamburgerLine} />
        </button>

        <Link href="/dashboard" className={styles.mobileBrand}>
          <Image
            src="/logo_no_text.svg"
            alt="BracketWorks"
            width={28}
            height={28}
            className={styles.mobileLogoIcon}
            priority
          />
          <span className={styles.mobileBrandText}>BracketWorks</span>
        </Link>

        {mounted && activeTournament && (
          <span
            className={styles.mobileTournamentBadge}
            title={activeSquad ? `${activeTournament} / ${activeSquad}` : activeTournament}
          >
            {activeTournament}
          </span>
        )}
      </header>
    );
  }

  return (
    <>
    <header className={styles.topNav}>
      <Link href="/dashboard" className={styles.logoLink}>
        <Image
          src="/logo_no_text.svg"
          alt="BracketWorks"
          width={36}
          height={36}
          className={styles.logoIcon}
          priority
        />
        <span className={styles.logoText}>BracketWorks</span>
      </Link>

      <div
        className={`${styles.tournamentContext} ${mounted && activeTournament ? '' : styles.tournamentContextEmpty}`}
        title={activeSquad ? `${activeTournament || 'No tournament loaded'} / ${activeSquad}` : activeTournament || 'No tournament loaded'}
      >
        <span className={styles.tournamentContextName}>
          {mounted && activeTournament ? activeTournament : 'No tournament loaded'}
        </span>
        {mounted && activeSquad && (
          <span className={styles.squadContextName}>{activeSquad}</span>
        )}
      </div>

      <nav className={styles.navPills} aria-label="Main navigation">
        {visibleLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            onClick={e => handleProtectedNavigation(e, link.href)}
            className={`${styles.navPill} ${pathname === link.href ? styles.navPillActive : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className={styles.rightZone}>
        <div className={styles.publicActions}>
        <button
          className={styles.publicViewButton}
          onClick={openBowlerView}
          disabled={!tournamentId}
        >
          Live View <span className={styles.externalMark} aria-hidden="true">↗</span>
        </button>

          <button
            className={styles.shareQrButton}
            onClick={openShareQR}
            disabled={!tournamentId || !activeTournament || isPreparingShare}
            aria-label="Share live view QR code"
            title="Share live view QR code"
          >
            {isPreparingShare ? '...' : 'QR'}
          </button>
        </div>

        <div className={styles.userMenu} ref={userMenuRef}>
          <button
            className={styles.userMenuTrigger}
            onClick={() => setIsUserMenuOpen(previous => !previous)}
            aria-label="Open user menu"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
          >
            <span className={styles.avatarChip} title={displayName}>
              {avatarInitials}
            </span>
            <span className={styles.userMenuCaret} aria-hidden="true" />
          </button>

          {isUserMenuOpen && (
            <div className={styles.userMenuPanel} role="menu" aria-label="User menu">
              <div className={styles.userMenuHeader}>{displayName}</div>

              <Link
                href="/settings"
                className={styles.userMenuItem}
                onClick={() => setIsUserMenuOpen(false)}
                role="menuitem"
              >
                Settings
              </Link>

              {currentUser?.isAdmin && (
                <Link
                  href="/admin"
                  className={styles.userMenuItem}
                  onClick={() => setIsUserMenuOpen(false)}
                  role="menuitem"
                >
                  Admin
                </Link>
              )}

              <div className={styles.userMenuDivider} />

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
    {tournamentId && activeTournament && (
      <ShareQRModal
        open={isShareQROpen}
        onClose={() => setIsShareQROpen(false)}
        tournamentId={Number(tournamentId)}
        tournamentName={activeTournament}
        publicUrl={sharePublicUrl || undefined}
      />
    )}
    </>
  );
}
