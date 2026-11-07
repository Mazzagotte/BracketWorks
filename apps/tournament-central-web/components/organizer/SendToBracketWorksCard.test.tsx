import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SendToBracketWorksCard from './SendToBracketWorksCard';
import { getBracketWorksLink, syncToBracketWorks, type BracketWorksSyncSummary } from './bracketworksApi';

vi.mock('./bracketworksApi', () => ({
  BRACKETWORKS_URL: 'https://bracketworks.app',
  getBracketWorksLink: vi.fn(),
  syncToBracketWorks: vi.fn(),
}));

function summary(overrides: Partial<BracketWorksSyncSummary> = {}): BracketWorksSyncSummary {
  return {
    dry_run: true,
    include_pending: false,
    bw_tournament_id: null,
    bw_tournament_name: 'Spring Classic',
    created_tournament: true,
    squads_created: 2,
    players_created: 12,
    players_updated: 0,
    unchanged: 0,
    skipped: [{ name: 'Dee Nox', reason: 'No squad date and time on this entry' }],
    possible_duplicates: [],
    not_in_tc: [],
    squads_needing_regeneration: [],
    ...overrides,
  };
}

const unlinked = { linked: false, bw_tournament_id: null, bw_tournament_name: null, last_synced_at: null, last_sync_summary: null };
const linked = {
  linked: true,
  bw_tournament_id: 7,
  bw_tournament_name: 'Spring Classic',
  last_synced_at: '2026-11-07T15:00:00Z',
  last_sync_summary: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'test');
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('SendToBracketWorksCard', () => {
  it('previews, then sends after confirmation and shows the linked state', async () => {
    const user = userEvent.setup();
    vi.mocked(getBracketWorksLink).mockResolvedValueOnce(unlinked).mockResolvedValue(linked);
    vi.mocked(syncToBracketWorks).mockImplementation(async (_token, _id, options) =>
      options.dryRun
        ? summary({ players_created: options.includePending ? 14 : 12 })
        : summary({ dry_run: false, bw_tournament_id: 7, players_created: 14 }),
    );

    render(<SendToBracketWorksCard tournamentId={42} />);
    expect(await screen.findByText(/Bring your registered bowlers into BracketWorks/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send to BracketWorks' }));

    const dialog = await screen.findByRole('dialog', { name: 'Send to BracketWorks' });
    expect(syncToBracketWorks).toHaveBeenCalledWith('test', 42, { dryRun: true, includePending: false });
    expect(await within(dialog).findByRole('button', { name: 'Send 12 bowlers' })).toBeEnabled();
    expect(within(dialog).getByText('Dee Nox')).toBeInTheDocument();
    expect(within(dialog).getByText(/No squad date and time/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('checkbox', { name: 'Include pending registrations' }));
    expect(syncToBracketWorks).toHaveBeenLastCalledWith('test', 42, { dryRun: true, includePending: true });
    await user.click(await within(dialog).findByRole('button', { name: 'Send 14 bowlers' }));

    expect(syncToBracketWorks).toHaveBeenLastCalledWith('test', 42, { dryRun: false, includePending: true });
    expect(await screen.findByText(/Sent to BracketWorks: 14 new bowlers, 0 updates/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Linked to')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send updates' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open in BracketWorks/ })).toHaveAttribute('href', 'https://bracketworks.app');
  });

  it('does not send when the preview is cancelled', async () => {
    const user = userEvent.setup();
    vi.mocked(getBracketWorksLink).mockResolvedValue(unlinked);
    vi.mocked(syncToBracketWorks).mockResolvedValue(summary());

    render(<SendToBracketWorksCard tournamentId={42} />);
    await user.click(await screen.findByRole('button', { name: 'Send to BracketWorks' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('button', { name: 'Send 12 bowlers' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(syncToBracketWorks).toHaveBeenCalledTimes(1);
    expect(syncToBracketWorks).toHaveBeenCalledWith('test', 42, { dryRun: true, includePending: false });
  });

  it('warns when brackets in BracketWorks are out of date after an update', async () => {
    const user = userEvent.setup();
    vi.mocked(getBracketWorksLink).mockResolvedValue(linked);
    const outOfDate = [{ squad_id: 3, label: 'Squad A' }];
    vi.mocked(syncToBracketWorks).mockImplementation(async (_token, _id, options) => summary({
      dry_run: options.dryRun,
      created_tournament: false,
      bw_tournament_id: 7,
      players_created: 1,
      players_updated: 2,
      squads_created: 0,
      skipped: [],
      squads_needing_regeneration: outOfDate,
    }));

    render(<SendToBracketWorksCard tournamentId={42} />);
    await user.click(await screen.findByRole('button', { name: 'Send updates' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send updates to BracketWorks' });
    await user.click(await within(dialog).findByRole('button', { name: 'Send 3 bowlers' }));

    expect(await screen.findByText(/Brackets in BracketWorks are out of date for: Squad A/)).toBeInTheDocument();
    expect(screen.getByText(/Regenerate them in BracketWorks/)).toBeInTheDocument();
  });

  it('shows the server error in the preview', async () => {
    const user = userEvent.setup();
    vi.mocked(getBracketWorksLink).mockResolvedValue(linked);
    vi.mocked(syncToBracketWorks).mockRejectedValue(
      new Error('The linked BracketWorks tournament is finalized or archived, so bowlers cannot be sent to it.'),
    );

    render(<SendToBracketWorksCard tournamentId={42} />);
    await user.click(await screen.findByRole('button', { name: 'Send updates' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('finalized or archived');
    expect(within(dialog).getByRole('button', { name: 'Nothing to send' })).toBeDisabled();
  });
});
