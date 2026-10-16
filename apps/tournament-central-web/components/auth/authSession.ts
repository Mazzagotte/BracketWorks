import type { PersistAuthSessionInput } from '@bracketworks/types';

export const AUTH_SESSION_EVENT = 'tc-auth-session-changed';

const STORAGE_KEYS = {
  accessToken: 'access_token',
  sessionId: 'session_id',
  userId: 'user_id',
  firstName: 'first_name',
  isAdmin: 'is_admin',
} as const;

function emitAuthChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
  }
}

export function persistAuthSession(input: PersistAuthSessionInput) {
  if (typeof window === 'undefined') {
    return;
  }

  // Keep the access token in sessionStorage only to avoid long-term persistence.
  sessionStorage.setItem(STORAGE_KEYS.accessToken, input.accessToken);
  localStorage.removeItem(STORAGE_KEYS.accessToken);

  localStorage.setItem(STORAGE_KEYS.userId, String(input.userId));
  localStorage.setItem(STORAGE_KEYS.isAdmin, input.isAdmin ? 'true' : 'false');

  if (input.firstName && input.firstName.trim()) {
    localStorage.setItem(STORAGE_KEYS.firstName, input.firstName.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.firstName);
  }

  if (input.sessionId && input.sessionId.trim()) {
    localStorage.setItem(STORAGE_KEYS.sessionId, input.sessionId.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.sessionId);
  }

  emitAuthChange();
}

export function clearAuthSession() {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.sessionId);
  localStorage.removeItem(STORAGE_KEYS.userId);
  localStorage.removeItem(STORAGE_KEYS.firstName);
  localStorage.removeItem(STORAGE_KEYS.isAdmin);

  emitAuthChange();
}

function csrfHeaders(): Record<string, string> {
  const cookie = document.cookie.split('; ').find((value) => value.startsWith('csrf_token='));
  return cookie ? { 'x-csrf-token': decodeURIComponent(cookie.slice('csrf_token='.length)) } : {};
}

export function hasRefreshSession(): boolean {
  return typeof document !== 'undefined' && document.cookie.split('; ').some((cookie) => cookie.startsWith('csrf_token='));
}

export async function restoreAuthSession(): Promise<boolean> {
  const response = await fetch('/api/v1/users/refresh', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    body: '{}',
  });
  if (response.status === 401 || response.status === 403) {
    clearAuthSession();
    return false;
  }
  if (!response.ok) throw new Error('Unable to restore your account session. Please try again.');
  const data: { access_token?: string; user_id?: number; first_name?: string; is_admin?: boolean; session_id?: string } = await response.json();
  if (!data.access_token || typeof data.user_id !== 'number') throw new Error('The account session response was incomplete.');
  persistAuthSession({
    accessToken: data.access_token, userId: data.user_id, firstName: data.first_name,
    isAdmin: Boolean(data.is_admin), sessionId: data.session_id,
  });
  return true;
}

async function revokeSession(): Promise<Response> {
  const token = sessionStorage.getItem(STORAGE_KEYS.accessToken);
  return fetch('/api/v1/users/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...csrfHeaders(),
    },
    body: JSON.stringify({ all_sessions: false }),
  });
}

export async function signOut(): Promise<void> {
  let response = await revokeSession();
  if (response.status === 401 && hasRefreshSession() && await restoreAuthSession()) response = await revokeSession();
  if (!response.ok && response.status !== 401) throw new Error('Unable to sign out. Please try again.');
  clearAuthSession();
}
