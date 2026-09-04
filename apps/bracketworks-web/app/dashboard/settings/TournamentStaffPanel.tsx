"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus } from 'lucide-react';

import { apiClient } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useToast } from '../../components/Toast';
import formStyles from '../../styles/forms.module.css';
import buttonStyles from '../../styles/buttons.module.css';
import cardStyles from '../../styles/cards.module.css';
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
  owner: 'Owner', tournament_admin: 'Tournament Admin', entries_manager: 'Entries Manager',
  scorer: 'Scorer', viewer: 'Viewer',
};

export function TournamentStaffPanel({ tournamentId, ownerUserId }: { tournamentId: number; ownerUserId: number }) {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffRole>('scorer');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<number | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<number | null>(null);

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
      addToast({ type: 'success', message: `Invitation created for ${normalizedEmail}.` });
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
    if (member.id === null || !window.confirm(`Remove ${member.display_name} from this tournament?`)) return;
    setRemovingMemberId(member.id);
    try {
      await apiClient.delete(`/api/v1/tournament-staff/${tournamentId}/members/${member.id}`);
      setMembers(current => current.filter(item => item.id !== member.id));
      addToast({ type: 'success', message: `${member.display_name} was removed.` });
    } catch {
      addToast({ type: 'error', message: 'Unable to remove the staff member.' });
    } finally {
      setRemovingMemberId(null);
    }
  };

  return (
    <section className={`${cardStyles.cardPrimary} ${styles.staffPanel}`} aria-labelledby="tournament-staff-title">
      <div className={`${cardStyles.cardHeaderSection} ${styles.staffHeader}`}>
        <span className={styles.staffIcon}><ShieldCheck aria-hidden="true" /></span>
        <div>
          <h2 id="tournament-staff-title">Tournament Staff</h2>
          <p>Give each operator only the access needed for their role.</p>
        </div>
      </div>

      <div className={cardStyles.cardBodySection}>
        {canManage && (
          <div className={styles.staffInviteRow}>
            <input className={`${formStyles.field} ${styles.staffField}`} type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="staff@example.com" aria-label="Staff email" />
            <select className={`${formStyles.field} ${styles.staffField}`} value={role} onChange={event => setRole(event.target.value as StaffRole)} aria-label="Staff role">
              <option value="tournament_admin">Tournament Admin</option>
              <option value="entries_manager">Entries Manager</option>
              <option value="scorer">Scorer</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.small}`} onClick={() => void invite()} disabled={!email.trim() || submitting}>
              <UserPlus aria-hidden="true" />{submitting ? 'Inviting…' : 'Invite'}
            </button>
          </div>
        )}

        {loading ? <p className={styles.staffState} role="status">Loading staff…</p> : (
          <div className={styles.staffList}>
            {members.map(member => (
              <div className={styles.staffRow} key={member.id ?? member.user_id}>
                <div><strong>{member.display_name}</strong><span>{member.email}</span></div>
                {canManage && member.role !== 'owner' ? (
                  <div className={styles.staffControls}>
                    <select className={`${formStyles.field} ${styles.staffField}`} value={member.role} onChange={event => void updateRole(member, event.target.value as StaffRole)} aria-label={`Role for ${member.display_name}`} disabled={updatingMemberId === member.id || removingMemberId === member.id}>
                      <option value="tournament_admin">Tournament Admin</option>
                      <option value="entries_manager">Entries Manager</option>
                      <option value="scorer">Scorer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button type="button" className={styles.staffRemoveButton} onClick={() => void remove(member)} aria-label={`Remove ${member.display_name}`} disabled={updatingMemberId === member.id || removingMemberId === member.id}><Trash2 aria-hidden="true" /></button>
                  </div>
                ) : <span className={styles.staffRole}>{roleLabels[member.role]}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
