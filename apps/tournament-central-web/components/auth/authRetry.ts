import { clearAuthSession, hasRefreshSession, restoreAuthSession } from './authSession';

/**
 * Organizer pages call the API with the access token from sessionStorage. That token expires;
 * the refresh cookie lasts longer. This wraps window.fetch so a 401 on a signed-in API call
 * refreshes the session once and retries with the new token. If the refresh fails, the session
 * is cleared, and OrganizerAuthGuard sends the organizer to sign in.
 *
 * One wrapper covers every organizer API helper, so none of them need their own 401 handling.
 */

let refreshing: Promise<boolean> | null = null;

/** Only one refresh at a time: a page often fires several calls that all expire together. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= (hasRefreshSession() ? restoreAuthSession() : Promise.resolve(false))
    .catch(() => false)
    .finally(() => { refreshing = null; });
  return refreshing;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function bearerHeader(input: RequestInfo | URL, init?: RequestInit): string | null {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  const value = headers.get('Authorization');
  return value && value.startsWith('Bearer ') ? value : null;
}

/** Signed-in calls to our API, except the auth endpoints themselves. */
function shouldRetry(url: string, hasBearer: boolean): boolean {
  if (!hasBearer) return false;
  const path = url.startsWith('http') ? new URL(url).pathname : url;
  return path.startsWith('/api/v1/') && !path.startsWith('/api/v1/users/refresh') && !path.startsWith('/api/v1/users/logout');
}

export function installAuthRetry(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const original = window.fetch;
  // Avoid wrapping twice (for example under React strict mode double effects).
  if ((original as { __authRetry?: boolean }).__authRetry) return () => undefined;

  const wrapped = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await original(input, init);
    const bearer = bearerHeader(input, init);
    if (response.status !== 401 || !shouldRetry(requestUrl(input), Boolean(bearer))) return response;

    const restored = await refreshOnce();
    const token = restored ? sessionStorage.getItem('access_token') : null;
    if (!token) {
      clearAuthSession();
      return response;
    }
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('Authorization', `Bearer ${token}`);
    return original(input instanceof Request ? new Request(input, { headers }) : input, { ...init, headers });
  };
  (wrapped as { __authRetry?: boolean }).__authRetry = true;
  window.fetch = wrapped as typeof window.fetch;
  return () => {
    if (window.fetch === wrapped) window.fetch = original;
  };
}

/** Where to send someone back to after signing in: only paths inside this app. */
export function safeNextPath(value: string | null | undefined, fallback = '/organizer'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
