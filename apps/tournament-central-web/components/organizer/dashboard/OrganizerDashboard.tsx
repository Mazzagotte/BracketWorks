'use client';

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ICON_SIZE,
  Notice,
  Page,
  PageColumns,
  PageHeader,
  StatGroup,
  buttonClassName,
} from '@bracketworks/ui';
import { Plus, Trophy } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import OrganizerAttentionList from './OrganizerAttentionList';
import TournamentGrid from './TournamentGrid';
import {
  deleteTournament,
  listMyTcStaffInvitations,
  respondToTcStaffInvitation,
  type TcStaffInvitationEntry,
} from '../organizerApi';
import { type OrganizerDashboardTournament, useOrganizerDashboard } from './useOrganizerDashboard';
import styles from './OrganizerDashboard.module.css';
import ConfirmDialog from '../ConfirmDialog';
import { organizerRoutes } from '../organizerRoutes';
import { formatMoney } from '../organizerFormatting';

const NEW_TOURNAMENT_HREF = '/organizer/tournaments/new/setup';

function CreateTournamentLink() {
  return (
    <Link href={NEW_TOURNAMENT_HREF} className={buttonClassName({ variant: 'primary' })}>
      <Plus size={ICON_SIZE.md} aria-hidden="true" />
      Create tournament
    </Link>
  );
}

export default function OrganizerDashboard() {
  const [displayName, setDisplayName] = useState('Organizer');
  const [deletingTournamentId, setDeletingTournamentId] = useState<number | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<OrganizerDashboardTournament | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [staffInvitations, setStaffInvitations] = useState<TcStaffInvitationEntry[]>([]);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [respondingInvitationId, setRespondingInvitationId] = useState<number | null>(null);
  const { tournaments, attentionItems, upcomingItems, isLoading, error, refresh } = useOrganizerDashboard();

  useEffect(() => {
    // Authentication is enforced once by OrganizerAuthGuard in the parent layout.
    localStorage.removeItem('tc_active_tournament_name');
    localStorage.removeItem('tc_active_squad_name');
    window.dispatchEvent(new Event('storage'));
    setDisplayName(localStorage.getItem('first_name') || localStorage.getItem('last_username') || 'Organizer');
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    void listMyTcStaffInvitations(token)
      .then(setStaffInvitations)
      .catch((caughtError: unknown) => {
        setInvitationError(caughtError instanceof Error ? caughtError.message : 'Unable to load team invitations.');
      });
  }, []);

  const handleStaffInvitation = async (invitationId: number, decision: 'accept' | 'decline') => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setRespondingInvitationId(invitationId);
    setInvitationError(null);
    try {
      await respondToTcStaffInvitation(token, invitationId, decision);
      setStaffInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
      if (decision === 'accept') await refresh();
    } catch (caughtError) {
      setInvitationError(caughtError instanceof Error ? caughtError.message : 'Unable to respond to team invitation.');
    } finally {
      setRespondingInvitationId(null);
    }
  };

  const summaryStats = useMemo(() => {
    const totalRegistrations = tournaments.reduce((total, tournament) => total + (tournament.entryCount ?? 0), 0);
    const upcomingSquads = tournaments.reduce((total, tournament) => total + tournament.upcomingSquadCount, 0);
    const amountCollectedCents = tournaments.reduce((total, tournament) => total + tournament.amountPaidCents, 0);
    return [
      { label: 'Total registrations', value: totalRegistrations, detail: 'Across all tournaments' },
      { label: 'Upcoming squads', value: upcomingSquads, detail: 'Next 7 days' },
      { label: 'Amount collected', value: formatMoney(amountCollectedCents), detail: 'Recorded payments' },
      { label: 'Tournaments', value: tournaments.length, detail: 'In your workspace' },
    ];
  }, [tournaments]);

  const formattedUpcoming = useMemo(() => upcomingItems.map((item) => ({
    ...item,
    dateLabel: item.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
  })), [upcomingItems]);

  const handleDeleteTournament = async () => {
    const tournament = deleteConfirmation;
    if (!tournament) return;
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
      setDeleteConfirmation(null);
    } catch (caughtError) {
      setDeleteError(caughtError instanceof Error ? caughtError.message : 'Failed to delete tournament.');
    } finally {
      setDeletingTournamentId(null);
    }
  };

  const handleDeleteRequest = (tournament: OrganizerDashboardTournament) => {
    setDeleteError(null);
    setDeleteConfirmation(tournament);
  };

  return (
    <Page>
      <PageHeader
        overline="Organizer workspace"
        title="Your tournament command center"
        description={`${displayName ? `${displayName}, here` : 'Here'} is what's happening across your tournaments.`}
        actions={<CreateTournamentLink />}
      />

      {staffInvitations.length > 0 || invitationError ? (
        <Card aria-label="Tournament team invitations">
          <CardHeader title="Team invitations" description="Accept to help run these tournaments." />
          {invitationError ? <Notice tone="danger" role="alert">{invitationError}</Notice> : null}
          {staffInvitations.length > 0 ? (
            <ul className={styles.rows}>
              {staffInvitations.map((invitation) => (
                <li className={styles.invitationRow} key={invitation.id}>
                  <div className={styles.rowText}>
                    <span className={styles.rowTitle}>{invitation.tournament_name}</span>
                    <span className={styles.rowMeta}>{`${invitation.role.replaceAll('_', ' ')} role`}</span>
                  </div>
                  <div className={styles.rowActions}>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={respondingInvitationId !== null}
                      onClick={() => { void handleStaffInvitation(invitation.id, 'decline'); }}
                    >
                      Decline
                    </Button>
                    <Button
                      variant="accent-outline"
                      size="sm"
                      disabled={respondingInvitationId !== null}
                      onClick={() => { void handleStaffInvitation(invitation.id, 'accept'); }}
                    >
                      {respondingInvitationId === invitation.id ? 'Working...' : 'Accept'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Notice
          tone="danger"
          role="alert"
          action={<Button variant="secondary" size="sm" onClick={() => { void refresh(); }}>Try again</Button>}
        >
          We couldn&apos;t load your tournaments.
        </Notice>
      ) : null}

      {deleteError && !deleteConfirmation ? <Notice tone="danger" role="alert">{deleteError}</Notice> : null}

      {!error && !isLoading ? <StatGroup label="Tournament summary" items={summaryStats} /> : null}

      {isLoading ? (
        <Card aria-label="Loading tournaments" aria-busy="true">
          <p className={styles.loading} role="status">Loading your tournaments...</p>
        </Card>
      ) : error ? null : tournaments.length === 0 ? (
        <Card aria-label="No tournaments">
          <EmptyState
            icon={<Trophy size={ICON_SIZE['2xl']} />}
            title="No tournaments yet"
            description="Create your first tournament to set up events, squads, registration, fees, documents, and publishing."
            action={<CreateTournamentLink />}
          />
        </Card>
      ) : (
        <PageColumns
          main={
            <TournamentGrid
              tournaments={tournaments}
              deletingTournamentId={deletingTournamentId}
              onDeleteTournament={handleDeleteRequest}
            />
          }
          side={
            <>
              <OrganizerAttentionList items={attentionItems} />
              <Card aria-label="Upcoming activity">
                <CardHeader title="On the calendar" />
                {formattedUpcoming.length > 0 ? (
                  <ul className={styles.rows}>
                    {formattedUpcoming.map((item) => (
                      <li key={item.tournamentId} className={styles.calendarRow}>
                        <Link href={organizerRoutes.overview(item.tournamentId)} className={styles.rowLink}>{item.name}</Link>
                        <span className={styles.rowMeta}>{item.dateLabel}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.rowMeta}>No upcoming events.</p>
                )}
              </Card>
            </>
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteConfirmation)}
        title="Delete tournament?"
        message={`Are you sure you want to delete "${deleteConfirmation?.name ?? ''}"? This action cannot be undone.`}
        confirmLabel={deletingTournamentId ? 'Deleting...' : 'Delete tournament'}
        tone="danger"
        busy={Boolean(deletingTournamentId)}
        error={deleteError}
        onConfirm={() => { void handleDeleteTournament(); }}
        onCancel={() => setDeleteConfirmation(null)}
      />
    </Page>
  );
}
