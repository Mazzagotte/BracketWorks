import type { TournamentContract, TournamentSetupStateSummaryContract } from '@bracketworks/types';

export type OrganizerSetupStateResponse<TPayload> = {
  id: number;
  tournament_id: number;
  user_id: number;
  payload: TPayload;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type OrganizerRegistrationRecord = {
  id?: number | string;
  confirmation_code?: string;
  status?: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled' | 'refunded' | string;
  payment_status?: string;
  contact_first_name?: string;
  contact_last_name?: string;
  contact_email?: string;
  contact_phone?: string | null;
  notes?: string | null;
  total_cents?: number;
  currency?: string;
  entry_count?: number;
  submitted_at?: string;
  entries?: Array<{
    id: number;
    event_config_id: string;
    event_name: string;
    division_config_id?: string | null;
    division_name?: string | null;
    squad_config_id?: string | null;
    squad_name?: string | null;
    squad_date?: string | null;
    squad_time?: string | null;
    status: string;
    entry_number?: number | null;
    entry_fee_cents: number;
    bowler_count: number;
    bowlers?: Array<{
      id: number;
      first_name: string;
      last_name: string;
      email?: string | null;
      phone?: string | null;
      usbc_number?: string | null;
      average?: number | null;
    }>;
  }>;
  form?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    event_id?: string;
    division_id?: string;
    squad_id?: string;
    notes?: string;
  };
};

function getJsonErrorDetail(responseBody: unknown, fallback: string): string {
  if (responseBody && typeof responseBody === 'object' && 'detail' in responseBody) {
    const detail = (responseBody as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }

  return fallback;
}

async function organizerMutation<T>(
  token: string,
  url: string,
  method: 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Request failed (${response.status})`));
  }
  return responseData as T;
}

export function updateTournamentEntry(
  token: string,
  tournamentId: number,
  entryId: number,
  changes: Record<string, unknown>,
): Promise<{ ok: boolean }> {
  return organizerMutation(token, `/api/v1/tc/tournaments/${tournamentId}/entries/${entryId}`, 'PATCH', changes);
}

export function deleteTournamentEntry(token: string, tournamentId: number, entryId: number): Promise<{ ok: boolean }> {
  return organizerMutation(token, `/api/v1/tc/tournaments/${tournamentId}/entries/${entryId}`, 'DELETE');
}

export function markTournamentRegistrationPaid(token: string, tournamentId: number, registrationId: number): Promise<{ ok: boolean }> {
  return organizerMutation(token, `/api/v1/tc/tournaments/${tournamentId}/registrations/${registrationId}`, 'PATCH', { payment_status: 'paid' });
}

export async function listMyTournaments(token: string): Promise<TournamentContract[]> {
  const response = await fetch('/api/v1/tc/tournaments/', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load tournaments (${response.status})`));
  }

  return Array.isArray(responseData) ? responseData as TournamentContract[] : [];
}

export async function listMyOrganizerSetupStates(token: string): Promise<TournamentSetupStateSummaryContract[]> {
  const response = await fetch('/api/v1/tc/organizer-setup/mine', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load organizer setup list (${response.status})`));
  }

  return Array.isArray(responseData) ? responseData as TournamentSetupStateSummaryContract[] : [];
}

export async function listTournamentRegistrations(
  token: string,
  tournamentId: number,
): Promise<OrganizerRegistrationRecord[]> {
  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}/registrations`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as { registrations?: OrganizerRegistrationRecord[] } | null;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load registrations (${response.status})`));
  }

  return Array.isArray(responseData?.registrations) ? responseData.registrations : [];
}

export async function loadOrganizerSetupState<TPayload>(
  token: string,
  tournamentId: number,
): Promise<OrganizerSetupStateResponse<TPayload> | null> {
  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load organizer setup (${response.status})`));
  }

  return responseData as OrganizerSetupStateResponse<TPayload>;
}
