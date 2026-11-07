import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ restore: vi.fn(), clear: vi.fn(), hasRefresh: vi.fn() }));
vi.mock('./authSession', () => ({
  restoreAuthSession: session.restore,
  clearAuthSession: session.clear,
  hasRefreshSession: session.hasRefresh,
}));

import { installAuthRetry, safeNextPath } from './authRetry';

const ok = () => new Response('{}', { status: 200 });
const unauthorized = () => new Response('{"detail":"Could not validate credentials"}', { status: 401 });

let uninstall: () => void = () => undefined;
let underlying: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'old-token');
  underlying = vi.fn();
  window.fetch = underlying as unknown as typeof window.fetch;
  uninstall = installAuthRetry();
});
afterEach(() => {
  uninstall();
  sessionStorage.clear();
});

describe('expired sign-in on organizer pages', () => {
  it('refreshes once and retries with the new token', async () => {
    underlying.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());
    session.hasRefresh.mockReturnValue(true);
    session.restore.mockImplementation(async () => { sessionStorage.setItem('access_token', 'new-token'); return true; });

    const response = await window.fetch('/api/v1/tc/tournaments/', { headers: { Authorization: 'Bearer old-token' } });

    expect(response.status).toBe(200);
    expect(session.restore).toHaveBeenCalledTimes(1);
    const retryHeaders = new Headers(underlying.mock.calls[1][1].headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-token');
    expect(session.clear).not.toHaveBeenCalled();
  });

  it('shares one refresh between calls that expire together', async () => {
    underlying.mockImplementation(async (_input: unknown, init?: RequestInit) => (
      new Headers(init?.headers).get('Authorization') === 'Bearer new-token' ? ok() : unauthorized()
    ));
    session.hasRefresh.mockReturnValue(true);
    session.restore.mockImplementation(async () => { sessionStorage.setItem('access_token', 'new-token'); return true; });

    const headers = { Authorization: 'Bearer old-token' };
    const results = await Promise.all([window.fetch('/api/v1/a', { headers }), window.fetch('/api/v1/b', { headers })]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(session.restore).toHaveBeenCalledTimes(1);
  });

  it('clears the session when the refresh fails, so the guard sends them to sign in', async () => {
    underlying.mockResolvedValue(unauthorized());
    session.hasRefresh.mockReturnValue(true);
    session.restore.mockResolvedValue(false);

    const response = await window.fetch('/api/v1/tc/tournaments/', { headers: { Authorization: 'Bearer old-token' } });
    expect(response.status).toBe(401);
    expect(session.clear).toHaveBeenCalledTimes(1);
  });

  it('leaves public calls and calls without a token alone', async () => {
    underlying.mockResolvedValue(unauthorized());
    await window.fetch('/api/v1/public/tournaments');
    await window.fetch('/api/v1/users/refresh', { method: 'POST', headers: { Authorization: 'Bearer old-token' } });
    expect(session.restore).not.toHaveBeenCalled();
    expect(session.clear).not.toHaveBeenCalled();
  });
});

describe('return path after signing in', () => {
  it('only allows paths inside the app', () => {
    expect(safeNextPath('/organizer/tournaments/67/scores?tab=finals')).toBe('/organizer/tournaments/67/scores?tab=finals');
    expect(safeNextPath('https://evil.example')).toBe('/organizer');
    expect(safeNextPath('//evil.example')).toBe('/organizer');
    expect(safeNextPath(null)).toBe('/organizer');
  });
});
