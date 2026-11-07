import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DuplicateTournamentModal, { suggestDuplicateName, suggestNextStartDate } from './DuplicateTournamentModal';
import TournamentGrid from './TournamentGrid';
import type { OrganizerDashboardTournament } from './useOrganizerDashboard';

const tournament: OrganizerDashboardTournament = {
  id: 58, name: 'County Open 2026', startDate: '2026-11-14', endDate: '2026-11-15',
  location: 'Meridian Lanes, Meridian, ID', isPublic: true, entryCount: 2, squadCount: 3,
  upcomingSquadCount: 0, amountPaidCents: 4050, hasPublishedSetup: true, publicUrl: null, hasLogo: false,
};

afterEach(cleanup);

describe('duplicate tournament', () => {
  it('suggests next year by name and keeps the same weekday', () => {
    expect(suggestDuplicateName('County Open 2026')).toBe('County Open 2027');
    expect(suggestDuplicateName('Spring Doubles')).toBe('Spring Doubles (copy)');
    // Saturday Nov 14, 2026 -> Saturday Nov 13, 2027.
    expect(suggestNextStartDate('2026-11-14')).toBe('2027-11-13');
    expect(new Date(2027, 10, 13).getDay()).toBe(new Date(2026, 10, 14).getDay());
    expect(suggestNextStartDate(null)).toBe('');
  });

  it('offers Duplicate in the row menu, even when the tournament has registrations', async () => {
    const user = userEvent.setup();
    const onDuplicate = vi.fn();
    render(<TournamentGrid tournaments={[tournament]} deletingTournamentId={null} onDeleteTournament={vi.fn()} onDuplicateTournament={onDuplicate} />);
    await user.click(screen.getByRole('button', { name: 'More actions for County Open 2026' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate County Open 2026' }));
    expect(onDuplicate).toHaveBeenCalledWith(tournament);
  });

  it('prefills the dialog and sends the chosen name, date, and documents option', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DuplicateTournamentModal tournament={tournament} busy={false} error={null} onCancel={vi.fn()} onConfirm={onConfirm} />);
    const dialog = screen.getByRole('dialog', { name: 'Duplicate tournament' });
    expect(within(dialog).getByLabelText('New tournament name')).toHaveValue('County Open 2027');
    expect(within(dialog).getByLabelText('First day')).toHaveValue('2027-11-13');
    await user.click(within(dialog).getByRole('checkbox', { name: /Copy documents/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Duplicate' }));
    expect(onConfirm).toHaveBeenCalledWith({ name: 'County Open 2027', startDate: '2027-11-13', includeDocuments: false });
  });

  it('blocks an empty name and shows a failure', async () => {
    const user = userEvent.setup();
    render(<DuplicateTournamentModal tournament={tournament} busy={false} error="Permission denied." onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Permission denied.');
    await user.clear(screen.getByLabelText('New tournament name'));
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDisabled();
  });
});
