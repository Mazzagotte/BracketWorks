import { getJsonErrorDetail } from './organizerApi';
import type { SquadConfig } from './types';

export type MessageAudience = 'all' | 'squad' | 'unpaid' | 'waitlisted';

export type MessageAudienceSelection = {
  audience: MessageAudience;
  squad_config_id?: string;
};

export type MessagePreviewResponse = { recipient_count: number; max_recipients?: number };
export type MessageSendResponse = { sent: number; failed: number };
export type PromoteRegistrationResponse = {
  ok: boolean;
  registration_id: number;
  confirmation_code: string;
  status: string;
  payment_status: string;
  entries: Array<{ id: number; status: string }>;
  notified: boolean;
};

async function messagesRequest<T>(
  token: string,
  url: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'include',
    cache: 'no-store',
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Request failed (${response.status})`));
  }
  return responseData as T;
}

function audienceBody(selection: MessageAudienceSelection): Record<string, unknown> {
  return selection.audience === 'squad'
    ? { audience: 'squad', squad_config_id: selection.squad_config_id ?? '' }
    : { audience: selection.audience };
}

export function previewTournamentMessage(
  token: string,
  tournamentId: number,
  selection: MessageAudienceSelection,
): Promise<MessagePreviewResponse> {
  return messagesRequest(token, `/api/v1/tc/tournaments/${tournamentId}/messages/preview`, 'POST', audienceBody(selection));
}

export function sendTournamentMessage(
  token: string,
  tournamentId: number,
  selection: MessageAudienceSelection,
  message: { subject: string; body: string },
): Promise<MessageSendResponse> {
  return messagesRequest(token, `/api/v1/tc/tournaments/${tournamentId}/messages`, 'POST', {
    ...audienceBody(selection),
    subject: message.subject,
    body: message.body,
  });
}

export function resendRegistrationConfirmation(
  token: string,
  tournamentId: number,
  registrationId: number,
): Promise<{ sent: boolean }> {
  return messagesRequest(token, `/api/v1/tc/tournaments/${tournamentId}/registrations/${registrationId}/resend-confirmation`, 'POST');
}

export function promoteWaitlistedRegistration(
  token: string,
  tournamentId: number,
  registrationId: number,
  notify: boolean,
): Promise<PromoteRegistrationResponse> {
  return messagesRequest(token, `/api/v1/tc/tournaments/${tournamentId}/registrations/${registrationId}/promote`, 'POST', { notify });
}

/** Squad settings (with capacity) from the organizer setup, for the waitlist capacity check. */
export async function loadTournamentSquads(token: string, tournamentId: number): Promise<SquadConfig[]> {
  const state = await messagesRequest<{ payload?: { squads?: SquadConfig[] } } | null>(
    token,
    `/api/v1/tc/organizer-setup/${tournamentId}`,
    'GET',
  );
  return Array.isArray(state?.payload?.squads) ? state.payload.squads : [];
}
