'use client';

import { CircleDollarSign, ClipboardList, Users, CalendarRange } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import OrganizerAttentionList from './OrganizerAttentionList';
import OrganizerDashboardHeader from './OrganizerDashboardHeader';
import OrganizerEmptyState from './OrganizerEmptyState';
import TournamentGrid from './TournamentGrid';
import { deleteTournament } from '../organizerApi';
import { type OrganizerDashboardTournament, useOrganizerDashboard } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';

export default function OrganizerDashboard() {
  const [displayName, setDisplayName] = useState('Organizer');
  const [deletingTournamentId, setDeletingTournamentId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { tournaments, attentionItems, upcomingItems, isLoading, error, refresh } = useOrganizerDashboard();

  useEffect(() => {
    // Authentication is enforced once by OrganizerAuthGuard in the parent layout.
    localStorage.removeItem('tc_active_tournament_name');
    localStorage.removeItem('tc_active_squad_name');
    window.dispatchEvent(new Event('storage'));

    const firstName = localStorage.getItem('first_name');
    const fallbackName = localStorage.getItem('last_username');
    setDisplayName(firstName || fallbackName || 'Organizer');
  }, []);


  const summaryStats = useMemo(() => {
    const totalRegistrations = tournaments.reduce((total, tournament) => total + (tournament.entryCount ?? 0), 0);
    const upcomingSquads = tournaments.reduce((total, tournament) => total + tournament.upcomingSquadCount, 0);
    const amountCollectedCents = tournaments.reduce((total, tournament) => total + tournament.amountPaidCents, 0);

    return [
      { label: 'TOTAL REGISTRATIONS', value: totalRegistrations, note: 'Across all tournaments', icon: Users },
      { label: 'UPCOMING SQUADS', value: upcomingSquads, note: 'Next 7 days', icon: CalendarRange },
      { label: 'AMOUNT COLLECTED', value: `$${(amountCollectedCents / 100).toLocaleString()}`, note: 'Paid registrations, across all tournaments', icon: CircleDollarSign },
      { label: 'ACTIVE TOURNAMENTS', value: tournaments.length, note: 'Currently open', icon: ClipboardList },
    ];
  }, [tournaments]);

  const formattedUpcoming = useMemo(() => upcomingItems.map((item) => ({
    ...item,
    dateLabel: item.date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    monthLabel: item.date.toLocaleDateString(undefined, { month: 'short' }),
    dayLabel: item.date.toLocaleDateString(undefined, { day: '2-digit' }),
  })), [upcomingItems]);

  const handleDeleteTournament = async (tournament: OrganizerDashboardTournament) => {
    if ((tournament.entryCount ?? 0) > 0) {
      setDeleteError('Tournaments with registrations cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete ${tournament.name}? This action cannot be undone.`)) {
      return;
    }

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setDeleteError('Your session expired. Please sign in again.');
      return;
    }

    setDeletingTournamentId(tournament.id);
    setDeleteError(null);
    try {
      await deleteTournament(token, tournament.id);
      await refresh();
    } catch (caughtError) {
      setDeleteError(caughtError instanceof Error ? caughtError.message : 'Failed to delete tournament.');
    } finally {
      setDeletingTournamentId(null);
    }
  };

  return (
    <div className={styles.shell}>
      <OrganizerDashboardHeader displayName={displayName} />

      {error ? (
        <section className={styles.errorCard} role="alert">
          <p>We couldn&apos;t load your tournaments.</p>
          <button type="button" className={styles.secondaryButtonCompact} onClick={() => { void refresh(); }}>
            Try Again
          </button>
        </section>
      ) : null}

      {deleteError ? (
        <section className={styles.errorCard} role="alert">
          <p>{deleteError}</p>
        </section>
      ) : null}

      {!error && !isLoading ? (
        <section className={styles.metricsGrid} aria-label="Tournament summary">
          {summaryStats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div key={stat.label} className={styles.metricCard}>
                <div className={styles.metricHeaderRow}>
                  <div className={styles.metricIconWrap}>
                    <Icon className={styles.metricIcon} aria-hidden="true" />
                  </div>
                  <span className={styles.metricLabel}>{stat.label}</span>
                </div>
                <strong className={styles.metricValue}>{stat.value}</strong>
                <small className={styles.metricNote}>{stat.note}</small>
              </div>
            );
          })}
        </section>
      ) : null}

      {isLoading ? (
        <section aria-label="Loading tournaments" className={styles.grid}>
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={styles.skeletonCard} />
          ))}
        </section>
      ) : tournaments.length === 0 ? (
        <OrganizerEmptyState />
      ) : (
        <div className={styles.mainContentGrid}>
          <TournamentGrid
            tournaments={tournaments}
            deletingTournamentId={deletingTournamentId}
            onDeleteTournament={handleDeleteTournament}
          />

          <aside className={styles.sidebarColumn}>
            <section className={styles.upcomingSection} aria-label="Upcoming activity">
              <div className={styles.sidebarHeader}>
                <h2>Upcoming</h2>
                <button type="button" className={styles.inlineAction} disabled title="Calendar view is not available yet">View calendar →</button>
              </div>

              <div className={styles.upcomingCard}>
                {formattedUpcoming.length > 0 ? (
                  <ul className={styles.upcomingList}>
                    {formattedUpcoming.map((item) => (
                      <li key={item.tournamentId} className={styles.upcomingItem}>
                        <span className={styles.dateBubble}>
                          <small>{item.monthLabel}</small>
                          <strong>{item.dayLabel}</strong>
                        </span>
                        <div className={styles.upcomingInfo}>
                          <strong>{item.name}</strong>
                          <span>{item.dateLabel}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyUpcoming}>No upcoming events.</p>
                )}

                <button type="button" className={styles.secondaryButtonWide} disabled title="This view is not available yet">View All Upcoming</button>
              </div>
            </section>

            <OrganizerAttentionList items={attentionItems} />
          </aside>
        </div>
      )}
    </div>
  );
}
