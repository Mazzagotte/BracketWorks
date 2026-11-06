'use client';

import { useEffect, useState } from 'react';
import { MoreHorizontal, UserMinus, UserPlus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  ICON_SIZE,
  Menu,
  MenuItem,
  Notice,
  Page,
  PageColumns,
  PageHeader,
  SelectField,
  TextField,
} from '@bracketworks/ui';

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
import cells from '@/components/organizer/OrganizerTable.module.css';
import styles from './team.module.css';

const EMPTY_VALUE = '\u2014';

const roleLabels: Record<StaffRole, string> = {
  tournament_admin: 'Tournament admin',
  entries_manager: 'Entries manager',
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

  const inviteCard = canManageStaff ? (
    <Card aria-label="Invite a team member">
      <CardHeader title="Invite staff" description="Invitations expire after 7 days." />
      <form onSubmit={handleInvite} className={styles.inviteForm}>
        {inviteError ? <Notice tone="danger" role="alert">{inviteError}</Notice> : null}
        {inviteMessage ? <Notice tone="success" role="status">{inviteMessage}</Notice> : null}
        <TextField
          label="Email"
          type="email"
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
          placeholder="teammate@example.com"
          required
        />
        <SelectField
          label="Role"
          value={inviteRole}
          onChange={(event) => setInviteRole(event.target.value as StaffRole)}
          helper={roleDescriptions[inviteRole]}
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>{roleLabels[role]}</option>
          ))}
        </SelectField>
        <div className={styles.inviteActions}>
          <Button type="submit" variant="primary" icon={<UserPlus size={ICON_SIZE.md} aria-hidden="true" />} disabled={isInviting}>
            {isInviting ? 'Sending...' : 'Send invitation'}
          </Button>
        </div>
      </form>
    </Card>
  ) : (
    <Notice tone="info">Team access is managed by the tournament owner and tournament admins.</Notice>
  );

  const membersCard = (
    <Card padding="flush" aria-label="Team members">
      <CardHeader title="Team members" description={`${staff.length} ${staff.length === 1 ? 'member' : 'members'}`} />
      <DataTable caption="Team members" className={cells.nowrap}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
            {showMemberActions ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
          </tr>
        </thead>
        <tbody>
          {staff.map((member) => {
            const isOwner = member.role === 'owner';
            const isSelf = currentUserId !== null && member.user_id === currentUserId;
            const canChange = !isOwner && member.id !== null;
            return (
              <tr key={`${member.user_id}-${member.role}`}>
                <td>
                  <span className={styles.identity}>
                    <Avatar name={member.display_name} />
                    <span className={cells.primaryText}>{member.display_name}</span>
                    {isSelf ? <Badge tone="neutral">You</Badge> : null}
                  </span>
                </td>
                <td data-tone="secondary">{member.email ?? EMPTY_VALUE}</td>
                <td>
                  {!canChange ? (
                    <Badge tone="neutral">Owner</Badge>
                  ) : canManageStaff ? (
                    <SelectField
                      label={`Role for ${member.display_name}`}
                      hideLabel
                      className={styles.roleSelect}
                      value={member.role}
                      onChange={(event) => { void handleRoleChange(member, event.target.value as StaffRole); }}
                      disabled={isMutating}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>{roleLabels[role]}</option>
                      ))}
                    </SelectField>
                  ) : (
                    <Badge tone="neutral">{roleLabels[member.role as StaffRole]}</Badge>
                  )}
                </td>
                {showMemberActions ? (
                  <td data-align="right">
                    {canChange ? (
                      <Menu triggerLabel={`More actions for ${member.display_name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                        <MenuItem
                          tone="danger"
                          icon={<UserMinus size={ICON_SIZE.md} />}
                          onSelect={() => setPendingRemoval(member)}
                          disabled={isMutating}
                          aria-label={`Remove ${member.display_name} from team`}
                        >
                          Remove from team
                        </MenuItem>
                      </Menu>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </DataTable>
    </Card>
  );

  return (
    <Page>
      <PageHeader title="Team" description={`Invite co-organizers and manage staff access for ${tournamentName}.`} />

      {error ? <Notice tone="danger" role="alert">{error}</Notice> : null}
      {isLoading ? <Notice tone="info" role="status">Loading team members and access settings...</Notice> : null}

      {!isLoading && !error ? <PageColumns main={membersCard} side={inviteCard} /> : null}

      <ConfirmDialog
        open={Boolean(pendingRemoval)}
        title="Remove team member?"
        message={`${pendingRemoval?.display_name ?? 'This team member'} will lose access to this tournament.`}
        confirmLabel={isMutating ? 'Removing...' : 'Remove member'}
        busy={isMutating}
        tone="danger"
        onConfirm={handleRemove}
        onCancel={() => setPendingRemoval(null)}
      />
    </Page>
  );
}
