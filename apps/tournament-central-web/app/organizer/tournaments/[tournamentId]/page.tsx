'use client';

import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, CalendarDays, CheckCircle2, Eye, MapPin, Users } from 'lucide-react';
import { useMemo } from 'react';

import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import { formatRegistrationTimestamp, formatTournamentDateRange } from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import {
  buildRegistrationSummary,
  buildSquadSummaries,
  buildTournamentAttentionItems,
} from '@/components/organizer/tournamentInsights';
import styles from './page.module.css';

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
  const {
    tournamentId,
    tournament,
    setupSummary,
    squads,
    registrations,
    eventCount,
    hasRulesDocument,
    registrationCloseIso,
    isTournamentLoading,
    isSetupLoading,
    isRegistrationsLoading,
    tournamentError,
    setupError,
    registrationsError,
  } = useTournamentContext();

  const summaryItems = useMemo(() => {
    if (!tournament) {
      return [];
    }
    return buildSummaryItems(tournament, setupSummary);
  }, [setupSummary, tournament]);

  const registrationSummary = useMemo(() => buildRegistrationSummary(registrations), [registrations]);
  const squadSummaries = useMemo(() => buildSquadSummaries(squads, registrations), [squads, registrations]);

  const attentionItems = useMemo(() => {
    if (!tournament) {
      return [];
    }

    return buildTournamentAttentionItems({
      tournamentId,
      isPublished: Boolean(setupSummary?.is_published),
      startDate: tournament.start_date,
      location: tournament.location,
      eventCount,
      hasRulesDocument,
      registrationCloseIso,
      squadSummaries,
      registrationSummary,
    });
  }, [eventCount, hasRulesDocument, registrationCloseIso, registrationSummary, setupSummary, squadSummaries, tournament, tournamentId]);

  return (
    <div className={styles.shell}>
      {tournamentError ? <p className={styles.error}>{tournamentError}</p> : null}
      {setupError ? <p className={styles.error}>Setup data: {setupError}</p> : null}
      {registrationsError ? <p className={styles.error}>Registration data: {registrationsError}</p> : null}

      <section className={styles.headerCard}>
        <div className={styles.heroLogo}>
          {tournament?.has_logo ? (
            <Image src={`/api/v1/tc/tournaments/${tournamentId}/logo`} alt="" fill sizes="150px" unoptimized />
          ) : <span>TC</span>}
        </div>
        <div className={styles.heroCopy}>
          <OrganizerStatusBadge status={tournament?.is_public ? 'published' : 'private'} />
          <h1>{tournament?.name || 'Tournament'}</h1>
          <p className={styles.meta}>
            <CalendarDays aria-hidden="true" />
            {formatTournamentDateRange(tournament?.start_date, tournament?.end_date)}
            <MapPin aria-hidden="true" />
            {tournament?.location || 'Location not set'}
          </p>
        </div>
        <div className={styles.actions}>
          <Link href={organizerRoutes.setup(tournamentId)} className={styles.primaryButton}>Edit Tournament</Link>
        </div>
      </section>

      <section className={styles.summaryCard}>
        <div className={styles.summaryHeading}>
          <h2>Tournament Overview</h2>
          <p>Current tournament details and operating status.</p>
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
        {setupSummary ? (
          <div className={styles.lastUpdated}>
            <span className={styles.summaryIcon}><CalendarDays aria-hidden="true" /></span>
            <div>
              <span className={styles.summaryLabel}>LAST UPDATED</span>
              <strong>{formatRegistrationTimestamp(setupSummary.updated_at)}</strong>
            </div>
          </div>
        ) : null}
      </section>

      {!isRegistrationsLoading && tournament ? (
        <section className={styles.summaryCard}>
          <div className={styles.summaryHeading}>
            <h2>Registration Summary</h2>
            <p>Where submitted registrations stand right now.</p>
          </div>
          <ul className={styles.registrationSummaryGrid}>
            <li><span>Total</span><strong>{registrationSummary.total}</strong></li>
            <li><span>Confirmed</span><strong>{registrationSummary.confirmed}</strong></li>
            <li><span>Pending</span><strong>{registrationSummary.pending}</strong></li>
            <li><span>Waitlisted</span><strong>{registrationSummary.waitlisted}</strong></li>
            <li><span>Cancelled</span><strong>{registrationSummary.cancelled}</strong></li>
            <li><span>Paid</span><strong>{registrationSummary.paid}</strong></li>
            <li><span>Unpaid</span><strong>{registrationSummary.unpaid}</strong></li>
          </ul>
        </section>
      ) : null}

      {!isSetupLoading && !isRegistrationsLoading && squadSummaries.length > 0 ? (
        <section className={styles.summaryCard}>
          <div className={styles.summaryHeading}>
            <h2>Squad Summary</h2>
            <p>Registered bowlers versus capacity for each squad.</p>
          </div>
          <div className={styles.squadSummaryTableWrap}>
            <table className={styles.squadSummaryTable}>
              <thead>
                <tr><th>Squad</th><th>Registered</th><th>Capacity</th><th>Available</th><th>Waitlist</th><th>Status</th></tr>
              </thead>
              <tbody>
                {squadSummaries.map(({ squad, registered, waitlisted, available, status }) => (
                  <tr key={squad.id}>
                    <td>{squad.name}</td>
                    <td>{registered}</td>
                    <td>{squad.capacity > 0 ? squad.capacity : '\u2014'}</td>
                    <td>{available === null ? '\u2014' : available}</td>
                    <td>{waitlisted}</td>
                    <td><OrganizerStatusBadge status={status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isTournamentLoading && !isSetupLoading && !isRegistrationsLoading && attentionItems.length > 0 ? (
        <section className={styles.summaryCard}>
          <div className={styles.summaryHeading}>
            <h2>Needs Attention</h2>
            <p>Items worth resolving before or during the tournament.</p>
          </div>
          <ul className={styles.tournamentAttentionList}>
            {attentionItems.map((item) => (
              <li key={item.id}>
                <span><AlertTriangle aria-hidden="true" />{item.message}</span>
                <Link href={item.href}>Resolve</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

