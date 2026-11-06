"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MoreHorizontal, Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, ConfirmDialog, ICON_SIZE, Menu, MenuItem, SelectField, TextField } from '@bracketworks/ui';

import { apiClient } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useToast } from '../../components/Toast';
import { SettingsSection } from './SettingsSection';
import styles from './dashboard-settings-page.module.css';

type StaffRole = 'tournament_admin' | 'entries_manager' | 'scorer' | 'viewer';
type StaffMember = {
  id: number | null;
  tournament_id: number;
  user_id: number;
  role: StaffRole | 'owner';
  display_name: string;
  email: string;
};

const roleLabels: Record<StaffMember['role'], string> = {
  owner: 'Owner', tournament_admin: 'Tournament admin', entries_manager: 'Entries manager',
  scorer: 'Scorer', viewer: 'Viewer',
};

const ROLE_OPTIONS: StaffRole[] = ['tournament_admin', 'entries_manager', 'scorer', 'viewer'];

export function TournamentStaffPanel({ tournamentId, ownerUserId, inModal = false }: { tournamentId: number; ownerUserId: number; inModal?: boolean }) {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('scorer');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<StaffMember | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    setMembers([]);
    try {
      setMembers(await apiClient.get<StaffMember[]>(`/api/v1/tournament-staff/tournaments/${tournamentId}`, false));
    } catch {
      addToast({ type: 'error', message: 'Unable to load tournament staff.' });
    } finally {
      setLoading(false);
    }
  }, [addToast, tournamentId]);

  useEffect(() => { void loadMembers(); }, [loadMembers]);

  const currentMembership = useMemo(
    () => members.find(member => String(member.user_id) === currentUser?.id),
    [currentUser?.id, members],
  );
  const canManage = String(ownerUserId) === currentUser?.id || currentMembership?.role === 'tournament_admin' || Boolean(currentUser?.isAdmin);

  const invite = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || submitting) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/v1/tournament-staff/${tournamentId}/invitations`, { email: normalizedEmail, role });
      setEmail('');
      addToast({ type: 'success', message: `In-app invitation created for ${normalizedEmail}. They can accept it when they sign in.` });
    } catch (error) {
      addToast({ type: 'error', message: error instanceof Error ? error.message : 'Unable to invite staff member.' });
    } finally {
      setSubmitting(false);
    }
  };

  const updateRole = async (member: StaffMember, nextRole: StaffRole) => {
    if (member.id === null || member.role === nextRole) return;
    setUpdatingMemberId(member.id);
    try {
      await apiClient.patch(`/api/v1/tournament-staff/${tournamentId}/members/${member.id}`, { role: nextRole });
      setMembers(current => current.map(item => item.id === member.id ? { ...item, role: nextRole } : item));
      addToast({ type: 'success', message: `${member.display_name}'s role was updated.` });
    } catch {
      addToast({ type: 'error', message: 'Unable to update the staff role.' });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const remove = async (member: StaffMember) => {
    if (member.id === null) return;
    setRemovingMemberId(member.id);
    try {
      await apiClient.delete(`/api/v1/tournament-staff/${tournamentId}/members/${member.id}`);
      setMembers(current => current.filter(item => item.id !== member.id));
      addToast({ type: 'success', message: `${member.display_name} was removed.` });
    } catch {
      addToast({ type: 'error', message: 'Unable to remove the staff member.' });
    } finally {
      setRemovingMemberId(null);
      setPendingRemoval(null);
    }
  };

  return (
    <SettingsSection id="tournament-staff" inModal={inModal} title="Tournament staff" description="Give each operator only the access their role needs.">
      {canManage ? (
        <div className={styles.inviteRow}>
          <TextField label="Staff email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="staff@example.com" />
          <SelectField label="Role" value={role} onChange={event => setRole(event.target.value as StaffRole)}>
            {ROLE_OPTIONS.map(option => <option key={option} value={option}>{roleLabels[option]}</option>)}
          </SelectField>
          <Button variant="secondary" icon={<UserPlus size={ICON_SIZE.md} aria-hidden="true" />} onClick={() => void invite()} disabled={!email.trim() || submitting}>
            {submitting ? 'Inviting...' : 'Invite'}
          </Button>
        </div>
      ) : null}

      {loading ? <p className={styles.status} role="status">Loading staff...</p> : (
        <ul className={styles.staffList}>
          {members.map(member => {
            const busy = updatingMemberId === member.id || removingMemberId === member.id;
            return (
              <li className={styles.staffRow} key={member.id ?? member.user_id}>
                <div className={styles.staffIdentity}>
                  <span className={styles.staffName}>{member.display_name}</span>
                  <span className={styles.meta}>{member.email}</span>
                </div>
                {canManage && member.role !== 'owner' ? (
                  <div className={styles.staffControls}>
                    <SelectField
                      label={`Role for ${member.display_name}`}
                      hideLabel
                      value={member.role}
                      onChange={event => void updateRole(member, event.target.value as StaffRole)}
                      disabled={busy}
                    >
                      {ROLE_OPTIONS.map(option => <option key={option} value={option}>{roleLabels[option]}</option>)}
                    </SelectField>
                    <Menu triggerLabel={`More actions for ${member.display_name}`} trigger={<MoreHorizontal size={ICON_SIZE.md} aria-hidden="true" />}>
                      <MenuItem tone="danger" icon={<Trash2 size={ICON_SIZE.md} aria-hidden="true" />} disabled={busy} onSelect={() => setPendingRemoval(member)}>
                        Remove from tournament
                      </MenuItem>
                    </Menu>
                  </div>
                ) : <Badge tone="neutral">{roleLabels[member.role]}</Badge>}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingRemoval !== null}
        tone="danger"
        title={`Remove ${pendingRemoval?.display_name ?? 'this person'}?`}
        description="They lose access to this tournament right away."
        confirmLabel="Remove"
        busy={removingMemberId !== null}
        busyLabel="Removing..."
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => { if (pendingRemoval) void remove(pendingRemoval); }}
      />
    </SettingsSection>
  );
}
