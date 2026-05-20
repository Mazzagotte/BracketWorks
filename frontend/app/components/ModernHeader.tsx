"use client";

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { getActiveSquadLabel, getActiveTournamentName } from '../lib/selection-session';
import styles from './ModernHeader.module.css';

interface ModernHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function ModernHeader({
  title,
  subtitle,
  actions,
}: ModernHeaderProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth <= 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const readTournament = () => setActiveTournament(getActiveTournamentName());
    readTournament();
    window.addEventListener('tournament-changed', readTournament);

    const readSquad = () => setActiveSquad(getActiveSquadLabel());
    readSquad();
    window.addEventListener('squad-changed', readSquad);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('tournament-changed', readTournament);
      window.removeEventListener('squad-changed', readSquad);
    };
  }, []);

  const getPageTitle = () => {
    if (title) return title;
    const currentPage = pathname.split('/').filter(Boolean).pop() || 'dashboard';
    const pageTitles: Record<string, string> = {
      'dashboard': 'Tournament Dashboard',
      'brackets': 'Tournament Brackets',
      'players': 'Player Management',
      'scores': 'Score Management',
      'payouts': 'Payout Distribution',
    };
    return pageTitles[currentPage] || currentPage.charAt(0).toUpperCase() + currentPage.slice(1);
  };

  const getGreeting = () => {
    if (!mounted) return 'Welcome';
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = mounted ? (currentUser?.name || localStorage.getItem('first_name') || 'User') : 'User';

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <Link href="/" className={styles.brandLink}>
          <Image
            src="/logo.svg"
            alt="BracketWorks"
            width={180}
            height={180}
            className={styles.brandLogo}
            priority
          />
        </Link>
      </div>
      <div className={styles.content}>
        <div className={styles.topRow}>
          <h1 className={styles.title}>{getPageTitle()}</h1>
        </div>
        {mounted && (
          <div className={styles.tournamentStrip}>
            <span className={styles.tournamentItem}>
              <span className={styles.tournamentLabel}>Active Tournament:</span>
              {activeTournament
                ? <span className={styles.tournamentStripName}>{activeTournament}</span>
                : <span className={styles.tournamentStripNone}>None selected</span>
              }
            </span>
            {activeTournament && activeSquad && (
              <span className={styles.tournamentItem}>
                <span className={styles.tournamentLabel}>Squad:</span>
                <span className={styles.tournamentStripName}>{activeSquad}</span>
              </span>
            )}
          </div>
        )}
        {actions && (
          <>
            <div className={styles.divider} />
            <div className={styles.bottomRow}>
              {actions}
            </div>
          </>
        )}
      </div>
    </header>
  );
}