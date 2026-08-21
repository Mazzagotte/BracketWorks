import { loadOrganizerSetupState as loadOrganizerSetupStateApi } from './organizerApi';
import type {
  OrganizerSetupPayload,
  OrganizerSetupStateResponse,
  PersistedTournament,
  TournamentLogoUploadResponse,
  TournamentWritePayload,
} from './setupTypes';

export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    if (cookie.startsWith('csrf_token=')) {
      const raw = cookie.slice('csrf_token='.length);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }

  return null;
}

export async function saveTournamentRecord(params: {
  token: string;
  payload: TournamentWritePayload;
  tournamentId: number | null;
}): Promise<PersistedTournament> {
  const { token, payload, tournamentId } = params;
  const endpoint = tournamentId ? `/api/v1/tc/tournaments/${tournamentId}` : '/api/v1/tc/tournaments/';
  const method = tournamentId ? 'PUT' : 'POST';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(endpoint, {
    method,
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | null;
  if (!response.ok) {
    const detail = responseData && typeof responseData.detail === 'string'
      ? responseData.detail
      : `Failed to save tournament (${response.status})`;
    throw new Error(detail);
  }

  return responseData as PersistedTournament;
}

export async function loadOrganizerSetupState(token: string, tournamentId: number): Promise<OrganizerSetupStateResponse | null> {
  return loadOrganizerSetupStateApi<OrganizerSetupPayload>(token, tournamentId);
}

export async function uploadTournamentLogo(params: {
  token: string;
  tournamentId: number;
  file: File;
}): Promise<TournamentLogoUploadResponse> {
  const { token, tournamentId, file } = params;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const formData = new FormData();
  formData.set('file', file);

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}/logo`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | TournamentLogoUploadResponse | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to upload tournament logo (${response.status})`;
    throw new Error(detail);
  }

  return responseData as TournamentLogoUploadResponse;
}

export async function fetchTournamentLogoBlobUrl(token: string, tournamentId: number): Promise<string | null> {
  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}/logo`, {
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

  if (!response.ok) {
    throw new Error(`Failed to load tournament logo (${response.status})`);
  }

  const blob = await response.blob();
  if (!blob.size) {
    return null;
  }

  return URL.createObjectURL(blob);
}

export async function deleteTournamentLogo(params: { token: string; tournamentId: number }): Promise<void> {
  const { token, tournamentId } = params;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}/logo`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });

  if (!response.ok && response.status !== 404) {
    const responseData = await response.json().catch(() => null) as { detail?: string } | null;
    const detail = responseData && typeof responseData.detail === 'string'
      ? responseData.detail
      : `Failed to remove tournament logo (${response.status})`;
    throw new Error(detail);
  }
}

export async function saveOrganizerSetupState(params: {
  token: string;
  tournamentId: number;
  payload: OrganizerSetupPayload;
  isPublished: boolean;
}): Promise<OrganizerSetupStateResponse> {
  const { token, tournamentId, payload, isPublished } = params;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }

  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['x-csrf-token'] = csrfToken;
  }

  const response = await fetch(`/api/v1/tc/organizer-setup/${tournamentId}`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      payload,
      is_published: isPublished,
    }),
  });

  const responseData = await response.json().catch(() => null) as { detail?: string } | OrganizerSetupStateResponse | null;
  if (!response.ok) {
    const detail = responseData && typeof (responseData as { detail?: string }).detail === 'string'
      ? (responseData as { detail?: string }).detail
      : `Failed to save organizer setup (${response.status})`;
    throw new Error(detail);
  }

  return responseData as OrganizerSetupStateResponse;
}
