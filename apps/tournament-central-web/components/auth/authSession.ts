type PersistAuthSessionInput = {
  accessToken: string;
  userId: number | string;
  firstName?: string | null;
  isAdmin?: boolean;
  sessionId?: string | null;
};

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
