'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { useMemo } from 'react';
import {
  ButtonLink,
  Card,
  CardHeader,
  DataTable,
  ICON_SIZE,
  Notice,
  Page,
  PageColumns,
  PageHeader,
  ProgressBar,
  StatGroup,
  buttonClassName,
} from '@bracketworks/ui';
import type { StatItem } from '@bracketworks/ui';

import { useTournamentContext } from '@/components/organizer/TournamentContext';
import AttentionList from '@/components/organizer/AttentionList';
import OrganizerStatusBadge from '@/components/organizer/OrganizerStatusBadge';
import SendToBracketWorksCard from '@/components/organizer/SendToBracketWorksCard';
import ShareTournamentCard from '@/components/organizer/ShareTournamentCard';
import TournamentStatusBadge from '@/components/organizer/dashboard/TournamentStatusBadge';
import {
  formatRegistrationDeadline,
  formatRegistrationTimestamp,
  formatSquadTime,
  formatTournamentDate,
  formatTournamentDateRange,
} from '@/components/organizer/organizerFormatting';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import {
  buildRegistrationSummary,
  buildSquadSummaries,
  buildTournamentAttentionItems,
} from '@/components/organizer/tournamentInsights';
import type { RegistrationSummary, SquadSummary } from '@/components/organizer/tournamentInsights';
import styles from './overview.module.css';

const EMPTY_VALUE = '—';

/** Squad labels: just the time when every squad is on one day, otherwise date and time. */
function squadLabels(summaries: SquadSummary[]): { sharedDate: string | null; label: (summary: SquadSummary) => string } {
  const dates = new Set(summaries.map(({ squad }) => squad.dateIso || ''));
  const sharedDate = dates.size === 1 && [...dates][0] ? [...dates][0] : null;
  return {
    sharedDate,
    label: ({ squad }) => {
      if (!squad.startTime) return squad.name;
      const time = formatSquadTime(squad.startTime);
      return sharedDate || !squad.dateIso ? time : `${formatTournamentDate(squad.dateIso)} · ${time}`;
    },
  };
}

function buildStats(registrationSummary: RegistrationSummary, squadSummaries: SquadSummary[]): StatItem[] {
  const stats: StatItem[] = [
    { label: 'Registrations', value: String(registrationSummary.total) },
    {
      label: 'Paid',
      value: String(registrationSummary.paid),
      detail: `${registrationSummary.unpaid} unpaid`,
    },
    { label: 'Squads', value: String(squadSummaries.length) },
  ];

  if (squadSummaries.length > 0) {
    stats.push({ label: 'Bowlers', value: String(squadSummaries.reduce((total, summary) => total + summary.bowlerCount, 0)) });
  }

  const limited = squadSummaries.filter((summary) => summary.availableBowlerSpots !== null);
  if (limited.length > 0) {
    const capacity = limited.reduce((total, summary) => total + summary.squad.capacity, 0);
    const open = limited.reduce((total, summary) => total + (summary.availableBowlerSpots ?? 0), 0);
    stats.push({ label: 'Bowler spots open', value: String(open), detail: `of ${capacity}` });
  }

  return stats;
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
    registrationCloseTime,
    tournamentTimeZone,
    isTournamentLoading,
    isSetupLoading,
    isRegistrationsLoading,
    tournamentError,
    setupError,
    registrationsError,
  } = useTournamentContext();

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
      registrationCloseTime,
      timeZone: tournamentTimeZone,
      squadSummaries,
      registrationSummary,
    });
  }, [eventCount, hasRulesDocument, registrationCloseIso, registrationCloseTime, registrationSummary, setupSummary, squadSummaries, tournament, tournamentId, tournamentTimeZone]);

  const location = tournament?.location?.trim() || 'Location not set';
  const publicUrl = tournament?.is_public ? organizerRoutes.publicPage(tournamentId) : null;
  const isDataLoaded = !isTournamentLoading && !isSetupLoading && !isRegistrationsLoading && Boolean(tournament);

  const details: { label: string; value: string }[] = tournament
    ? [
        { label: 'Location', value: location },
        { label: 'Visibility', value: tournament.is_public ? 'Public: anyone can view and register' : 'Private: only invited users can view' },
        { label: 'Setup', value: setupSummary?.is_published ? 'Published' : 'Draft changes are pending' },
        ...(registrationCloseIso ? [{ label: 'Registration closes', value: formatRegistrationDeadline(registrationCloseIso, registrationCloseTime, tournamentTimeZone) }] : []),
        ...(setupSummary ? [{ label: 'Last updated', value: formatRegistrationTimestamp(setupSummary.updated_at) }] : []),
      ]
    : [];

  const statusRows = [
    { label: 'Confirmed', value: registrationSummary.confirmed },
    { label: 'Pending', value: registrationSummary.pending },
    { label: 'Waitlisted', value: registrationSummary.waitlisted },
    { label: 'Cancelled', value: registrationSummary.cancelled },
  ];

  return (
    <Page>
      <PageHeader
        title={tournament?.name || 'Tournament'}
        badge={tournament ? <TournamentStatusBadge isPublic={Boolean(tournament.is_public)} hasPublishedSetup={Boolean(setupSummary?.is_published)} /> : null}
        description={`${formatTournamentDateRange(tournament?.start_date, tournament?.end_date)} · ${location}`}
        actions={
          <>
            {publicUrl ? (
              <ButtonLink
                href={publicUrl}
                variant="secondary"
                target="_blank"
                rel="noreferrer"
                icon={<ExternalLink size={ICON_SIZE.md} aria-hidden="true" />}
                aria-label="View public page (opens in a new tab)"
              >
                View public page
              </ButtonLink>
            ) : null}
            <Link href={organizerRoutes.setup(tournamentId)} className={buttonClassName({ variant: 'primary' })}>
              Edit tournament
            </Link>
          </>
        }
      />

      {tournamentError ? <Notice tone="danger" role="alert">{tournamentError}</Notice> : null}
      {setupError ? <Notice tone="danger" role="alert">Setup data: {setupError}</Notice> : null}
      {registrationsError ? <Notice tone="danger" role="alert">Registration data: {registrationsError}</Notice> : null}

      {!isRegistrationsLoading && tournament ? (
        <StatGroup label="Tournament summary" items={buildStats(registrationSummary, squadSummaries)} />
      ) : null}

      <PageColumns
        main={
          <>
            {isDataLoaded ? (
              <AttentionList
                items={attentionItems}
                description="Things to handle before or during the tournament."
                actionLabel="Review"
              />
            ) : null}

            {!isRegistrationsLoading && tournament ? (
              <Card aria-label="Registration status">
                <CardHeader title="Registration status" />
                <dl className={styles.details}>
                  {statusRows.map((item) => (
                    <div key={item.label} className={`${styles.detailRow} ${styles.countRow}`}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ) : null}
          </>
        }
        side={
          <>
            {tournament ? (
              <Card aria-label="Details">
                <CardHeader title="Details" />
                <dl className={styles.details}>
                  {details.map((item) => (
                    <div key={item.label} className={styles.detailRow}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ) : null}
            {tournament ? <SendToBracketWorksCard tournamentId={tournamentId} /> : null}
            {tournament ? (
              <ShareTournamentCard
                tournamentId={tournamentId}
                tournamentName={tournament.name || 'Tournament'}
                dateText={formatTournamentDateRange(tournament.start_date, tournament.end_date)}
                locationText={location}
                isPublic={Boolean(tournament.is_public)}
              />
            ) : null}
          </>
        }
      />

      {!isSetupLoading && !isRegistrationsLoading && squadSummaries.length > 0 ? (() => {
        const { sharedDate, label } = squadLabels(squadSummaries);
        const hasWaitlist = squadSummaries.some((summary) => summary.waitlistedBowlerCount > 0);
        return (
          <Card padding="flush" aria-label="Squads">
            <CardHeader
              title="Squads"
              description={sharedDate
                ? `All squads are on ${formatTournamentDate(sharedDate)}. Capacity is counted in bowler spots.`
                : 'Capacity is counted in bowler spots.'}
            />
            <DataTable caption="Registrations and bowlers for each squad">
              <thead>
                <tr>
                  <th scope="col">Squad</th>
                  <th scope="col" data-align="right">Registrations</th>
                  <th scope="col">Bowlers</th>
                  <th scope="col" data-align="right">Spots open</th>
                  {hasWaitlist ? <th scope="col" data-align="right">Waitlisted bowlers</th> : null}
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {squadSummaries.map((summary) => {
                  const { squad, registrationCount, bowlerCount, waitlistedBowlerCount, availableBowlerSpots, status } = summary;
                  const name = label(summary);
                  return (
                    <tr key={squad.id}>
                      <td className={styles.squadName}>{name}</td>
                      <td data-align="right">{registrationCount}</td>
                      <td className={styles.fillCell}>
                        {squad.capacity > 0 ? (
                          <ProgressBar
                            value={bowlerCount}
                            max={squad.capacity}
                            label={`${name} bowlers`}
                            valueText={`${bowlerCount} of ${squad.capacity}`}
                          />
                        ) : `${bowlerCount}`}
                      </td>
                      <td data-align="right">{availableBowlerSpots === null ? EMPTY_VALUE : availableBowlerSpots}</td>
                      {hasWaitlist ? <td data-align="right">{waitlistedBowlerCount}</td> : null}
                      <td><OrganizerStatusBadge status={status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </Card>
        );
      })() : null}
    </Page>
  );
}
