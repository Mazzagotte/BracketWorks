"use client";

import { useCallback, useEffect, useState } from 'react';
import { UserRoundCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { apiClient } from '../app/lib/api';
import styles from './StaffInvitationNotice.module.css';

type Invitation = { id: number; tournament_id: number; tournament_name: string; role: string; expires_at: string };

export function StaffInvitationNotice({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    try { setInvitations(await apiClient.get<Invitation[]>('/api/v1/tournament-staff/invitations/mine', false)); }
    catch { setInvitations([]); }
  }, [enabled]);
  useEffect(() => { void load(); }, [load]);

  const respond = async (invitation: Invitation, action: 'accept' | 'decline') => {
    await apiClient.post(`/api/v1/tournament-staff/invitations/${invitation.id}/${action}`);
    setInvitations(current => current.filter(item => item.id !== invitation.id));
    if (action === 'accept') router.push(`/dashboard?tournament_id=${invitation.tournament_id}`);
  };

  if (!enabled || invitations.length === 0) return null;
  return (
    <aside className={styles.notice} aria-label="Tournament staff invitations">
      <UserRoundCheck aria-hidden="true" />
      <div className={styles.list}>
        {invitations.map(invitation => (
          <div className={styles.invitation} key={invitation.id}>
            <span><strong>{invitation.tournament_name}</strong> invited you as {invitation.role.replaceAll('_', ' ')}.</span>
            <div>
              <button type="button" onClick={() => void respond(invitation, 'decline')}>Decline</button>
              <button type="button" className={styles.accept} onClick={() => void respond(invitation, 'accept')}>Accept</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
