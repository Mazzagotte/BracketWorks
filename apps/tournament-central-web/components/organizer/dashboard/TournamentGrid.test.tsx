import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentGrid from './TournamentGrid';
import TournamentStatusBadge from './TournamentStatusBadge';
import { countdownLabel, tournamentStage } from './tournamentTiming';
import OrganizerAttentionList from './OrganizerAttentionList';
import type { OrganizerDashboardTournament } from './useOrganizerDashboard';

const tournaments: OrganizerDashboardTournament[] = [
  {
    id: 58, name: 'County Open', startDate: '2027-02-07', endDate: '2027-02-07',
    location: 'Meridian Lanes, Meridian, ID', isPublic: true, entryCount: 2, squadCount: 3,
    upcomingSquadCount: 0, amountPaidCents: 4050, hasPublishedSetup: true, publicUrl: '/?tournament=tc-58', hasLogo: false,
  },
  {
    id: 59, name: 'Spring Doubles', startDate: null, endDate: null,
    location: 'Boise, ID', isPublic: false, entryCount: 0, squadCount: 0,
    upcomingSquadCount: 0, amountPaidCents: 0, hasPublishedSetup: false, publicUrl: null, hasLogo: false,
  },
];
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('operations dashboard tournament list', () => {
  it('shows compact metrics, one visible action, and secondary actions with deletion safeguards in a menu', async () => {
    const user = userEvent.setup();
    render(<TournamentGrid tournaments={tournaments} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    const row = screen.getByRole('article', { name: 'County Open' });
    expect(within(row).getByText('$40.50')).toBeInTheDocument();
    expect(within(row).getByText('Registrations')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Manage County Open' })).toHaveAttribute('href', '/organizer/tournaments/58');
    expect(within(row).queryByRole('button', { name: 'Delete County Open' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'More actions for County Open' }));
    expect(screen.getByRole('menuitem', { name: /View public page for County Open/ })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('menuitem', { name: 'Delete County Open' })).toBeDisabled();
    expect(screen.getByText("Tournaments with registrations can't be deleted.")).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'More actions for Spring Doubles' }));
    expect(screen.getByRole('menuitem', { name: 'Delete Spring Doubles' })).toBeEnabled();
    expect(screen.queryByRole('menuitem', { name: /View public page for Spring Doubles/ })).not.toBeInTheDocument();
  });

  it('combines name/location search with publication filtering and clears empty results', async () => {
    const user = userEvent.setup();
    render(<TournamentGrid tournaments={tournaments} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    await user.type(screen.getByRole('searchbox', { name: 'Search your tournaments' }), 'meridian');
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 tournaments');
    expect(screen.queryByRole('article', { name: 'Spring Doubles' })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tournament publication status' }), 'draft');
    expect(screen.getByRole('heading', { name: 'No matching tournaments' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tournament publication status' }), 'published');
    expect(screen.getByRole('article', { name: 'County Open' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Spring Doubles' })).not.toBeInTheDocument();
  });

  it('shows all tournaments by default, upcoming first, and filters by Upcoming or Past', async () => {
    const user = userEvent.setup();
    const finished: OrganizerDashboardTournament = { ...tournaments[0], id: 60, name: 'Last Year Classic', startDate: '2020-03-01', endDate: '2020-03-01' };
    const older: OrganizerDashboardTournament = { ...tournaments[0], id: 62, name: 'Old Timers', startDate: '2019-03-01', endDate: '2019-03-01' };
    const later: OrganizerDashboardTournament = { ...tournaments[0], id: 61, name: 'Far Future Open', startDate: '2099-01-01', endDate: '2099-01-01' };
    render(<TournamentGrid tournaments={[later, older, finished, ...tournaments]} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    const names = () => screen.getAllByRole('article').map((row) => row.getAttribute('aria-label'));
    expect(names()).toEqual(['County Open', 'Far Future Open', 'Spring Doubles', 'Last Year Classic', 'Old Timers']);
    await user.click(screen.getByRole('button', { name: /Upcoming/ }));
    expect(names()).toEqual(['County Open', 'Far Future Open', 'Spring Doubles']);
    await user.click(screen.getByRole('button', { name: /Past/ }));
    expect(names()).toEqual(['Last Year Classic', 'Old Timers']);
  });

  it('shows one life-stage badge next to the publication badge', () => {
    const finished: OrganizerDashboardTournament = { ...tournaments[0], id: 60, name: 'Last Year Classic', startDate: '2020-03-01', endDate: '2020-03-01' };
    const datedDraft: OrganizerDashboardTournament = { ...tournaments[1], id: 63, name: 'Fall Draft', startDate: '2099-09-01', endDate: '2099-09-01' };
    render(<TournamentGrid tournaments={[finished, datedDraft, ...tournaments]} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    expect(within(screen.getByRole('article', { name: 'Last Year Classic' })).getByText('Past')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'County Open' })).getByText('Registration open')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Fall Draft' })).getByText('Upcoming')).toBeInTheDocument();
    const undated = screen.getByRole('article', { name: 'Spring Doubles' });
    expect(within(undated).queryByText('Upcoming')).not.toBeInTheDocument();
    expect(within(undated).queryByText('Past')).not.toBeInTheDocument();
  });

  it('puts the countdown in the date line and spots under Registrations', () => {
    const limited: OrganizerDashboardTournament = { ...tournaments[0], id: 64, name: 'Capped Classic', spotsTotal: 48, spotsFilled: 12 };
    render(<TournamentGrid tournaments={[limited, tournaments[1]]} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    const row = screen.getByRole('article', { name: 'Capped Classic' });
    expect(within(row).getByText(/Feb 7, 2027 · in \d+ days · Meridian Lanes/)).toBeInTheDocument();
    expect(within(row).getByText('12 of 48 spots')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Spring Doubles' })).queryByText(/spots/)).not.toBeInTheDocument();
  });

  it('sorts by name or registrations and remembers the choices', async () => {
    const user = userEvent.setup();
    const busy: OrganizerDashboardTournament = { ...tournaments[0], id: 65, name: 'Busy Open', startDate: '2099-01-01', endDate: '2099-01-01', entryCount: 40 };
    const view = render(<TournamentGrid tournaments={[...tournaments, busy]} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    const names = () => screen.getAllByRole('article').map((row) => row.getAttribute('aria-label'));
    expect(names()).toEqual(['County Open', 'Busy Open', 'Spring Doubles']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort tournaments' }), 'name');
    expect(names()).toEqual(['Busy Open', 'County Open', 'Spring Doubles']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort tournaments' }), 'registrations');
    expect(names()).toEqual(['Busy Open', 'County Open', 'Spring Doubles']);
    await user.click(screen.getByRole('button', { name: /Upcoming/ }));

    view.unmount();
    render(<TournamentGrid tournaments={[...tournaments, busy]} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: 'Sort tournaments' })).toHaveValue('registrations');
    expect(screen.getByRole('button', { name: /Upcoming/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('routes deletion through the existing confirmation handler', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const view = render(<TournamentGrid tournaments={tournaments} deletingTournamentId={null} onDeleteTournament={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'More actions for Spring Doubles' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete Spring Doubles' }));
    expect(onDelete).toHaveBeenCalledWith(tournaments[1]);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    view.rerender(<TournamentGrid tournaments={tournaments} deletingTournamentId={59} onDeleteTournament={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'More actions for Spring Doubles' }));
    expect(screen.getByRole('menuitem', { name: 'Delete Spring Doubles' })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: 'Delete Spring Doubles' })).toHaveTextContent('Deleting...');
  });

  it('shows an explicit all-clear state or actionable attention items', () => {
    const view = render(<OrganizerAttentionList items={[]} />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    view.rerender(<OrganizerAttentionList items={[{ id: 'setup-59', tournamentId: 59, message: 'Spring Doubles: setup changes are not published yet.' }]} />);
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage: Spring Doubles/ })).toHaveAttribute('href', '/organizer/tournaments/59');
  });
});

describe('tournament life stage', () => {
  const now = new Date('2027-01-15T12:00:00-07:00');
  const live: OrganizerDashboardTournament = {
    ...tournaments[0], startDate: '2027-02-07', endDate: '2027-02-07',
    registrationOpensAt: '2027-01-01T00:00:00-07:00', registrationClosesAt: '2027-02-01T23:59:00-07:00',
    spotsTotal: 48, spotsFilled: 12,
  };

  it('moves from Opens, to open, to Full, to closed, to Past', () => {
    expect(tournamentStage({ ...live, registrationOpensAt: '2027-01-20T00:00:00-07:00' }, now)).toEqual({ label: 'Opens Jan 20', tone: 'neutral' });
    expect(tournamentStage(live, now)).toEqual({ label: 'Registration open', tone: 'info' });
    expect(tournamentStage({ ...live, spotsFilled: 48 }, now)).toEqual({ label: 'Full', tone: 'warning' });
    expect(tournamentStage(live, new Date('2027-02-03T12:00:00-07:00'))).toEqual({ label: 'Registration closed', tone: 'warning' });
    expect(tournamentStage(live, new Date('2027-02-08T12:00:00-07:00'))).toEqual({ label: 'Past', tone: 'neutral' });
  });

  it('shows only Upcoming for tournaments that take no sign-ups', () => {
    expect(tournamentStage({ ...live, hasPublishedSetup: false }, now)).toEqual({ label: 'Upcoming', tone: 'info' });
    expect(tournamentStage({ ...live, isPublic: false }, now)).toEqual({ label: 'Upcoming', tone: 'info' });
  });

  it('counts down to the start day', () => {
    expect(countdownLabel(live, '2027-01-15')).toBe('in 23 days');
    expect(countdownLabel(live, '2027-02-06')).toBe('Tomorrow');
    expect(countdownLabel(live, '2027-02-07')).toBe('Today');
    expect(countdownLabel({ startDate: '2027-02-06', endDate: '2027-02-08' }, '2027-02-07')).toBe('Underway');
    expect(countdownLabel(live, '2027-02-08')).toBeNull();
  });

  it('labels unlisted tournaments', () => {
    render(<TournamentStatusBadge isPublic hasPublishedSetup visibility="unlisted" />);
    expect(screen.getByText('Unlisted')).toBeInTheDocument();
  });
});
