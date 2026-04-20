"use client";

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import styles from './ModernHeader.module.css';

interface ModernHeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  showBreadcrumbs?: boolean;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  centerContent?: boolean;
}

export default function ModernHeader({
  title,
  subtitle,
  actions,
}: ModernHeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTournament, setActiveTournament] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth <= 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const readTournament = () => setActiveTournament(localStorage.getItem('activeTournamentName'));
    readTournament();
    window.addEventListener('tournament-changed', readTournament);

    const readSquad = () => setActiveSquad(localStorage.getItem('activeSquadLabel') || null);
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

  const firstName = mounted ? (user?.name || localStorage.getItem('first_name') || 'User') : 'User';

  return (
    <header className={styles.header}>
      <div className={`${styles.inner} ${isMobile ? styles.innerMobile : ''}`}>
        <div className={styles.layout}>
          {/* Top row: title + user */}
          <div className={styles.topRow}>
            <div className={styles.titleArea}>
              <h1 className={`${styles.title} ${isMobile ? styles.titleMobile : ''}`}>
                {getPageTitle()}
              </h1>
              {subtitle && (
                <p className={`${styles.subtitle} ${isMobile ? styles.subtitleMobile : ''}`}>
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Active tournament strip */}
          {mounted && (
            <div className={styles.tournamentStrip}>
              <span className={styles.tournamentStripLabel}>Active Tournament:</span>
              {activeTournament
                ? <span className={styles.tournamentStripName}>{activeTournament}</span>
                : <span className={styles.tournamentStripNone}>No tournament selected</span>
              }
              {activeTournament && activeSquad && (
                <>
                  <span className={styles.tournamentStripDivider}>·</span>
                  <span className={styles.tournamentStripLabel}>Squad:</span>
                  <span className={styles.tournamentStripName}>{activeSquad}</span>
                </>
              )}
            </div>
          )}

          {/* Actions row - always rendered to maintain consistent 150px layout */}
          <div className={styles.actions}>
            {actions}
          </div>
        </div>
      </div>
    </header>
  );
}
