'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Mail, Shield, UserMinus, UserPlus, UsersRound } from 'lucide-react';

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

const roleDescriptions: Record<StaffRole, string> = {
  tournament_admin: 'Manage tournament setup, registrations, and staff access.',
  entries_manager: 'Review entries and manage bowler registrations.',
  scorer: 'View Tournament Central information; scoring is managed separately in BracketWorks.',
  viewer: 'View tournament information without making changes.',
};

function getCurrentUserId(): number | null {
  const stored = localStorage.getItem('user_id');
  const parsed = stored ? Number(stored) : NaN;
  return Number.isInteger(parsed) ? parsed : null;
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';
}

export default function OrganizerTournamentTeamPage() {
  const { tournamentId, tournament } = useTournamentContext();
  const tournamentName = tournament?.name || 'Tournament';
  const [staff, setStaff] = useState<TournamentStaffEntry[]>([]);
  const [canManageStaff, setCanManageStaff] = useState(false);
  const showMemberActions = canManageStaff && staff.some((member) => member.role !== 'owner' && member.id !== null);
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
      setStaff(rows.members);
      setCanManageStaff(rows.can_manage_staff);
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
      {isLoading ? (
        <div className={localStyles.loadingLayout} role="status" aria-label="Loading tournament team" aria-busy="true">
          <span className={localStyles.loadingAnnouncement}>Loading team members and access settings...</span>
          <section className={`${styles.registrationTableCard} ${localStyles.loadingCard}`} aria-hidden="true">
            <div className={styles.registrationPanelHeading}>
              <div>
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonHeading}`} />
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonCaption}`} />
              </div>
            </div>
            <div className={localStyles.loadingInviteFields}>
              <div className={localStyles.loadingField}>
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonLabel}`} />
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonInput}`} />
              </div>
              <div className={localStyles.loadingField}>
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonLabel}`} />
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonInput}`} />
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonRoleHint}`} />
              </div>
              <div className={localStyles.loadingInviteAction}>
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonButton}`} />
              </div>
            </div>
          </section>

          <section className={`${styles.registrationTableCard} ${localStyles.loadingCard}`} aria-hidden="true">
            <div className={styles.registrationPanelHeading}>
              <div>
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonHeading}`} />
                <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonCaption}`} />
              </div>
            </div>
            <div className={localStyles.loadingMemberList}>
              {Array.from({ length: 3 }, (_, index) => (
                <div className={localStyles.loadingMemberRow} key={index}>
                  <div className={localStyles.loadingMemberIdentity}>
                    <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonAvatar}`} />
                    <div className={localStyles.loadingMemberText}>
                      <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonName}`} />
                      <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonEmail}`} />
                    </div>
                  </div>
                  <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonRole}`} />
                  <div className={`${localStyles.skeletonBlock} ${localStyles.skeletonRemove}`} />
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && !error ? (
        <>
          {canManageStaff ? <section className={styles.registrationTableCard} aria-label="Invite a team member">
            <div className={styles.registrationPanelHeading}>
              <div>
                <h2><span className={localStyles.headingIcon}><Mail size={15} aria-hidden="true" /></span>Invite Staff</h2>
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
                <span className={localStyles.roleDescription}>{roleDescriptions[inviteRole]}</span>
              </label>
              <div className={localStyles.inviteActions}>
                <button type="submit" className={`${styles.manualRegistrationButton} ${localStyles.inviteButton}`} disabled={isInviting}>
                  <UserPlus size={14} aria-hidden="true" /> {isInviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </section> : (
            <p className={styles.registrationTableCard}>
              Team access is managed by the tournament owner and Tournament Admins.
            </p>
          )}

          <section className={styles.registrationTableCard} aria-label="Team members">
            <div className={styles.registrationPanelHeading}>
              <div>
                <h2><span className={localStyles.headingIcon}><UsersRound size={15} aria-hidden="true" /></span>Team Members</h2>
                <p className={localStyles.memberCount}>
                  <UsersRound size={13} aria-hidden="true" />
                  {staff.length} {staff.length === 1 ? 'member' : 'members'}
                </p>
              </div>
            </div>
            <div className={styles.registrationTableWrap}>
              <table className={`${styles.registrationTable} ${localStyles.teamTable} ${showMemberActions ? '' : localStyles.teamTableWithoutActions}`}>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th>{showMemberActions ? <th>Actions</th> : null}</tr>
                </thead>
                <tbody>
                  {staff.map((member) => {
                    const isOwner = member.role === 'owner';
                    const isSelf = currentUserId !== null && member.user_id === currentUserId;
                    return (
                      <tr key={`${member.user_id}-${member.role}`}>
                        <td>
                          <div className={localStyles.memberIdentity}>
                            <span className={localStyles.memberAvatar} aria-hidden="true">{getInitials(member.display_name)}</span>
                            <div>
                              <strong>{member.display_name}</strong>
                              {isSelf ? <span className={localStyles.youBadge}>You</span> : null}
                            </div>
                          </div>
                        </td>
                        <td><span className={localStyles.memberEmail}>{member.email ?? '\u2014'}</span></td>
                        <td>
                          {isOwner || member.id === null ? (
                            <span className={`${localStyles.roleBadge} ${localStyles.ownerRole}`}><Shield size={12} aria-hidden="true" />Owner</span>
                          ) : canManageStaff ? (
                            <select
                              value={member.role}
                              className={localStyles.roleSelect}
                              onChange={(event) => handleRoleChange(member, event.target.value as StaffRole)}
                              disabled={isMutating}
                              aria-label={`Role for ${member.display_name}`}
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>{roleLabels[role]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={localStyles.roleBadge}>{roleLabels[member.role as StaffRole]}</span>
                          )}
                        </td>
                        {showMemberActions ? (
                          <td>
                            {!isOwner && member.id !== null ? (
                              <button
                                type="button"
                                className={localStyles.removeButton}
                                onClick={() => setPendingRemoval(member)}
                                disabled={isMutating}
                                aria-label={`Remove ${member.display_name} from team`}
                              >
                                <UserMinus size={14} aria-hidden="true" /> Remove
                              </button>
                            ) : <span className={localStyles.noAction}>—</span>}
                          </td>
                        ) : null}
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
