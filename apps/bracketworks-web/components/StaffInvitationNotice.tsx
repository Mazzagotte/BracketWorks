"use client";

import { useCallback, useEffect, useState } from 'react';
import { UserRoundCheck } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '../app/lib/api';
import styles from './StaffInvitationNotice.module.css';

type Invitation = { id: number; tournament_id: number; tournament_name: string; role: string; expires_at: string; requires_secure_link: boolean };

export function StaffInvitationNotice({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [secureLink, setSecureLink] = useState<{ id: number; token: string } | null>(null);
  const [responseError, setResponseError] = useState('');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const load = useCallback(async () => {
    if (!enabled) return;
    try { setInvitations(await apiClient.get<Invitation[]>('/api/v1/tournament-staff/invitations/mine', false)); }
    catch { setInvitations([]); }
  }, [enabled]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = Number(searchParams.get('staff_invitation_id')) || null;
    const token = searchParams.get('staff_invitation_token');
    if (!id || !token) return;
    setSecureLink({ id, token });
    const clean = new URLSearchParams(searchParams.toString());
    clean.delete('staff_invitation_id');
    clean.delete('staff_invitation_token');
    router.replace(clean.size ? `${pathname}?${clean}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const respond = async (invitation: Invitation, action: 'accept' | 'decline') => {
    setResponseError('');
    try {
      const token = invitation.id === secureLink?.id ? secureLink.token : null;
      await apiClient.post(`/api/v1/tournament-staff/invitations/${invitation.id}/${action}`, { token });
      setInvitations(current => current.filter(item => item.id !== invitation.id));
      if (action === 'accept') router.push(`/dashboard?tournament_id=${invitation.tournament_id}`);
    } catch (error) {
      setResponseError(error instanceof Error ? error.message : 'Unable to respond to the invitation.');
    }
  };

  if (!enabled || invitations.length === 0) return null;
  return (
    <aside className={styles.notice} aria-label="Tournament staff invitations">
      <UserRoundCheck aria-hidden="true" />
      <div className={styles.list}>
        {responseError && <span role="alert">{responseError}</span>}
        {invitations.map(invitation => (
          <div className={styles.invitation} key={invitation.id}>
            <span><strong>{invitation.tournament_name}</strong> invited you as {invitation.role.replaceAll('_', ' ')}.</span>
            <div>
              {invitation.requires_secure_link && invitation.id !== secureLink?.id ? (
                <span>Open the secure link in your invitation email to respond.</span>
              ) : (
                <>
                  <button type="button" onClick={() => void respond(invitation, 'decline')}>Decline</button>
                  <button type="button" className={styles.accept} onClick={() => void respond(invitation, 'accept')}>Accept</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
