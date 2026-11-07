import { useState } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegistrationsPage from '@/app/organizer/tournaments/[tournamentId]/registrations/page';
import { updateTournamentRegistrationPaymentStatus, type OrganizerRegistrationRecord } from './organizerApi';

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('./TournamentContext', () => ({ useTournamentContext: () => mocks.context() }));
vi.mock('./organizerApi', () => ({
  updateTournamentRegistrationPaymentStatus: vi.fn(),
  deleteTournamentEntry: vi.fn(),
  markTournamentRegistrationsPaid: vi.fn(),
  updateTournamentEntry: vi.fn(),
}));

const unpaid: OrganizerRegistrationRecord = {
  id: 7, confirmation_code: 'OPEN-0007', status: 'confirmed', payment_status: 'unpaid',
  total_cents: 8000, contact_first_name: 'Alex', contact_last_name: 'One',
};
const refresh = vi.fn();

function Page() {
  const [registrations, setRegistrations] = useState([unpaid]);
  mocks.context.mockReturnValue({
    tournamentId: 42, tournament: { name: 'Open' }, registrations,
    isRegistrationsLoading: false,
    refreshRegistrations: async () => {
      await refresh();
      setRegistrations((current) => current.map((registration) => ({
        ...registration, payment_status: registration.payment_status === 'paid' ? 'unpaid' : 'paid',
      })));
    },
  });
  return <RegistrationsPage />;
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'session');
  vi.mocked(updateTournamentRegistrationPaymentStatus).mockResolvedValue({ ok: true });
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('Recording payments from the registrations list', () => {
  it('records a confirmed payment and refreshes status and totals', async () => {
    const user = userEvent.setup();
    render(<Page />);
    const statusButton = screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' });
    expect(statusButton).toHaveTextContent('Unpaid');
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    const confirmation = screen.getByRole('alertdialog', { name: 'Record payment?' });
    expect(confirmation).toHaveTextContent('$80.00');
    expect(confirmation).toHaveTextContent('This does not charge the bowler.');
    expect(updateTournamentRegistrationPaymentStatus).not.toHaveBeenCalled();
    await user.click(within(confirmation).getByRole('button', { name: 'Mark paid' }));
    expect(updateTournamentRegistrationPaymentStatus).toHaveBeenCalledWith('session', 42, 7, 'paid');
    expect(await screen.findByRole('button', { name: 'Mark OPEN-0007 as unpaid' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark OPEN-0007 as unpaid' })).toHaveTextContent('Paid');
    expect(screen.queryByRole('button', { name: 'Mark OPEN-0007 as paid' })).not.toBeInTheDocument();
    const summary = screen.getByLabelText('Registration summary');
    const collected = () => within(summary).getByText('Collected', { selector: 'span' }).parentElement;
    expect(collected()).toHaveTextContent('$80.00');
    expect(collected()).toHaveTextContent('$0.00 unpaid');
    expect(screen.getByRole('status')).toHaveTextContent('OPEN-0007 marked as paid.');
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as unpaid' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('does not issue a refund');
    await user.click(screen.getByRole('button', { name: 'Mark unpaid' }));
    expect(updateTournamentRegistrationPaymentStatus).toHaveBeenLastCalledWith('session', 42, 7, 'unpaid');
    expect(await screen.findByRole('button', { name: 'Mark OPEN-0007 as paid' })).toBeInTheDocument();
    expect(collected()).toHaveTextContent('$0.00');
    expect(collected()).toHaveTextContent('$80.00 unpaid');
    expect(screen.getByRole('status')).toHaveTextContent('OPEN-0007 marked as unpaid.');
  });

  it('does not record anything when confirmation is cancelled', async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' })).toHaveFocus();
    expect(updateTournamentRegistrationPaymentStatus).not.toHaveBeenCalled();
  });

  it('surfaces failure without changing unpaid totals', async () => {
    vi.mocked(updateTournamentRegistrationPaymentStatus).mockRejectedValue(new Error('Permission denied.'));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied.');
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('distinguishes a recorded payment from a refresh failure', async () => {
    refresh.mockRejectedValue(new Error('Network error.'));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment status was updated, but the list could not be refreshed.');
    expect(updateTournamentRegistrationPaymentStatus).toHaveBeenCalledTimes(1);
  });

  it('requires a valid session', async () => {
    sessionStorage.clear();
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your session expired.');
    expect(updateTournamentRegistrationPaymentStatus).not.toHaveBeenCalled();
  });

  it('does not offer payment changes for cancelled or refunded registrations', () => {
    mocks.context.mockReturnValue({
      tournamentId: 42, registrations: [
        { ...unpaid, id: 2, status: 'cancelled' },
        { ...unpaid, id: 3, status: 'refunded' },
        { ...unpaid, id: 4, payment_status: 'refunded' },
      ],
    });
    render(<RegistrationsPage />);
    expect(screen.queryByRole('button', { name: /as paid/ })).not.toBeInTheDocument();
  });

  it('rejects an invalid registration ID with a visible error', async () => {
    mocks.context.mockReturnValue({ tournamentId: 42, registrations: [{ ...unpaid, id: 'invalid' }] });
    const user = userEvent.setup();
    render(<RegistrationsPage />);
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    expect(screen.getByRole('alert')).toHaveTextContent('invalid ID');
    expect(updateTournamentRegistrationPaymentStatus).not.toHaveBeenCalled();
  });

  it('disables actions while the payment request is in flight', async () => {
    let resolvePayment: ((value: { ok: boolean }) => void) | undefined;
    vi.mocked(updateTournamentRegistrationPaymentStatus).mockImplementation(() => new Promise((resolve) => { resolvePayment = resolve; }));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' }));
    await user.click(screen.getByRole('button', { name: 'Mark paid' }));
    expect(screen.getByRole('button', { name: 'Mark OPEN-0007 as paid' })).toBeDisabled();
    resolvePayment?.({ ok: true });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark OPEN-0007 as unpaid' })).toBeInTheDocument());
  });
});
