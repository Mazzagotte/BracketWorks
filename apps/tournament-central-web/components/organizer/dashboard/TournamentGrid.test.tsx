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
  it('shows compact metrics, named management links and registration deletion safeguards', () => {
    render(<TournamentGrid tournaments={tournaments} deletingTournamentId={null} onDeleteTournament={vi.fn()} />);
    const row = screen.getByRole('article', { name: 'County Open' });
    expect(within(row).getByText('$40.50')).toBeInTheDocument();
    expect(within(row).getByText('Registrations')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'Manage County Open' })).toHaveAttribute('href', '/organizer/tournaments/58');
    expect(within(row).getByRole('link', { name: /View public page for County Open/ })).toHaveAttribute('target', '_blank');
    expect(within(row).getByRole('button', { name: 'Delete County Open' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Spring Doubles' })).toBeEnabled();
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

  it('routes deletion through the existing confirmation handler', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup();
    const view = render(<TournamentGrid tournaments={tournaments} deletingTournamentId={null} onDeleteTournament={onDelete} />);
    await user.click(screen.getByRole('button', { name: 'Delete Spring Doubles' }));
    expect(onDelete).toHaveBeenCalledWith(tournaments[1]);
    view.rerender(<TournamentGrid tournaments={tournaments} deletingTournamentId={59} onDeleteTournament={onDelete} />);
    expect(screen.getByRole('button', { name: 'Delete Spring Doubles' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Spring Doubles' })).toHaveTextContent('Deleting...');
  });

  it('shows an explicit all-clear state or actionable attention items', () => {
    const view = render(<OrganizerAttentionList items={[]} />);
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    view.rerender(<OrganizerAttentionList items={[{ id: 'setup-59', tournamentId: 59, message: 'Spring Doubles: setup changes are not published yet.' }]} />);
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Manage: Spring Doubles/ })).toHaveAttribute('href', '/organizer/tournaments/59');
  });
});
