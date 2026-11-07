import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TournamentGrid from './TournamentGrid';
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
afterEach(cleanup);

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
    await user.selectOptions(screen.getByRole('combobox'), 'published');
    expect(screen.getByRole('article', { name: 'County Open' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Spring Doubles' })).not.toBeInTheDocument();
  });

  it('lists upcoming tournaments soonest first and keeps finished ones under Past', async () => {
    const user = userEvent.setup();
    const finished: OrganizerDashboardTournament = { ...tournaments[0], id: 60, name: 'Last Year Classic', startDate: '2020-03-01', endDate: '2020-03-01' };
    const later: OrganizerDashboardTournament = { ...tournaments[0], id: 61, name: 'Far Future Open', startDate: '2099-01-01', endDate: '2099-01-01' };
    render(<TournamentGrid tournaments={[later, finished, ...tournaments]} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    expect(screen.getAllByRole('article').map((row) => row.getAttribute('aria-label'))).toEqual(['County Open', 'Far Future Open', 'Spring Doubles']);
    await user.click(screen.getByRole('button', { name: /Past/ }));
    expect(screen.getAllByRole('article').map((row) => row.getAttribute('aria-label'))).toEqual(['Last Year Classic']);
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
