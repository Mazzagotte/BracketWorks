import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RegisterForm from './RegisterForm';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('RegisterForm', () => {
  it('shows validation error when passwords do not match', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'janedoe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'StrongPass1!' } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'DifferentPass1!' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('shows password strength validation error for weak passwords', async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Jane' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Doe' } });
    fireEvent.change(screen.getByLabelText(/^username$/i), { target: { value: 'janedoe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'abc' } });
    fireEvent.change(screen.getByLabelText(/^confirm password$/i), { target: { value: 'abc' } });

    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(
      await screen.findByText('Password must be at least 8 characters and include uppercase, lowercase, and a number or symbol.')
    ).toBeInTheDocument();
  });
});
