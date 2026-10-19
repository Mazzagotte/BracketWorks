import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OverviewPage from '@/app/organizer/tournaments/[tournamentId]/page';
import SquadsPage from '@/app/organizer/tournaments/[tournamentId]/squads/page';
import TournamentInformation from '@/components/public/TournamentInformation';
import { emptySquad } from './setupFactories';

vi.mock('./TournamentContext', () => ({
  useTournamentContext: () => ({
    tournamentId: 1,
    tournament: null,
    squads: [{ ...emptySquad(), id: '1130', name: '11:30 AM', capacity: 75 }],
    registrations: [{
      id: 1,
      status: 'confirmed',
      entries: [{
        id: 1,
        squad_config_id: '1130',
        status: 'confirmed',
        bowler_count: 2,
      }],
    }],
    isTournamentLoading: false,
    isSetupLoading: false,
    isRegistrationsLoading: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('squad availability labels', () => {
  it.each([
    ['organizer overview', OverviewPage],
    ['organizer squads', SquadsPage],
  ])('shows registrations, bowlers, and bowler spots separately on the %s', (_name, Page) => {
    render(<Page />);

    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent);
    const row = within(table).getByText('11:30 AM').closest('tr');
    if (!row) throw new Error('Squad summary row was not rendered.');
    const cells = within(row).getAllByRole('cell');
    for (const [label, value] of [
      ['Registrations', '1'],
      ['Bowlers', '2'],
      ['Bowler capacity', '75'],
      ['Bowler spots available', '73'],
      ['Waitlisted registrations', '0'],
      ['Waitlisted bowlers', '0'],
    ]) {
      expect(cells[headers.indexOf(label)]).toHaveTextContent(new RegExp(`^${value}$`));
    }
  });

  it.each([
    [2, 75, '73 of 75 bowler spots remaining'],
    [1, 75, '74 of 75 bowler spots remaining'],
    [76, 75, '0 of 75 bowler spots remaining'],
  ])('labels public availability for %i bowlers out of %i spots', async (registeredCount, capacity, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        details: {},
        squads: [{ id: '1130', name: '11:30 AM', capacity, registeredCount }],
      }),
    }));
    render(<TournamentInformation configUrl="/test-information" />);

    expect(await screen.findByText(/bowler spots remaining/)).toHaveTextContent(expected);
    const count = screen.getByText(`${registeredCount} bowler${registeredCount === 1 ? '' : 's'} registered`);
    expect(count.childNodes).toHaveLength(1);
    expect(screen.getByText('1 squad').childNodes).toHaveLength(1);
  });

  it('does not invent public availability when capacity is unspecified', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        details: {},
        squads: [{ id: '1130', name: '11:30 AM', registeredCount: 2 }],
      }),
    }));
    render(<TournamentInformation configUrl="/test-information" />);

    expect(await screen.findByText(/Contact the organizer for availability/)).toBeInTheDocument();
    expect(screen.queryByText(/bowler spots remaining/)).not.toBeInTheDocument();
  });

  it('groups public details into sections without repeating organizer or generated squad schedules', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        details: { organizer: 'County USBC', contactName: 'County USBC', supportEmail: 'organizer@example.com' },
        events: [{ id: 'doubles', name: 'Doubles', scoring: 'scratch', entryFeeCents: 4000 }],
        squads: [{
          id: '1130', name: 'Sunday, November 15, 2026 - 11:30 AM',
          dateIso: '2026-11-15', startTime: '11:30', capacity: 75, registeredCount: 75,
        }],
      }),
    }));
    render(<TournamentInformation configUrl="/test-information" />);

    expect(await screen.findByRole('heading', { name: 'Squad times and availability' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Events and format' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Organizer contact' })).toBeInTheDocument();
    expect(screen.getByText('County USBC')).toBeInTheDocument();
    expect(screen.queryByText('County USBC - County USBC')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'organizer@example.com' })).toHaveAttribute('href', 'mailto:organizer@example.com');
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getAllByText(/11:30 AM/)).toHaveLength(1);
  });
});
