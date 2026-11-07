import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import RegistrationsPage from '@/app/organizer/tournaments/[tournamentId]/registrations/page';
import { loadOrganizerSetupState, updateTournamentEntry, type OrganizerRegistrationRecord } from './organizerApi';

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('./TournamentContext', () => ({ useTournamentContext: () => mocks.context() }));
vi.mock('./organizerApi', () => ({
  updateTournamentRegistrationPaymentStatus: vi.fn(),
  deleteTournamentEntry: vi.fn(),
  markTournamentRegistrationsPaid: vi.fn(),
  updateTournamentEntry: vi.fn(),
  loadOrganizerSetupState: vi.fn(),
}));

const registration: OrganizerRegistrationRecord = {
  id: 7, confirmation_code: 'OPEN-0007', status: 'confirmed', payment_status: 'paid', total_cents: 4000,
  contact_first_name: 'Alex', contact_last_name: 'One',
  entries: [{
    id: 70, event_config_id: 'singles', event_name: 'Singles', squad_config_id: 'am', squad_name: 'Morning',
    squad_date: '2026-11-15', squad_time: '09:00', status: 'confirmed', entry_fee_cents: 4000,
    bowlers: [{ id: 1, first_name: 'Alex', last_name: 'One' }],
  }],
} as OrganizerRegistrationRecord;

const refresh = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'session');
  mocks.context.mockReturnValue({
    tournamentId: 42, tournament: { name: 'Open' }, registrations: [registration],
    isRegistrationsLoading: false, refreshRegistrations: refresh,
  });
  vi.mocked(loadOrganizerSetupState).mockResolvedValue({
    tournament_id: 42,
    payload: {
      events: [{ id: 'singles', name: 'Singles', enabled: true }, { id: 'doubles', name: 'Doubles', enabled: true }],
      divisions: [{ id: 'open', name: 'Open', enabled: true }],
      squads: [
        { id: 'am', name: 'Morning', dateIso: '2026-11-15', startTime: '09:00', capacity: 20 },
        { id: 'pm', name: 'Afternoon', dateIso: '2026-11-15', startTime: '14:00', capacity: 1 },
      ],
    },
  } as never);
  vi.mocked(updateTournamentEntry).mockResolvedValue({ ok: true } as never);
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('moving an entry', () => {
  it('picks the new squad from a list and saves its name, date, and time with it', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);
    await user.click(screen.getByRole('button', { name: 'More actions for Alex One' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit entry' }));
    const dialog = await screen.findByRole('dialog', { name: /Edit entry/ });
    const squad = await within(dialog).findByRole('combobox', { name: 'Squad' });
    expect(within(dialog).queryByLabelText('Squad ID')).not.toBeInTheDocument();
    expect(within(dialog).getByText('20 bowler spots left in this squad.')).toBeInTheDocument();

    await user.selectOptions(squad, 'pm');
    expect(within(dialog).getByText('1 bowler spot left in this squad.')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /^Division/ }), 'open');
    await user.click(within(dialog).getByRole('button', { name: /Save/ }));

    expect(updateTournamentEntry).toHaveBeenCalledWith('session', 42, 70, expect.objectContaining({
      squad_config_id: 'pm', squad_name_snapshot: 'Afternoon', squad_date_snapshot: '2026-11-15', squad_time_snapshot: '14:00',
      division_config_id: 'open', division_name_snapshot: 'Open', event_config_id: 'singles',
    }));
  });
});
