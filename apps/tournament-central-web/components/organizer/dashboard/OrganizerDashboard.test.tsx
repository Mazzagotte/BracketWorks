import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OrganizerDashboard from './OrganizerDashboard';
import { useOrganizerDashboard } from './useOrganizerDashboard';
import { listMyTcStaffInvitations } from '../organizerApi';

vi.mock('./useOrganizerDashboard', () => ({ useOrganizerDashboard: vi.fn() }));
vi.mock('../organizerApi', () => ({
  deleteTournament: vi.fn(), listMyTcStaffInvitations: vi.fn(), respondToTcStaffInvitation: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('access_token', 'test');
  vi.mocked(listMyTcStaffInvitations).mockResolvedValue([]);
  vi.mocked(useOrganizerDashboard).mockReturnValue({
    tournaments: [{
      id: 58, name: 'County Open', startDate: '2027-02-07', endDate: '2027-02-07',
      location: 'Meridian Lanes', isPublic: true, entryCount: 0, squadCount: 3,
      upcomingSquadCount: 0, amountPaidCents: 4050, hasPublishedSetup: true, publicUrl: null, hasLogo: false,
    }],
    attentionItems: [], upcomingItems: [{ tournamentId: 58, name: 'County Open', date: new Date(2027, 1, 7) }],
    isLoading: false, error: null, refresh: vi.fn().mockResolvedValue(undefined),
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); });

describe('operations dashboard', () => {
  it('shows accurate payment precision, calendar navigation and an attention all-clear', async () => {
    await act(async () => { render(<OrganizerDashboard />); });
    expect(within(screen.getByRole('region', { name: 'Tournament summary' })).getByText('$40.50')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Upcoming activity' })).getByRole('link', { name: 'County Open' }))
      .toHaveAttribute('href', '/organizer/tournaments/58');
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    expect(screen.queryByText('Currently open')).not.toBeInTheDocument();
  });

  it('keeps the deletion confirmation and cancellation workflow', async () => {
    const user = userEvent.setup();
    await act(async () => { render(<OrganizerDashboard />); });
    await user.click(screen.getByRole('button', { name: 'Delete County Open' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete tournament?' });
    expect(dialog).toHaveTextContent('County Open');
    expect(dialog).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not present successful or empty dashboard content after a load failure', async () => {
    vi.mocked(useOrganizerDashboard).mockReturnValue({
      tournaments: [], attentionItems: [], upcomingItems: [], isLoading: false,
      error: 'Service unavailable', refresh: vi.fn(),
    });
    await act(async () => { render(<OrganizerDashboard />); });
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your tournaments.");
    expect(screen.queryByRole('region', { name: 'Tournament summary' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your tournaments' })).not.toBeInTheDocument();
    expect(screen.queryByText("You're all caught up")).not.toBeInTheDocument();
  });
});
