import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RegistrationsPage from '@/app/organizer/tournaments/[tournamentId]/registrations/page';
import type { OrganizerRegistrationRecord } from './organizerApi';
import {
  loadTournamentSquads,
  previewTournamentMessage,
  promoteWaitlistedRegistration,
  resendRegistrationConfirmation,
  sendTournamentMessage,
} from './messagesApi';

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('./TournamentContext', () => ({ useTournamentContext: () => mocks.context() }));
vi.mock('./organizerApi', () => ({
  updateTournamentRegistrationPaymentStatus: vi.fn(),
  deleteTournamentEntry: vi.fn(),
  markTournamentRegistrationsPaid: vi.fn(),
  updateTournamentEntry: vi.fn(),
}));
vi.mock('./messagesApi', () => ({
  previewTournamentMessage: vi.fn(),
  sendTournamentMessage: vi.fn(),
  resendRegistrationConfirmation: vi.fn(),
  promoteWaitlistedRegistration: vi.fn(),
  loadTournamentSquads: vi.fn(),
}));

function entry(id: number, status: string, bowlerCount = 1) {
  return {
    id, event_config_id: 'evt-singles', event_name: 'Singles', squad_config_id: 'sq-am', squad_name: 'Saturday AM',
    status, entry_fee_cents: 6000, bowler_count: bowlerCount,
  };
}

const confirmed: OrganizerRegistrationRecord = {
  id: 7, confirmation_code: 'OPEN-0007', status: 'confirmed', payment_status: 'paid', total_cents: 6000,
  contact_first_name: 'Alex', contact_last_name: 'One', contact_email: 'alex@example.com', entries: [entry(70, 'confirmed', 2)],
};
const waitlisted: OrganizerRegistrationRecord = {
  id: 9, confirmation_code: 'OPEN-0009', status: 'waitlisted', payment_status: 'unpaid', total_cents: 6000,
  contact_first_name: 'Wren', contact_last_name: 'Wait', contact_email: 'wren@example.com', entries: [entry(90, 'waitlisted')],
};
const squads = [{
  id: 'sq-am', name: 'Saturday AM', dateIso: '2026-10-01', startTime: '09:00', checkInTime: '', requiredBowlerCount: 1,
  locationName: '', capacity: 2, waitlistEnabled: true, registrationDeadlineIso: null, notes: '', eventIds: [], registeredCount: 0,
}];
const refresh = vi.fn();

function renderPage(contextSquads = squads) {
  mocks.context.mockReturnValue({
    tournamentId: 42,
    tournament: { name: 'Open' },
    registrations: [confirmed, waitlisted],
    squads: contextSquads,
    isRegistrationsLoading: false,
    refreshRegistrations: refresh,
  });
  return render(<RegistrationsPage />);
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'session');
  vi.mocked(previewTournamentMessage).mockResolvedValue({ recipient_count: 23, max_recipients: 500 });
  vi.mocked(sendTournamentMessage).mockResolvedValue({ sent: 23, failed: 0 });
  vi.mocked(resendRegistrationConfirmation).mockResolvedValue({ sent: true });
  vi.mocked(loadTournamentSquads).mockResolvedValue(squads);
  vi.mocked(promoteWaitlistedRegistration).mockResolvedValue({
    ok: true, registration_id: 9, confirmation_code: 'OPEN-0009', status: 'confirmed', payment_status: 'unpaid',
    entries: [{ id: 90, status: 'confirmed' }], notified: true,
  });
  refresh.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('Email bowlers', () => {
  it('shows the recipient count and sends the message', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Email bowlers' }));
    const dialog = screen.getByRole('dialog', { name: 'Email bowlers' });
    expect(await within(dialog).findByText(/Sends to 23 people/)).toBeInTheDocument();
    expect(previewTournamentMessage).toHaveBeenCalledWith('session', 42, { audience: 'all', squad_config_id: 'sq-am' });

    const send = within(dialog).getByRole('button', { name: 'Send to 23 people' });
    expect(send).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Subject'), 'Lane draw');
    await user.type(within(dialog).getByLabelText('Message'), 'Lane assignments are posted.');
    expect(send).toBeEnabled();
    await user.click(send);

    expect(sendTournamentMessage).toHaveBeenCalledWith(
      'session', 42, { audience: 'all', squad_config_id: 'sq-am' }, { subject: 'Lane draw', body: 'Lane assignments are posted.' },
    );
    expect(await within(dialog).findByText('Sent to 23 people.')).toBeInTheDocument();
  });

  it('keeps Send disabled when no one matches the audience', async () => {
    vi.mocked(previewTournamentMessage).mockResolvedValue({ recipient_count: 0, max_recipients: 500 });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Email bowlers' }));
    const dialog = screen.getByRole('dialog', { name: 'Email bowlers' });
    expect(await within(dialog).findByText('No one with an email address matches this audience.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Subject'), 'Hello');
    await user.type(within(dialog).getByLabelText('Message'), 'Hi there');
    expect(within(dialog).getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('previews a squad audience and shows send failures', async () => {
    vi.mocked(sendTournamentMessage).mockRejectedValue(new Error('Email is not available right now.'));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Email bowlers' }));
    const dialog = screen.getByRole('dialog', { name: 'Email bowlers' });
    await user.selectOptions(within(dialog).getByLabelText('Send to'), 'squad');
    expect(within(dialog).getByLabelText('Squad')).toHaveValue('sq-am');
    await waitFor(() => expect(previewTournamentMessage).toHaveBeenLastCalledWith('session', 42, { audience: 'squad', squad_config_id: 'sq-am' }));
    await within(dialog).findByText(/Sends to 23 people/);
    await user.type(within(dialog).getByLabelText('Subject'), 'Squad update');
    await user.type(within(dialog).getByLabelText('Message'), 'Check in at 8.');
    await user.click(within(dialog).getByRole('button', { name: 'Send to 23 people' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Email is not available right now.');
  });
});

describe('Registration row email actions', () => {
  it('resends a confirmation email', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'More actions for Alex One' }));
    expect(screen.queryByRole('menuitem', { name: 'Move off waitlist' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Resend confirmation' }));
    expect(resendRegistrationConfirmation).toHaveBeenCalledWith('session', 42, 7);
    expect(await screen.findByText('Confirmation sent to alex@example.com.')).toBeInTheDocument();
  });

  it('moves a registration off the waitlist with the capacity warning and notifies by default', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'More actions for Wren Wait' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move off waitlist' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Move off waitlist?' });
    expect(await within(dialog).findByText(/Saturday AM is full \(2 of 2 bowlers\)/)).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /Notify by email/ })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Move off waitlist' }));
    expect(promoteWaitlistedRegistration).toHaveBeenCalledWith('session', 42, 9, true);
    expect(await screen.findByText('OPEN-0009 moved off the waitlist. The bowler was emailed.')).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('loads squad capacity when the page has none and can skip the email', async () => {
    vi.mocked(promoteWaitlistedRegistration).mockResolvedValue({
      ok: true, registration_id: 9, confirmation_code: 'OPEN-0009', status: 'confirmed', payment_status: 'unpaid',
      entries: [{ id: 90, status: 'confirmed' }], notified: false,
    });
    const user = userEvent.setup();
    renderPage([]);
    await user.click(screen.getByRole('button', { name: 'More actions for Wren Wait' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move off waitlist' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Move off waitlist?' });
    expect(loadTournamentSquads).toHaveBeenCalledWith('session', 42);
    expect(await within(dialog).findByText(/is full/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: /Notify by email/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Move off waitlist' }));
    expect(promoteWaitlistedRegistration).toHaveBeenCalledWith('session', 42, 9, false);
    expect(await screen.findByText('OPEN-0009 moved off the waitlist.')).toBeInTheDocument();
  });
});
