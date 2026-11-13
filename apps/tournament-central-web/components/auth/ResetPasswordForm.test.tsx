import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordForm from './ResetPasswordForm';

let token = 'reset-token';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(token ? { token } : {}),
}));

afterEach(() => {
  token = 'reset-token';
  vi.unstubAllGlobals();
});

describe('ResetPasswordForm', () => {
  it('asks for a new link when the token is missing', () => {
    token = '';
    render(<ResetPasswordForm />);

    expect(screen.getByText(/missing its token/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toHaveAttribute('href', '/forgot-password');
  });

  it('shows an error when the passwords do not match', async () => {
    render(<ResetPasswordForm />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: 'OtherPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('sends the token and new password, then confirms', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message: 'ok' }) });
    vi.stubGlobal('fetch', fetchMock);
    render(<ResetPasswordForm />);

    fireEvent.change(screen.getByLabelText(/^new password$/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^confirm new password$/i), { target: { value: 'StrongPass1!' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByText(/your password has been reset/i)).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/users/reset-password');
    expect(JSON.parse(init.body)).toEqual({ token: 'reset-token', new_password: 'StrongPass1!' });
  });
});
