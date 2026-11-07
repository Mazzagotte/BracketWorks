import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CheckInPage from '@/app/organizer/tournaments/[tournamentId]/check-in/page';
import RegistrationsPage from '@/app/organizer/tournaments/[tournamentId]/registrations/page';
import type { OrganizerRegistrationRecord } from './organizerApi';
import type { SquadConfig } from './types';

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('./TournamentContext', () => ({ useTournamentContext: () => mocks.context() }));
vi.mock('./checkInApi', () => ({ setBowlerCheckIn: vi.fn() }));
vi.mock('./organizerApi', () => ({
  updateTournamentRegistrationPaymentStatus: vi.fn(),
  deleteTournamentEntry: vi.fn(),
  markTournamentRegistrationsPaid: vi.fn(),
  updateTournamentEntry: vi.fn(),
  loadOrganizerSetupState: vi.fn(),
  getMyAccount: vi.fn(),
}));

const squad: SquadConfig = {
  id: 'sq-am', name: 'Morning', dateIso: '2026-01-10', startTime: '09:00', checkInTime: '', requiredBowlerCount: 2,
  locationName: '', capacity: 40, waitlistEnabled: false, registrationDeadlineIso: null, notes: '', eventIds: [], registeredCount: 0,
};

const doubles: OrganizerRegistrationRecord = {
  id: 7, confirmation_code: 'OPEN-0007', status: 'confirmed', payment_status: 'unpaid',
  subtotal_cents: 9000, fees_cents: 4700, total_cents: 13700, contact_first_name: 'Ann', contact_last_name: 'Lee',
  entries: [{
    id: 70, event_config_id: 'evt-doubles', event_name: 'Doubles', squad_config_id: 'sq-am', status: 'confirmed',
    entry_fee_cents: 9000, bowler_count: 2,
    bowlers: [
      { id: 101, first_name: 'Ann', last_name: 'Lee', usbc_number: '1234-11111' },
      { id: 102, first_name: 'Bob', last_name: 'Ray', usbc_number: '1234-22222' },
    ],
  }],
  side_events: [
    { id: 1, fee_id: 'fee-brackets', name: 'Brackets', kind: 'brackets', scoring: 'handicap', bowler_id: 101, quantity: 5, unit_cents: 500, total_cents: 2500 },
    { id: 2, fee_id: 'fee-brackets', name: 'Brackets', kind: 'brackets', scoring: 'handicap', bowler_id: 102, quantity: 2, unit_cents: 500, total_cents: 1000 },
    { id: 3, fee_id: 'fee-high-game', name: 'High game', kind: 'high-game-pot', bowler_id: 101, quantity: 1, unit_cents: 1000, total_cents: 1000 },
    { id: 4, fee_id: 'fee-lineage', name: 'Lineage', kind: 'fee', bowler_id: null, quantity: 1, unit_cents: 200, total_cents: 200 },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'session');
  mocks.context.mockReturnValue({
    tournamentId: 42,
    tournament: { name: 'Spring Open', start_date: '2026-10-01' },
    squads: [squad],
    registrations: [doubles],
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
  vi.unstubAllGlobals();
});

describe('Side events in organizer views', () => {
  it('shows each bowler\'s bracket count at check-in', () => {
    render(<CheckInPage />);

    const table = within(screen.getByRole('table', { name: /Bowlers in/u }));
    expect(table.getByRole('columnheader', { name: 'Brackets' })).toBeInTheDocument();
    expect(table.getByText('Ann Lee').closest('tr')).toHaveTextContent('5');
    expect(table.getByText('Bob Ray').closest('tr')).toHaveTextContent('2');
  });

  it('summarizes side events on registration rows and per bowler', async () => {
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    const row = screen.getByText('OPEN-0007').closest('tr');
    expect(row).toHaveTextContent('Brackets x7, High game, Lineage');

    await user.click(screen.getByRole('button', { name: 'Bowlers' }));
    const bowlers = within(screen.getByRole('table', { name: 'Bowlers' }));
    expect(bowlers.getByRole('columnheader', { name: 'Side events' })).toBeInTheDocument();
    expect(bowlers.getByText('Ann Lee').closest('tr')).toHaveTextContent('Brackets x5, High game');
    expect(bowlers.getByText('Bob Ray').closest('tr')).toHaveTextContent('Brackets x2');
  });

  it('lets staff register a bowler who does not meet the rules, with the override sent signed in', async () => {
    const config = {
      tournament_id: 42,
      tournament_name: 'Spring Open',
      events: [{ id: 'evt-singles', name: 'Singles', enabled: true, minPlayers: 1, maxPlayers: 1, connectedDivisionIds: ['div-u200'], connectedSquadIds: ['sq-am'], entryFeeCents: 6000 }],
      divisions: [{ id: 'div-u200', name: 'Under 200', enabled: true, maxAverage: 199 }],
      squads: [{ id: 'sq-am', name: 'Morning' }],
      fields: [
        { id: 'f1', key: 'first_name', label: 'First name', mode: 'required', displayOrder: 1 },
        { id: 'f2', key: 'last_name', label: 'Last name', mode: 'required', displayOrder: 2 },
        { id: 'f3', key: 'average', label: 'Average', mode: 'required', displayOrder: 3 },
      ],
      questions: [],
      fees: [{ id: 'fee-brackets', name: 'Brackets', amountCents: 500, enabled: true, sideEvent: { kind: 'brackets', allowQuantity: true, maxQuantity: 10, per: 'bowler' } }],
      start_date: '2026-10-01',
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => (
      init?.method === 'POST'
        ? new Response(JSON.stringify({ status: 'confirmed', registration_id: 'SO-2026-0002' }), { status: 200 })
        : new Response(JSON.stringify(config), { status: 200 })
    ));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<RegistrationsPage />);

    await user.click(screen.getByRole('button', { name: 'Manual registration' }));
    const form = await screen.findByRole('dialog', { name: 'Register: Spring Open' });
    await user.type(within(form).getByLabelText(/^First name/u), 'Cal');
    await user.type(within(form).getByLabelText(/^Last name/u), 'Moss');
    await user.type(within(form).getByLabelText(/^Average/u), '215');
    await user.click(within(form).getByRole('button', { name: 'More Brackets for Cal Moss' }));
    await user.click(within(form).getByRole('button', { name: 'Continue to review' }));

    expect(within(form).getByRole('alert')).toHaveTextContent('Cal Moss: average 215 is above the Under 200 maximum of 199.');
    await user.click(within(form).getByRole('checkbox', { name: /Register anyway/u }));
    await user.click(within(form).getByRole('button', { name: 'Continue to review' }));
    const review = screen.getByRole('dialog', { name: 'Please review before submitting' });
    await user.click(within(review).getByRole('checkbox', { name: 'I have read and agree to this disclosure.' }));
    await user.click(within(review).getByRole('button', { name: 'Agree and submit registration' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, init] = fetchMock.mock.calls[1];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer session');
    const body = JSON.parse(String(init?.body));
    expect(body.form.override_eligibility).toBe(true);
    expect(body.form.side_events).toEqual([{ fee_id: 'fee-brackets', bowler_index: 0, quantity: 1 }]);
  });
});
