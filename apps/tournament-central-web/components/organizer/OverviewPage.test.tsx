import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OverviewPage from '@/app/organizer/tournaments/[tournamentId]/page';
import { emptySquad } from './setupFactories';
import { localIsoDate } from './tournamentInsights';

const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock('./TournamentContext', () => ({ useTournamentContext: () => mocks.context() }));
vi.mock('./SendToBracketWorksCard', () => ({ default: () => <section aria-label="BracketWorks" /> }));
vi.mock('./ShareTournamentCard', () => ({ default: () => <section aria-label="Share" /> }));

function shiftDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function context(startDate: string, endDate: string) {
  return {
    tournamentId: 67,
    tournament: { id: 67, name: 'County Open', start_date: startDate, end_date: endDate, location: 'Meridian Lanes', is_public: true },
    setupSummary: { is_published: true, updated_at: '2026-11-01T12:00:00Z' },
    squads: [{ ...emptySquad(), id: 'sq-1', name: 'Morning', startTime: '09:00', capacity: 40 }],
    registrations: [
      { id: 1, status: 'confirmed', payment_status: 'paid', entries: [{ id: 1, squad_config_id: 'sq-1', status: 'confirmed', bowler_count: 1 }] },
      { id: 2, status: 'confirmed', payment_status: 'unpaid', entries: [{ id: 2, squad_config_id: 'sq-1', status: 'confirmed', bowler_count: 1 }] },
      { id: 3, status: 'pending', payment_status: 'unpaid', entries: [{ id: 3, squad_config_id: 'sq-1', status: 'pending', bowler_count: 1 }] },
    ],
    eventCount: 1,
    hasRulesDocument: true,
    registrationCloseIso: null,
    registrationCloseTime: null,
    tournamentTimeZone: 'America/Boise',
    isTournamentLoading: false,
    isSetupLoading: false,
    isRegistrationsLoading: false,
    tournamentError: null,
    setupError: null,
    registrationsError: null,
  };
}

beforeEach(() => {
  mocks.context.mockReturnValue(context(shiftDays(1), shiftDays(2)));
});

afterEach(() => {
  cleanup();
});

describe('tournament overview', () => {
  it('shows registration statuses in the stat detail instead of a separate card', () => {
    render(<OverviewPage />);
    expect(screen.queryByRole('region', { name: 'Registration status' })).not.toBeInTheDocument();
    expect(screen.getByText('2 confirmed · 1 pending')).toBeInTheDocument();
  });

  it('puts the squads card in the main column and orders the side cards details, share, BracketWorks', () => {
    const { container } = render(<OverviewPage />);
    const labels = [...container.querySelectorAll('[aria-label]')]
      .map((element) => element.getAttribute('aria-label'))
      .filter((label) => ['Tournament day', 'Squads', 'Details', 'Share', 'BracketWorks'].includes(label ?? ''));
    expect(labels).toEqual(['Tournament day', 'Squads', 'Details', 'Share', 'BracketWorks']);
  });

  it('shows tournament day shortcuts from the day before the start through the last day', () => {
    render(<OverviewPage />);
    const day = screen.getByRole('region', { name: 'Tournament day' });
    expect(within(day).getByRole('link', { name: 'Check-in' })).toHaveAttribute('href', '/organizer/tournaments/67/check-in');
    expect(within(day).getByRole('link', { name: 'Scores' })).toHaveAttribute('href', '/organizer/tournaments/67/scores');
    const live = within(day).getByRole('link', { name: /Live standings/ });
    expect(live).toHaveAttribute('href', '/live/67');
    expect(live).toHaveAttribute('target', '_blank');
    cleanup();

    mocks.context.mockReturnValue(context(shiftDays(-1), shiftDays(0)));
    render(<OverviewPage />);
    expect(screen.getByRole('region', { name: 'Tournament day' })).toBeInTheDocument();
  });

  it('hides the tournament day shortcuts before and after the tournament', () => {
    mocks.context.mockReturnValue(context(shiftDays(2), shiftDays(3)));
    render(<OverviewPage />);
    expect(screen.queryByRole('region', { name: 'Tournament day' })).not.toBeInTheDocument();
    cleanup();

    mocks.context.mockReturnValue(context(shiftDays(-3), shiftDays(-1)));
    render(<OverviewPage />);
    expect(screen.queryByRole('region', { name: 'Tournament day' })).not.toBeInTheDocument();
  });
});
