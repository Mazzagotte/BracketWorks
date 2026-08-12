import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SignInForm from './SignInForm';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

describe('SignInForm', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows API error message for failed login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ detail: 'Invalid username or password.' }),
      })
    );

    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'sample-user' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'bad-pass' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('Invalid username or password.')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('stores session and redirects on successful login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token-123',
          user_id: 44,
          first_name: 'Jess',
          is_admin: true,
          session_id: 'session-abc',
        }),
      })
    );

    render(<SignInForm />);

    fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: 'sample-user' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'good-pass' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/organizer');
    });

    expect(sessionStorage.getItem('access_token')).toBe('token-123');
    expect(localStorage.getItem('user_id')).toBe('44');
    expect(localStorage.getItem('first_name')).toBe('Jess');
    expect(localStorage.getItem('is_admin')).toBe('true');
    expect(localStorage.getItem('session_id')).toBe('session-abc');
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
