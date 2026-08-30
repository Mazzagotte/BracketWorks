'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, UserPlus } from 'lucide-react';

import {
  inviteTournamentStaff,
  listTournamentStaff,
  removeTournamentStaffMember,
  updateTournamentStaffRole,
  type StaffRole,
  type TournamentStaffEntry,
} from '@/components/organizer/organizerApi';
import { useTournamentContext } from '@/components/organizer/TournamentContext';
import ConfirmDialog from '@/components/organizer/ConfirmDialog';
import { organizerRoutes } from '@/components/organizer/organizerRoutes';
import styles from '../page.module.css';
import localStyles from './team.module.css';

const roleLabels: Record<StaffRole, string> = {
  tournament_admin: 'Tournament Admin',
  entries_manager: 'Entries Manager',
  scorer: 'Scorer',
  viewer: 'Viewer',
};

const roleOptions: StaffRole[] = ['tournament_admin', 'entries_manager', 'scorer', 'viewer'];

function getCurrentUserId(): number | null {
  const stored = localStorage.getItem('user_id');
  const parsed = stored ? Number(stored) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

export default function OrganizerTournamentTeamPage() {
  const { tournamentId, tournament } = useTournamentContext();
  const tournamentName = tournament?.name || 'Tournament';
  const [staff, setStaff] = useState<TournamentStaffEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<StaffRole>('viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<TournamentStaffEntry | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const loadStaff = async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const rows = await listTournamentStaff(token, tournamentId);
      setStaff(rows);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to load team members.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
    void loadStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = sessionStorage.getItem('access_token');
    if (!token) return;
    setIsInviting(true);
    setInviteMessage(null);
    setInviteError(null);
    try {
      const result = await inviteTournamentStaff(token, tournamentId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteMessage(
        result.email_sent
          ? `Invitation sent to ${result.email}.`
          : `Invitation created for ${result.email}, but the email could not be sent.`,
      );
      setInviteEmail('');
      setInviteRole('viewer');
    } catch (caughtError) {
      setInviteError(caughtError instanceof Error ? caughtError.message : 'Unable to send invitation.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (member: TournamentStaffEntry, role: StaffRole) => {
    const token = sessionStorage.getItem('access_token');
    if (!token || member.id === null) return;
    setIsMutating(true);
    try {
      await updateTournamentStaffRole(token, tournamentId, member.id, role);
      await loadStaff();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to update role.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemove = async () => {
    const token = sessionStorage.getItem('access_token');
    if (!token || !pendingRemoval || pendingRemoval.id === null) {
      setPendingRemoval(null);
      return;
    }
    setIsMutating(true);
    try {
      await removeTournamentStaffMember(token, tournamentId, pendingRemoval.id);
      await loadStaff();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to remove team member.');
    } finally {
      setIsMutating(false);
      setPendingRemoval(null);
    }
  };

  return (
    <main className={styles.registrationPage}>
      <header className={styles.registrationHeader}>
        <div>
          <span className={styles.registrationEyebrow}>Tournament team</span>
          <h1>Team</h1>
          <p>Invite co-organizers and manage staff access for {tournamentName}.</p>
        </div>
        <Link href={organizerRoutes.overview(tournamentId)} className={styles.registrationBackButton}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Overview
        </Link>
      </header>

      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {isLoading ? <section className={styles.registrationLoading}>Loading team...</section> : null}

      {!isLoading && !error ? (
        <>
          <section className={styles.registrationTableCard} aria-label="Invite a team member">
            <div className={styles.registrationPanelHeading}>
              <div>
                <h2>Invite Staff</h2>
                <p>Invitations expire after 7 days.</p>
              </div>
            </div>
            <form onSubmit={handleInvite} className={`${styles.entryEditGrid} ${localStyles.inviteForm}`}>
              {inviteError ? <p className={`${styles.error} ${localStyles.fullWidth}`} role="alert">{inviteError}</p> : null}
              {inviteMessage ? <p role="status" className={`${localStyles.successText} ${localStyles.fullWidth}`}>{inviteMessage}</p> : null}
              <label>
                Email
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  required
                />
              </label>
              <label>
                Role
                <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as StaffRole)}>
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{roleLabels[role]}</option>
                  ))}
                </select>
              </label>
              <div className={localStyles.inviteActions}>
                <button type="submit" className={styles.manualRegistrationButton} disabled={isInviting}>
                  <UserPlus size={14} aria-hidden="true" /> {isInviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </section>

          <section className={styles.registrationTableCard} aria-label="Team members">
            <div className={styles.registrationPanelHeading}>
              <div>
                <h2>Team Members</h2>
                <p>{staff.length} {staff.length === 1 ? 'member' : 'members'}</p>
              </div>
            </div>
            <div className={styles.registrationTableWrap}>
              <table className={styles.registrationTable}>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {staff.map((member) => {
                    const isOwner = member.role === 'owner';
                    const isSelf = currentUserId !== null && member.user_id === currentUserId;
                    return (
                      <tr key={`${member.user_id}-${member.role}`}>
                        <td><strong>{member.display_name}</strong>{isSelf ? <span> (You)</span> : null}</td>
                        <td>{member.email ?? '\u2014'}</td>
                        <td>
                          {isOwner || member.id === null ? (
                            'Owner'
                          ) : (
                            <select
                              value={member.role}
                              onChange={(event) => handleRoleChange(member, event.target.value as StaffRole)}
                              disabled={isMutating}
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>{roleLabels[role]}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td>
                          {!isOwner && member.id !== null ? (
                            <button
                              type="button"
                              className={styles.registrationMoreButton}
                              onClick={() => setPendingRemoval(member)}
                              disabled={isMutating}
                            >
                              Remove
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove team member?"
        message={`${pendingRemoval?.display_name ?? 'This team member'} will lose access to this tournament.`}
        confirmLabel="Remove"
        tone="danger"
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoval(null)}
      />
    </main>
  );
}
