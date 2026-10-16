import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAuthSession, persistAuthSession } from '@/components/auth/authSession';
import PublicAccountNav from './PublicAccountNav';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = 'csrf_token=; Max-Age=0; path=/';
});
afterEach(() => {
  cleanup();
  document.cookie = 'csrf_token=; Max-Age=0; path=/';
  vi.unstubAllGlobals();
});

describe('public account navigation', () => {
  it('shows sign in and account creation to visitors', () => {
    render(<PublicAccountNav />);
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: 'Create Account' })).toBeInTheDocument();
  });

  it('restores the organizer identity on refresh and reacts to session changes', () => {
    persistAuthSession({ accessToken: 'test-token', userId: 1, firstName: 'Jamie', isAdmin: false });
    const view = render(<PublicAccountNav />);
    expect(screen.getByRole('link', { name: 'Organizer Dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Jamie')).toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    view.unmount();
    render(<PublicAccountNav />);
    expect(screen.getByText('Jamie')).toBeInTheDocument();
    act(() => clearAuthSession());
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('revokes the session and immediately restores visitor navigation when signing out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    persistAuthSession({ accessToken: 'test-token', userId: 1, firstName: 'Jamie', isAdmin: false });
    render(<PublicAccountNav />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Jamie'));
    await user.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/v1/users/logout', expect.objectContaining({ method: 'POST', credentials: 'include' }));
  });

  it('does not treat stale user metadata without a token as an active session', () => {
    localStorage.setItem('user_id', '1');
    localStorage.setItem('first_name', 'Jamie');
    render(<PublicAccountNav />);
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('restores cookie-backed sessions after direct navigation in a fresh tab', async () => {
    document.cookie = 'csrf_token=test-csrf; path=/';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ access_token: 'restored-token', user_id: 1, first_name: 'Jamie', is_admin: false }),
    }));
    render(<PublicAccountNav />);
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Organizer Dashboard' })).toBeInTheDocument();
    expect(sessionStorage.getItem('access_token')).toBe('restored-token');
  });

  it('surfaces session-restoration failures instead of showing a misleading visitor header', async () => {
    document.cookie = 'csrf_token=test-csrf; path=/';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Account service unavailable')));
    render(<PublicAccountNav />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Account service unavailable');
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
  });
});
