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
  NO_SQUAD_KEY: '__no-squad__',
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
      finals_scope: 'tournament',
      divisions: [{ id: null, name: null, squad: null, entry_count: 2, advancing_count: 5, cashing_count: 2, cash_note: null }],
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
    squad_id: null,
    squad_label: null,
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
    expect(screen.queryByRole('link', { name: /Open finals view/ })).toBeNull();
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

    expect(startFinals).toHaveBeenCalledWith('session', 42, { event_config_id: 'evt-singles', division_config_id: null, squad_config_id: null });
    const input = await screen.findByRole('textbox', { name: 'Ann Lee, Title match' });
    expect(screen.getByRole('group', { name: 'Title match' })).toBeTruthy();

    await user.type(input, '210');
    await waitFor(() => expect(saveFinalsGames).toHaveBeenCalledTimes(1), SAVE_WAIT);
    expect(saveFinalsGames).toHaveBeenCalledWith(
      'session',
      42,
      { event_config_id: 'evt-singles', division_config_id: null, squad_config_id: null },
      [{ round: 1, match: 1, seed: 1, score: 210 }],
    );
    const row = input.closest('tr') as HTMLElement;
    expect(within(row).getAllByRole('cell').at(-1)?.textContent).toBe('246');
  });

  it('shows the cut and cash for the chosen squad when the event is per squad', async () => {
    const perSquad = grid();
    perSquad.events[0].finals_scope = 'squad';
    perSquad.squads = [{ id: 'sq-am', label: '9:00 AM' }, { id: 'sq-pm', label: '2:00 PM' }];
    perSquad.events[0].divisions = [
      { id: null, name: null, squad: { id: 'sq-am', label: '9:00 AM' }, entry_count: 2, advancing_count: 2, cashing_count: 1, cash_note: 'The finals winner cashes.' },
      { id: null, name: null, squad: { id: 'sq-pm', label: '2:00 PM' }, entry_count: 8, advancing_count: 2, cashing_count: 4, cash_note: 'Places 3-4 cash from qualifying' },
    ];
    vi.mocked(fetchScoreGrid).mockResolvedValue(perSquad);
    const user = userEvent.setup();
    await renderGrid();
    expect(screen.getByText(/Cut and cash lines are for each squad/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Squad'), 'sq-pm');
    expect(await screen.findByText(/Top 2 advance, places 3-4 cash from qualifying/)).toBeTruthy();
  });

  it('picks a squad for per-squad finals and shows placings', async () => {
    const squadGroup = (id: string, label: string) => ({
      ...standings.events[0].divisions[0],
      squad: { id, label },
    });
    vi.mocked(fetchStandings).mockResolvedValue({
      ...standings,
      events: [{ ...standings.events[0], divisions: [squadGroup('sq-am', '9:00 AM'), squadGroup('sq-pm', '2:00 PM')] }],
    });
    const done = finalsState(true);
    done.finals = {
      ...stepladder({ a: 190, b: 220 }),
      status: 'complete',
      champion: { name: 'Ann Lee', detail: 'Won the title match 220 to 190' },
      placings: [
        { key: '1', place: 1, tied: false, name: 'Ann Lee', cashing: true },
        { key: '2', place: 2, tied: false, name: 'Bob Ray', cashing: false },
      ],
    };
    vi.mocked(fetchFinals).mockResolvedValue(done);
    const user = userEvent.setup();
    render(<ScoresPage />);
    await user.click(screen.getByRole('button', { name: 'Finals' }));

    await waitFor(() => expect(fetchFinals).toHaveBeenCalledWith(
      'session', 42, { event_config_id: 'evt-singles', division_config_id: null, squad_config_id: 'sq-am' },
    ));
    const placings = await screen.findByRole('region', { name: 'Placings' });
    const finalsLink = screen.getByRole('link', { name: /Open finals view/ });
    expect(finalsLink.getAttribute('href')).toBe('/live/42/finals');
    expect(finalsLink.getAttribute('target')).toBe('_blank');
    expect(within(placings).getByText('1st')).toBeTruthy();
    expect(within(placings).getByText('Cashes')).toBeTruthy();
    expect(within(placings).getAllByText('Cashes')).toHaveLength(1);

    const squads = screen.getByRole('group', { name: 'Squad' });
    await user.click(within(squads).getByRole('button', { name: '2:00 PM' }));
    await waitFor(() => expect(fetchFinals).toHaveBeenLastCalledWith(
      'session', 42, { event_config_id: 'evt-singles', division_config_id: null, squad_config_id: 'sq-pm' },
    ));
  });
});
