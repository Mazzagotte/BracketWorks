"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../app/lib/auth-context';
import { logger } from '../app/lib/logger';
import { preparePublicTournamentView } from '../app/lib/public-view';
import { getActiveSquadLabel, getActiveTournamentName } from '../app/lib/selection-session';
import { shouldRequireTimeSlotBeforeLeavingDashboard, showSelectTimeSlotReminder } from '../app/lib/selection-session';
import ShareQRModal from '../app/components/ShareQRModal';
import { useToastHelpers } from '../app/components/Toast';
import { navLinks } from './nav-links';
import styles from './MobileNav.module.css';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  firstName?: string;
  currentPage?: string;
}

export function MobileNav({ isOpen, onClose, firstName, currentPage }: MobileNavProps) {
  const { logoutUser, currentUser } = useAuth();
  const { error: showErrorToast } = useToastHelpers();
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [isShareQROpen, setIsShareQROpen] = useState(false);
  const [sharePublicUrl, setSharePublicUrl] = useState<string | null>(null);
  const [isPreparingShare, setIsPreparingShare] = useState(false);

  const visibleLinks = useMemo(
    () => (currentUser?.isAdmin
      ? [...navLinks, { href: '/admin', label: 'Admin' }]
      : navLinks),
    [currentUser?.isAdmin]
  );

  const handleLogout = () => {
    logger.userAction('User logged out via mobile nav');
    logoutUser({ fastRedirect: true });
    window.location.replace('/login');
  };

  useEffect(() => {
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

  const openBowlerView = async () => {
    if (!tournamentId) return;
    try {
      const publicViewUrl = await preparePublicTournamentView(tournamentId);
      window.open(publicViewUrl, '_blank', 'noopener,noreferrer');
      onClose();
    } catch (error) {
      logger.error('Failed to prepare public tournament view from mobile nav', { tournamentId, error });
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
      logger.error('Failed to prepare public tournament share link from mobile nav', { tournamentId, error });
      showErrorToast('Unable to prepare QR share link. Please confirm the tournament is loaded and try again.');
    } finally {
      setIsPreparingShare(false);
    }
  };

  const handleProtectedNavigation = (event: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    const currentPath = `/${currentPage || ''}`.replace('//', '/');

    // Only guard dashboard exits; fail open if selection session state is incomplete.
    if (currentPath === '/dashboard') {
      try {
        if (shouldRequireTimeSlotBeforeLeavingDashboard(currentPath, targetPath)) {
          event.preventDefault();
          showSelectTimeSlotReminder();
          return;
        }
      } catch (error) {
        logger.warn('Dashboard navigation guard failed open', { currentPath, targetPath, error });
      }
    }

    onClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const firstTouch = e.touches[0];
    if (!firstTouch) return;
    setTouchStartY(firstTouch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const firstTouch = e.touches[0];
    if (!firstTouch) return;
    const diff = touchStartY - firstTouch.clientY;
    if (diff > 50) {
      onClose();
      setTouchStartY(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ShareQRModal
        open={isShareQROpen}
        onClose={() => setIsShareQROpen(false)}
        tournamentId={Number.parseInt(tournamentId || '0', 10)}
        tournamentName={activeTournament || 'Tournament'}
        publicUrl={sharePublicUrl}
      />

      <div
        className={styles.backdrop}
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
        role="button"
        tabIndex={0}
        aria-label="Close navigation menu"
      />

      <nav
        className={styles.panel}
        role="navigation"
        aria-label="Mobile navigation menu"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        <div className={styles.swipeIndicator} />

        <div className={styles.header}>
          <div className={styles.greeting}>Welcome back!</div>
          {firstName && <div className={styles.userName}>{firstName}</div>}
          {activeTournament && (
            <div className={styles.contextCard}>
              <div className={styles.contextEyebrow}>Tournament loaded</div>
              <div className={styles.contextName}>{activeTournament}</div>
              {activeSquad && <div className={styles.contextMeta}>{activeSquad}</div>}
            </div>
          )}
        </div>

        <div className={styles.content}>
          <div className={styles.section}>
            <div className={styles.items}>
              {visibleLinks.map(item => {
                const isActive = currentPage === item.href.slice(1);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={event => handleProtectedNavigation(event, item.href)}
                    className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Tournament actions</div>
            <div className={styles.publicActionsWrap}>
              <button
                onClick={() => { void openBowlerView(); }}
                className={styles.publicViewBtn}
                disabled={!tournamentId}
              >
                Live View
              </button>
              <button
                onClick={() => { void openShareQR(); }}
                className={styles.shareQrBtn}
                disabled={!tournamentId || !activeTournament || isPreparingShare}
              >
                {isPreparingShare ? 'Preparing...' : 'Share QR'}
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionLabel}>Account</div>
            <div className={styles.accountActions}>
              <Link
                href="/settings"
                onClick={event => handleProtectedNavigation(event, '/settings')}
                className={`${styles.settingsBtn} ${currentPage === 'settings' ? styles.settingsBtnActive : ''}`}
                aria-current={currentPage === 'settings' ? 'page' : undefined}
              >
                Settings
              </Link>
              <button onClick={handleLogout} className={styles.logoutBtn} aria-label="Logout">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
