import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScoresPage from '@/app/organizer/tournaments/[tournamentId]/scores/page';
import type { LiveFinals, LiveStandings } from '@/components/live/liveStandingsTypes';
import { fetchFinals, fetchScoreGrid, fetchStandings, saveFinalsGames, saveScores, startFinals } from './scoresApi';
import type { FinalsState, ScoreGrid } from './scoresApi';

vi.mock('./TournamentContext', () => ({ useTournamentContext: () => ({ tournamentId: 42, tournament: { name: 'Fall Open' } }) }));
vi.mock('./scoresApi', () => ({
  fetchScoreGrid: vi.fn(),
  saveScores: vi.fn(),
  fetchStandings: vi.fn(),
  fetchFinals: vi.fn(),
  startFinals: vi.fn(),
  saveFinalsGames: vi.fn(),
  resetFinals: vi.fn(),
}));

const SAVE_WAIT = { timeout: 3000 };

function grid(): ScoreGrid {
  return {
    events: [{
      id: 'evt-singles',
      name: 'Singles',
      format: 'singles',
      scoring: 'handicap',
      scoring_label: 'Handicap 90% of 220',
      games: 3,
      divisions: [{ id: null, name: null, entry_count: 2, advancing_count: 5, cashing_count: 2 }],
    }],
    event_id: 'evt-singles',
    squads: [{ id: 'sq-am', label: 'Sat 9:00 AM' }],
    squad_id: null,
    games: 3,
    max_game: 10,
    shared_score: false,
    updated_at: null,
    rows: [
      {
        entry_id: 1,
        label: 'Ann Lee',
        division: null,
        squad: 'Sat 9:00 AM',
        squad_id: 'sq-am',
        bowlers: [{ bowler_id: 11, name: 'Ann Lee', average: 180, handicap_per_game: 36 }],
        scores: { 11: [200, null, null] },
        totals: { games_bowled: 1, scratch: 200, handicap: 36, total: 236 },
      },
      {
        entry_id: 2,
        label: 'Bob Ray',
        division: null,
        squad: 'Sat 9:00 AM',
        squad_id: 'sq-am',
        bowlers: [{ bowler_id: 12, name: 'Bob Ray', average: 220, handicap_per_game: 0 }],
        scores: { 12: [null, null, null] },
        totals: { games_bowled: 0, scratch: 0, handicap: 0, total: 0 },
      },
    ],
  };
}

function stepladder(scores: { a: number | null; b: number | null }): LiveFinals {
  return {
    type: 'stepladder',
    label: 'Stepladder, top 2',
    status: 'in-progress',
    champion: null,
    matches: [{
      id: 'r1-m1',
      round: 1,
      label: 'Title match',
      a: { seed: 2, name: 'Bob Ray', score: scores.a, winner: false },
      b: { seed: 1, name: 'Ann Lee', score: scores.b, winner: false },
    }],
    rounds: [],
    table: [],
    notes: '',
  };
}

function finalsState(started: boolean): FinalsState {
  return {
    event_id: 'evt-singles',
    division_id: null,
    event_name: 'Singles',
    division_name: null,
    finals_type: 'stepladder',
    started,
    can_start: !started,
    advancing_count: 2,
    qualifiers: [
      { key: '1', rank: 1, tied: false, name: 'Ann Lee', bowlers: [], games: [], gamesBowled: 3, scratchTotal: 600, handicapTotal: 108, total: 708, status: 'advancing', squadLabel: null },
      { key: '2', rank: 2, tied: false, name: 'Bob Ray', bowlers: [], games: [], gamesBowled: 3, scratchTotal: 650, handicapTotal: 0, total: 650, status: 'advancing', squadLabel: null },
    ],
    seeds: [],
    finals: started ? stepladder({ a: null, b: null }) : { ...stepladder({ a: null, b: null }), status: 'not-started', matches: [] },
    slots: started
      ? [
        { round: 1, match: 1, seed: 2, name: 'Bob Ray', label: 'Title match', score: null, handicap: 0 },
        { round: 1, match: 1, seed: 1, name: 'Ann Lee', label: 'Title match', score: null, handicap: 36 },
      ]
      : [],
  };
}

const standings = {
  tournament: { id: 42, name: 'Fall Open', dateText: '', locationText: '', status: 'in-progress', logoUrl: null },
  updatedAt: null,
  fingerprint: 'x',
  allEvents: null,
  events: [{
    id: 'evt-singles',
    name: 'Singles',
    format: 'singles',
    scoring: 'handicap',
    games: 3,
    scoringLabel: 'Handicap 90% of 220',
    divisions: [{ id: null, name: null, entryCount: 2, advancingCount: 2, cashingCount: null, rows: [], finals: stepladder({ a: null, b: null }) }],
  }],
} satisfies LiveStandings;

beforeEach(() => {
  vi.resetAllMocks();
  sessionStorage.setItem('access_token', 'session');
  vi.mocked(fetchScoreGrid).mockResolvedValue(grid());
  vi.mocked(saveScores).mockResolvedValue({ saved: 1, updated_at: '2026-11-07T20:04:00Z' });
  vi.mocked(fetchStandings).mockResolvedValue(standings);
  vi.mocked(fetchFinals).mockResolvedValue(finalsState(false));
  vi.mocked(startFinals).mockResolvedValue(finalsState(true));
  vi.mocked(saveFinalsGames).mockResolvedValue(finalsState(true));
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

async function renderGrid() {
  render(<ScoresPage />);
  return screen.findByRole('table', { name: 'Scores for Singles' });
}

describe('Scores page', () => {
  it('renders the grid with handicap totals, the cut summary, and the live link', async () => {
    const table = within(await renderGrid());

    expect(screen.getByRole('heading', { level: 1, name: 'Scores' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open live standings/ }).getAttribute('href')).toBe('/live/42');
    expect(screen.getByText(/Handicap 90% of 220 · Top 5 advance, top 2 cash/)).toBeTruthy();
    expect((table.getByRole('textbox', { name: 'Ann Lee, game 1' }) as HTMLInputElement).value).toBe('200');
    const annRow = table.getByRole('textbox', { name: 'Ann Lee, game 1' }).closest('tr') as HTMLElement;
    const cells = within(annRow).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells.slice(-3)).toEqual(['200', '36', '236']);
  });

  it('saves after a pause in typing and updates totals right away', async () => {
    const user = userEvent.setup();
    const table = within(await renderGrid());
    const input = table.getByRole('textbox', { name: 'Ann Lee, game 2' });

    await user.type(input, '190');
    const annRow = input.closest('tr') as HTMLElement;
    expect(within(annRow).getAllByRole('cell').map((cell) => cell.textContent).slice(-3)).toEqual(['390', '72', '462']);
    expect(saveScores).not.toHaveBeenCalled();

    await waitFor(() => expect(saveScores).toHaveBeenCalledTimes(1), SAVE_WAIT);
    expect(saveScores).toHaveBeenCalledWith('session', 42, [{ entry_id: 1, bowler_id: 11, game: 2, score: 190 }]);
    await waitFor(() => expect(screen.getByText(/^Saved /)).toBeTruthy());
  });

  it('moves to the same game for the next bowler on Enter', async () => {
    const user = userEvent.setup();
    const table = within(await renderGrid());

    await user.click(table.getByRole('textbox', { name: 'Ann Lee, game 2' }));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(table.getByRole('textbox', { name: 'Bob Ray, game 2' }));
  });

  it('shows an inline error for a score over 300 and does not save it', async () => {
    const user = userEvent.setup();
    const table = within(await renderGrid());
    const input = table.getByRole('textbox', { name: 'Bob Ray, game 1' });

    await user.type(input, '301');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(table.getByText('0 to 300')).toBeTruthy();
    await new Promise((resolve) => { setTimeout(resolve, 900); });
    expect(saveScores).not.toHaveBeenCalled();
  });

  it('shows a retry notice when saving fails', async () => {
    vi.mocked(saveScores).mockRejectedValueOnce(new Error('Server unavailable'));
    const user = userEvent.setup();
    const table = within(await renderGrid());

    await user.type(table.getByRole('textbox', { name: 'Bob Ray, game 1' }), '180');
    expect(await screen.findByText(/Scores not saved. Server unavailable/, {}, SAVE_WAIT)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(saveScores).toHaveBeenCalledTimes(2));
    expect(vi.mocked(saveScores).mock.calls[1][2]).toEqual([{ entry_id: 2, bowler_id: 12, game: 1, score: 180 }]);
  });

  it('starts finals after confirming and saves finals scores', async () => {
    const saved = finalsState(true);
    saved.slots = saved.slots.map((slot) => (slot.seed === 1 ? { ...slot, score: 210 } : slot));
    vi.mocked(saveFinalsGames).mockResolvedValue(saved);
    const user = userEvent.setup();
    render(<ScoresPage />);
    await user.click(screen.getByRole('button', { name: 'Finals' }));

    const qualifiers = await screen.findByRole('table', { name: 'Qualifiers' });
    expect(within(qualifiers).getByText('Ann Lee')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Start finals' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/Seeds are taken from the current standings/)).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Start finals' }));

    expect(startFinals).toHaveBeenCalledWith('session', 42, { event_config_id: 'evt-singles', division_config_id: null });
    const input = await screen.findByRole('textbox', { name: 'Ann Lee, Title match' });
    expect(screen.getByRole('group', { name: 'Title match' })).toBeTruthy();

    await user.type(input, '210');
    await waitFor(() => expect(saveFinalsGames).toHaveBeenCalledTimes(1), SAVE_WAIT);
    expect(saveFinalsGames).toHaveBeenCalledWith(
      'session',
      42,
      { event_config_id: 'evt-singles', division_config_id: null },
      [{ round: 1, match: 1, seed: 1, score: 210 }],
    );
    const row = input.closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell').at(-1)?.textContent).toBe('246');
  });
});
