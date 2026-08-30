import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  changeMyPassword,
  getMyAccount,
  inviteTournamentStaff,
  listTournamentActivity,
  listTournamentStaff,
  markTournamentRegistrationsPaid,
  updateMyAccount,
} from './organizerApi';

function mockFetchOnce(body: unknown, ok = true, status = ok ? 200 : 400) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('organizerApi account functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getMyAccount calls GET /api/v1/users/me with the bearer token', async () => {
    const fetchMock = mockFetchOnce({ id: 1, first_name: 'Jess' });
    const result = await getMyAccount('token-123');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me', expect.objectContaining({
      method: 'GET',
      headers: { Authorization: 'Bearer token-123' },
    }));
    expect(result).toEqual({ id: 1, first_name: 'Jess' });
  });

  it('updateMyAccount sends a PUT with the provided changes', async () => {
    const fetchMock = mockFetchOnce({ id: 1, first_name: 'Jess' });
    await updateMyAccount('token-123', { first_name: 'Jess' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/users/me', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ first_name: 'Jess' }),
    }));
  });

  it('changeMyPassword raises the backend detail message on failure', async () => {
    mockFetchOnce({ detail: 'Current password is incorrect' }, false, 400);
    await expect(
      changeMyPassword('token-123', {
        current_password: 'wrong',
        new_password: 'new-password-1',
        sign_out_current_session: false,
      }),
    ).rejects.toThrow('Current password is incorrect');
  });
});

describe('organizerApi bulk payment marking', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('marks every registration id as paid via individual PATCH calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await markTournamentRegistrationsPaid('token-123', 42, [1, 2, 3]);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tc/tournaments/42/registrations/1', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tc/tournaments/42/registrations/2', expect.objectContaining({ method: 'PATCH' }));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tc/tournaments/42/registrations/3', expect.objectContaining({ method: 'PATCH' }));
  });
});

describe('organizerApi staff functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listTournamentStaff calls the tournament-staff list endpoint', async () => {
    const fetchMock = mockFetchOnce([{ id: null, role: 'owner' }]);
    await listTournamentStaff('token-123', 42);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tournament-staff/tournaments/42', expect.objectContaining({ method: 'GET' }));
  });

  it('inviteTournamentStaff posts to the invitations endpoint with email and role', async () => {
    const fetchMock = mockFetchOnce({ id: 1, email: 'teammate@example.com', role: 'viewer', status: 'pending', expires_at: '', email_sent: true });
    await inviteTournamentStaff('token-123', 42, { email: 'teammate@example.com', role: 'viewer' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tournament-staff/42/invitations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'teammate@example.com', role: 'viewer' }),
    }));
  });
});

describe('organizerApi activity feed', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listTournamentActivity encodes limit/offset as query params', async () => {
    const fetchMock = mockFetchOnce([]);
    await listTournamentActivity('token-123', 42, { limit: 25, offset: 25 });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tournament-activity/42?limit=25&offset=25', expect.objectContaining({ method: 'GET' }));
  });

  it('listTournamentActivity omits query params when not provided', async () => {
    const fetchMock = mockFetchOnce([]);
    await listTournamentActivity('token-123', 42);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/tournament-activity/42', expect.objectContaining({ method: 'GET' }));
  });
});
