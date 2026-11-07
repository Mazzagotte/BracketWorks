import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckInPage from '@/app/organizer/tournaments/[tournamentId]/check-in/page';
import { setBowlerCheckIn } from './checkInApi';
import type { OrganizerRegistrationRecord } from './organizerApi';
import type { SquadConfig } from './types';

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('./TournamentContext', () => ({ useTournamentContext: () => mocks.context() }));
vi.mock('./checkInApi', () => ({ setBowlerCheckIn: vi.fn() }));

function squad(id: string, name: string, startTime: string): SquadConfig {
  return {
    id, name, dateIso: '2026-01-10', startTime, checkInTime: '', requiredBowlerCount: 1, locationName: '',
    capacity: 40, waitlistEnabled: false, registrationDeadlineIso: null, notes: '', eventIds: [], registeredCount: 0,
  };
}

function registration(
  id: number,
  status: string,
  squadId: string,
  bowler: { id: number; first: string; last: string; checkedInAt?: string | null },
): OrganizerRegistrationRecord {
  return {
    id, confirmation_code: `OPEN-${id}`, status, payment_status: 'unpaid', total_cents: 5000,
    contact_first_name: bowler.first, contact_last_name: bowler.last,
    entries: [{
      id: id * 10, event_config_id: 'evt-singles', event_name: 'Singles', squad_config_id: squadId,
      status: 'confirmed', entry_fee_cents: 5000, bowler_count: 1,
      bowlers: [{
        id: bowler.id, first_name: bowler.first, last_name: bowler.last, usbc_number: `USBC-${bowler.id}`,
        checked_in_at: bowler.checkedInAt ?? null,
      }],
    }],
  };
}

const registrations = [
  registration(1, 'confirmed', 'sq-am', { id: 101, first: 'Ana', last: 'Able' }),
  registration(2, 'pending', 'sq-am', { id: 102, first: 'Ben', last: 'Baker', checkedInAt: '2026-01-10T15:05:00Z' }),
  registration(3, 'cancelled', 'sq-am', { id: 103, first: 'Cy', last: 'Cancelled' }),
  registration(4, 'confirmed', 'sq-pm', { id: 104, first: 'Dee', last: 'Dusk' }),
];

function bowlerTable() {
  return screen.getByRole('table', { name: /Bowlers in/ });
}

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'session');
  mocks.context.mockReturnValue({
    tournamentId: 42,
    tournament: { name: 'Spring Open' },
    squads: [squad('sq-am', 'Morning', '09:00'), squad('sq-pm', 'Afternoon', '13:00')],
    registrations,
    isRegistrationsLoading: false,
    isSetupLoading: false,
    registrationsError: null,
    setupError: null,
    tournamentError: null,
    refreshRegistrations: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('Check-in page', () => {
  it('lists active bowlers for the first squad and labels squads by time', () => {
    render(<CheckInPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Check-in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '9:00 AM' }).getAttribute('aria-pressed')).toBe('true');
    const table = within(bowlerTable());
    expect(table.getByText('Ana Able')).toBeTruthy();
    expect(table.getByText('Ben Baker')).toBeTruthy();
    expect(table.queryByText('Cy Cancelled')).toBeNull();
    expect(table.queryByText('Dee Dusk')).toBeNull();
    expect(screen.getByText('1 of 2')).toBeTruthy();
  });

  it('checks a bowler in through the API and shows the time', async () => {
    vi.mocked(setBowlerCheckIn).mockResolvedValue({ bowler_id: 101, checked_in_at: '2026-01-10T16:30:00Z' });
    render(<CheckInPage />);

    const checkbox = within(bowlerTable()).getByRole('checkbox', { name: 'Check in Ana Able' }) as HTMLInputElement;
    await userEvent.click(checkbox);

    expect(setBowlerCheckIn).toHaveBeenCalledWith('session', 42, 101, true);
    const expectedTime = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
      .format(new Date('2026-01-10T16:30:00Z'));
    await waitFor(() => expect(within(bowlerTable()).getByText(expectedTime)).toBeTruthy());
    expect(checkbox.checked).toBe(true);
    expect(screen.getByText('2 of 2')).toBeTruthy();
  });

  it('rolls back and shows an alert when check-in fails', async () => {
    vi.mocked(setBowlerCheckIn).mockRejectedValue(new Error('Server unavailable'));
    render(<CheckInPage />);

    const checkbox = within(bowlerTable()).getByRole('checkbox', { name: 'Check in Ana Able' }) as HTMLInputElement;
    await userEvent.click(checkbox);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Ana Able could not be checked in. Server unavailable');
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText('1 of 2')).toBeTruthy();
  });

  it('filters to bowlers who are not here yet', async () => {
    render(<CheckInPage />);

    await userEvent.click(screen.getByRole('button', { name: /^Not here/ }));

    const table = within(bowlerTable());
    expect(table.getByText('Ana Able')).toBeTruthy();
    expect(table.queryByText('Ben Baker')).toBeNull();
  });

  it('switches the list when another squad is picked', async () => {
    render(<CheckInPage />);

    await userEvent.click(screen.getByRole('button', { name: '1:00 PM' }));

    const table = within(bowlerTable());
    expect(table.getByText('Dee Dusk')).toBeTruthy();
    expect(table.queryByText('Ana Able')).toBeNull();
    expect(screen.getByText('0 of 1')).toBeTruthy();
  });
});
