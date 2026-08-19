'use client';

import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, CheckCircle2, Eye, FileText, Grid2X2, MapPin, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';
import { listMyOrganizerSetupStates, listMyTournaments } from '@/components/organizer/organizerApi';
import styles from './page.module.css';

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string {
  const rawStart = startDate?.trim();
  const rawEnd = endDate?.trim();
  if (!rawStart && !rawEnd) {
    return 'Dates not set';
  }

  const start = rawStart ? new Date(`${rawStart}T00:00:00`) : null;
  const end = rawEnd ? new Date(`${rawEnd}T00:00:00`) : null;

  if ((start && Number.isNaN(start.getTime())) || (end && Number.isNaN(end.getTime()))) {
    return rawStart || rawEnd || 'Dates not set';
  }

  if (start && end) {
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }

  const date = start || end;
  return date ? date.toLocaleDateString() : 'Dates not set';
}

type SummaryItem = {
  label: string;
  value: string;
  detail: string;
  icon: typeof MapPin;
  tone: 'purple' | 'blue' | 'orange' | 'green' | 'neutral';
};

function countTournamentSquads(squadTimes: TournamentContract['squad_times']): number {
  if (!squadTimes || typeof squadTimes !== 'object') {
    return 0;
  }

  return Object.values(squadTimes).reduce(
    (total, times) => total + (Array.isArray(times) ? times.length : 0),
    0,
  );
}

function buildSummaryItems(
  tournament: TournamentContract,
  setupState: TournamentSetupStateSummaryContract | undefined,
): SummaryItem[] {
  return [
    {
      label: 'LOCATION',
      value: tournament.location?.trim() || 'Location not set',
      detail: 'Tournament location',
      icon: MapPin,
      tone: 'purple',
    },
    { label: 'VISIBILITY', value: tournament.is_public ? 'Public' : 'Private', detail: tournament.is_public ? 'Anyone can view and register.' : 'Only invited users can view.', icon: Eye, tone: 'blue' },
    { label: 'REGISTRATIONS', value: String(tournament.entry_count ?? 0), detail: 'Total registrations', icon: Users, tone: 'orange' },
    { label: 'SETUP STATUS', value: setupState?.is_published ? 'Published' : 'Draft', detail: setupState?.is_published ? 'Tournament is published.' : 'Draft changes are pending.', icon: CheckCircle2, tone: 'green' },
    { label: 'SQUADS', value: String(countTournamentSquads(tournament.squad_times)), detail: 'Scheduled squads', icon: CalendarDays, tone: 'blue' },
  ];
}

export default function OrganizerTournamentOverviewPage() {
  const params = useParams<{ tournamentId: string }>();
  const router = useRouter();
  const [tournament, setTournament] = useState<TournamentContract | null>(null);
  const [setupState, setSetupState] = useState<TournamentSetupStateSummaryContract | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const parsedTournamentId = useMemo(() => Number(params.tournamentId), [params.tournamentId]);

  useEffect(() => {
    const hasToken = Boolean(sessionStorage.getItem('access_token'));
    const hasUser = Boolean(localStorage.getItem('user_id'));
    if (!hasToken || !hasUser) {
      router.replace('/login?expired=true');
      return;
    }

    if (!Number.isInteger(parsedTournamentId) || parsedTournamentId <= 0) {
      setError('Invalid tournament id.');
      return;
    }

    const token = sessionStorage.getItem('access_token');
    if (!token) {
      setError('Your session expired. Please sign in again.');
      return;
    }

    void (async () => {
      setError(null);
      try {
        const [tournaments, setupStates] = await Promise.all([
          listMyTournaments(token),
          listMyOrganizerSetupStates(token),
        ]);

        const matched = tournaments.find((item) => item.id === parsedTournamentId);
        if (!matched) {
          setError('Tournament not found for this organizer account.');
          return;
        }

        localStorage.setItem('tc_active_tournament_name', matched.name || '');
        window.dispatchEvent(new Event('storage'));

        setTournament(matched);
        setSetupState(setupStates.find((item) => item.tournament_id === parsedTournamentId));
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Unable to load tournament overview.');
      }
    })();
  }, [parsedTournamentId, router]);

  const summaryItems = useMemo(() => {
    if (!tournament) {
      return [];
    }
    return buildSummaryItems(tournament, setupState);
  }, [setupState, tournament]);

  const tabs = [
    { label: 'Overview', icon: Grid2X2, href: `/organizer/tournaments/${parsedTournamentId}`, active: true },
    { label: 'Registrations', icon: Users, href: `/organizer/tournaments/${parsedTournamentId}/registrations`, active: false },
    { label: 'Squads', icon: CalendarDays, href: null, active: false },
    { label: 'Participants', icon: UsersRound, href: null, active: false },
    { label: 'Documents', icon: FileText, href: null, active: false },
  ];

  return (
    <div className={styles.shell}>
      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.headerCard}>
        <div className={styles.heroLogo}>
          {tournament?.has_logo ? (
            <Image src={`/api/v1/tc/tournaments/${parsedTournamentId}/logo`} alt="" fill sizes="150px" unoptimized />
          ) : <span>TC</span>}
        </div>
        <div className={styles.heroCopy}>
          <span className={styles.statusBadge}>{tournament?.is_public ? 'PUBLISHED' : 'PRIVATE'}</span>
          <h1>{tournament?.name || 'Tournament'}</h1>
          <p className={styles.meta}>
            <CalendarDays aria-hidden="true" />
            {formatDateRange(tournament?.start_date, tournament?.end_date)}
            <MapPin aria-hidden="true" />
            {tournament?.location || 'Location not set'}
          </p>
        </div>
        <div className={styles.actions}>
          <Link href={`/organizer/tournaments/${parsedTournamentId}/setup`} className={styles.primaryButton}>Open Setup</Link>
          <Link href="/organizer" className={styles.secondaryButton}>Back to Dashboard</Link>
        </div>
      </section>

      <nav className={styles.tabBar} aria-label="Tournament sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return tab.href ? (
            <Link key={tab.label} href={tab.href} className={`${styles.tab} ${tab.active ? styles.tabActive : ''}`}>
              <Icon aria-hidden="true" />
              {tab.label}
            </Link>
          ) : (
            <span key={tab.label} className={`${styles.tab} ${styles.tabDisabled}`} aria-disabled="true" title="This section is not available yet">
              <Icon aria-hidden="true" />
              {tab.label}
            </span>
          );
        })}
      </nav>

      <section className={styles.summaryCard}>
        <div className={styles.summaryHeading}>
          <h2>Overview</h2>
          <p>Key details and status for this tournament.</p>
        </div>
        <ul className={styles.summaryList}>
          {summaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className={styles.summaryItem}>
                <span className={`${styles.summaryIcon} ${styles[`tone${item.tone}`]}`}><Icon aria-hidden="true" /></span>
                <div>
                  <span className={styles.summaryLabel}>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small>{item.detail}</small>
                </div>
              </li>
            );
          })}
        </ul>
        {setupState ? (
          <div className={styles.lastUpdated}>
            <span className={styles.summaryIcon}><CalendarDays aria-hidden="true" /></span>
            <div>
              <span className={styles.summaryLabel}>LAST UPDATED</span>
              <strong>{new Date(setupState.updated_at).toLocaleString()}</strong>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
