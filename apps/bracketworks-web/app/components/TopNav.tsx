"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { ChevronDown, ExternalLink, HelpCircle, LogOut, MessageSquare, QrCode, Settings, Shield, Sparkles } from 'lucide-react';
import {
  Avatar,
  Button,
  ICON_SIZE,
  Menu,
  MenuDivider,
  MenuItem,
  TopNav as SharedTopNav,
  menuItemClassName,
  navItemClassName,
  topNavBrandClassName,
} from '@bracketworks/ui';

import { useAuth } from '../lib/auth-context';
import { logger } from '../lib/logger';
import {
  getActiveSquadLabel,
  getActiveTournamentName,
  requestDashboardSquadSelection,
  shouldRequireTimeSlotBeforeLeavingDashboard,
} from '../lib/selection-session';
import { preparePublicTournamentView } from '../lib/public-view';
import { navLinks } from '../../components/nav-links';
import ShareQRModal from './ShareQRModal';
import { useToastHelpers } from './Toast';
import { openOnboarding } from '../lib/onboarding';
import styles from './TopNav.module.css';

interface TopNavProps {
  firstName?: string;
}

/** BracketWorks app bar on the shared TopNav: tournament context, nav, Live view, Share QR, and the account menu. */
export default function TopNav({ firstName }: TopNavProps) {
  const pathname = usePathname();
  const { logoutUser, currentUser } = useAuth();
  const { error: showErrorToast } = useToastHelpers();
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [isShareQROpen, setIsShareQROpen] = useState(false);
  const [sharePublicUrl, setSharePublicUrl] = useState<string | null>(null);
  const [isPreparingShare, setIsPreparingShare] = useState(false);

  const displayName = firstName || currentUser?.name || 'User';

  useEffect(() => {
    const readContext = () => {
      setTournamentId(localStorage.getItem('tournament_id') || localStorage.getItem('lastTournamentId'));
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

  const handleLogout = () => {
    logger.userAction('User logged out');
    logoutUser({ fastRedirect: true });
    window.location.replace('/login');
  };

  const handleProtectedNavigation = (event: React.MouseEvent<HTMLAnchorElement>, targetPath: string) => {
    if ((pathname || '') !== '/dashboard') return;
    try {
      if (shouldRequireTimeSlotBeforeLeavingDashboard(pathname || '', targetPath)) {
        event.preventDefault();
        requestDashboardSquadSelection(targetPath);
      }
    } catch {
      // Fail open: navigation proceeds.
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

  return (
    <>
      <SharedTopNav
        navLabel="Main navigation"
        brand={(
          <Link href="/dashboard" className={topNavBrandClassName()}>
            <Image src="/logo_no_text.svg" alt="" width={ICON_SIZE['2xl']} height={ICON_SIZE['2xl']} priority />
            BracketWorks
          </Link>
        )}
        contextTitle={activeTournament || 'No tournament loaded'}
        contextMeta={activeSquad}
        actions={(
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}
              onClick={() => { void openBowlerView(); }}
              disabled={!tournamentId}
              className={styles.wideOnly}
            >
              Live view
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconOnly
              icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}
              onClick={() => { void openBowlerView(); }}
              disabled={!tournamentId}
              className={styles.narrowOnly}
              aria-label="Open live view"
            />
            <Button
              size="sm"
              variant="secondary"
              iconOnly
              icon={<QrCode size={ICON_SIZE.md} aria-hidden="true" />}
              onClick={() => { void openShareQR(); }}
              disabled={!tournamentId || !activeTournament || isPreparingShare}
              aria-label="Share live view QR code"
            />
            <Menu
              triggerLabel="Open user menu"
              trigger={(
                <>
                  <Avatar name={displayName} />
                  <ChevronDown size={ICON_SIZE.sm} aria-hidden="true" />
                </>
              )}
              header={displayName}
            >
              <MenuItem href="/settings" icon={<Settings size={ICON_SIZE.md} />}>Settings</MenuItem>
              <MenuItem href="/settings#feedback-form" icon={<MessageSquare size={ICON_SIZE.md} />}>Report a problem or request a feature</MenuItem>
              <MenuItem href="/help/getting-started" icon={<HelpCircle size={ICON_SIZE.md} />}>Getting started</MenuItem>
              <MenuItem onSelect={() => openOnboarding()} icon={<Sparkles size={ICON_SIZE.md} />}>Show welcome guide</MenuItem>
              {currentUser?.isAdmin ? <MenuItem href="/admin" icon={<Shield size={ICON_SIZE.md} />}>Admin</MenuItem> : null}
              <MenuDivider />
              <button type="button" role="menuitem" className={menuItemClassName('danger')} onClick={handleLogout}>
                <LogOut size={ICON_SIZE.md} aria-hidden="true" />
                Log out
              </button>
            </Menu>
          </>
        )}
      >
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            prefetch={false}
            onClick={(event) => handleProtectedNavigation(event, link.href)}
            className={navItemClassName(pathname === link.href)}
            aria-current={pathname === link.href ? 'page' : undefined}
          >
            {link.label}
          </Link>
        ))}
      </SharedTopNav>
      {tournamentId && activeTournament ? (
        <ShareQRModal
          open={isShareQROpen}
          onClose={() => setIsShareQROpen(false)}
          tournamentId={Number(tournamentId)}
          tournamentName={activeTournament}
          publicUrl={sharePublicUrl || undefined}
        />
      ) : null}
    </>
  );
}
