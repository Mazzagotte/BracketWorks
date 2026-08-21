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

export type TcVenueLike = {
  id?: number;
  name: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  external_provider?: string | null;
  external_place_id?: string | null;
  phone?: string | null;
  website?: string | null;
};

export type TcVenueSearchResult = {
  source: 'internal' | 'external';
  venue: TcVenueLike;
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

export async function getTournament(token: string, tournamentId: number): Promise<TournamentContract> {
  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  });
  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load tournament (${response.status})`));
  }
  return responseData as TournamentContract;
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

export async function getTournamentSetupSummary(
  token: string,
  tournamentId: number,
): Promise<TournamentSetupStateSummaryContract | undefined> {
  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}/setup-summary`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  });
  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load setup summary (${response.status})`));
  }
  return responseData ? responseData as TournamentSetupStateSummaryContract : undefined;
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

export async function searchTcVenues(
  token: string,
  query: string,
): Promise<TcVenueSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const response = await fetch(`/api/v1/tc/venues/search?query=${encodeURIComponent(trimmed)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to search venues (${response.status})`));
  }

  return Array.isArray(responseData) ? responseData as TcVenueSearchResult[] : [];
}

export async function resolveTcVenue(
  token: string,
  venue: TcVenueLike,
): Promise<TcVenueLike> {
  const response = await fetch('/api/v1/tc/venues/resolve', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(venue),
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to resolve venue (${response.status})`));
  }

  return responseData as TcVenueLike;
}

export type TournamentDocumentKind = 'rules' | 'flyer' | 'oil_pattern' | 'entry_form' | 'notice' | 'other';

export type TournamentDocumentRecord = {
  id: number;
  tournament_id: number;
  doc_type: TournamentDocumentKind;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
};

export async function listTournamentDocuments(
  token: string,
  tournamentId: number,
): Promise<TournamentDocumentRecord[]> {
  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}/documents`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    cache: 'no-store',
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to load documents (${response.status})`));
  }

  return Array.isArray(responseData) ? responseData as TournamentDocumentRecord[] : [];
}

export async function uploadTournamentDocument(
  token: string,
  tournamentId: number,
  file: File,
  docType: TournamentDocumentKind,
): Promise<TournamentDocumentRecord> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);

  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: formData,
  });

  const responseData = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    throw new Error(getJsonErrorDetail(responseData, `Failed to upload document (${response.status})`));
  }

  return responseData as TournamentDocumentRecord;
}

export async function deleteTournamentDocument(
  token: string,
  tournamentId: number,
  documentId: number,
): Promise<{ ok: boolean }> {
  return organizerMutation(
    token,
    `/api/v1/tc/tournaments/${tournamentId}/documents/${documentId}`,
    'DELETE',
  );
}

export async function downloadTournamentDocument(
  token: string,
  tournamentId: number,
  document: TournamentDocumentRecord,
): Promise<void> {
  const response = await fetch(`/api/v1/tc/tournaments/${tournamentId}/documents/${document.id}/download`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to download document (${response.status})`);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = document.file_name;
  link.click();
  URL.revokeObjectURL(url);
}
