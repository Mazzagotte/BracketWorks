import { act, cleanup, render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LiveStandingsView, { TV_CYCLE_MS } from './LiveStandingsView';
import { livePagePath, liveStandingsPath, parseLiveTournamentId } from './liveStandingsPaths';
import type { LiveDivision, LiveStandings, StandingRow } from './liveStandingsTypes';
import { LIVE_POLL_MS } from './useLiveStandings';

function row(key: string, rank: number | null, name: string, games: Array<number | null>, extra: Partial<StandingRow> = {}): StandingRow {
  const scratch = games.reduce<number>((sum, game) => sum + (game ?? 0), 0);
  const bowled = games.filter((game) => game !== null).length;
  const handicapTotal = extra.handicapTotal ?? 0;
  return {
    key,
    rank,
    tied: false,
    name,
    bowlers: [{ name, average: 180, handicapPerGame: 0 }],
    games,
    gamesBowled: bowled,
    scratchTotal: scratch,
    handicapTotal,
    total: scratch + handicapTotal,
    status: null,
    squadLabel: null,
    ...extra,
  };
}

const openDivision: LiveDivision = {
  id: 'open',
  name: 'Open',
  entryCount: 5,
  advancingCount: 2,
  cashingCount: 3,
  rows: [
    row('e1', 1, 'Ann Lee', [220, 210, 200], { handicapTotal: 30, status: 'advancing' }),
    row('e2', 2, 'Bob Ray', [200, 200, 200], { tied: true, handicapTotal: 15, status: 'advancing' }),
    row('e3', 2, 'Cara Diaz', [190, 195, 230], { tied: true, handicapTotal: 0, status: 'cashing' }),
    row('e4', 4, 'Dan Fox', [150, 0, null], { handicapTotal: 20 }),
    row('e5', null, 'Eve Moss', [null, null, null]),
  ],
  finals: {
    type: 'stepladder',
    label: 'Stepladder, top 3',
    status: 'complete',
    champion: { name: 'Ann Lee', detail: 'Won the final 214 to 191' },
    matches: [
      { id: 'm1', round: 1, label: 'Match 1', a: { seed: 2, name: 'Bob Ray', score: 201, winner: true }, b: { seed: 3, name: 'Cara Diaz', score: 180, winner: false } },
      { id: 'm2', round: 2, label: 'Title match', a: { seed: 1, name: 'Ann Lee', score: 214, winner: true }, b: { seed: 2, name: 'Bob Ray', score: 191, winner: false } },
    ],
    rounds: [],
    table: [],
    notes: '',
  },
};

const seniorDivision: LiveDivision = {
  id: 'senior',
  name: 'Senior',
  entryCount: 1,
  advancingCount: null,
  cashingCount: null,
  rows: [row('s1', null, 'Gus Hale', [null, null, null])],
  finals: null,
};

function payload(overrides: Partial<LiveStandings> = {}): LiveStandings {
  return {
    tournament: { id: 58, name: 'County Open', dateText: 'Nov 15, 2026', locationText: 'Meridian Lanes, Meridian, ID', status: 'in-progress', logoUrl: null },
    updatedAt: '2026-11-15T20:08:00Z',
    fingerprint: 'fp-1',
    events: [
      { id: 'singles', name: 'Singles', format: 'singles', scoring: 'handicap', games: 3, scoringLabel: 'Handicap 90% of 220', divisions: [openDivision, seniorDivision] },
      {
        id: 'doubles',
        name: 'Doubles',
        format: 'doubles',
        scoring: 'scratch',
        games: 0,
        scoringLabel: 'Scratch',
        divisions: [{
          id: null,
          name: null,
          entryCount: 1,
          advancingCount: null,
          cashingCount: null,
          rows: [row('d1', 1, 'Ann Lee & Bob Ray', [400, 380], { bowlers: [{ name: 'Ann Lee', average: 190, handicapPerGame: 0 }, { name: 'Bob Ray', average: 180, handicapPerGame: 0 }] })],
          finals: {
            type: 'round-robin',
            label: 'Round robin, Petersen points',
            status: 'in-progress',
            champion: null,
            matches: [],
            rounds: [],
            table: [{ rank: 1, seed: 1, name: 'Ann Lee & Bob Ray', wins: 3, losses: 1, ties: 0, pins: 1610, points: 21.5 }],
            notes: '',
          },
        }],
      },
      {
        id: 'team',
        name: 'Team',
        format: 'team',
        scoring: 'no-tap',
        games: 1,
        scoringLabel: '9-pin no-tap, scratch',
        divisions: [{
          id: null,
          name: null,
          entryCount: 0,
          advancingCount: null,
          cashingCount: null,
          rows: [],
          finals: {
            type: 'survivor',
            label: 'Survivor',
            status: 'in-progress',
            champion: null,
            matches: [],
            rounds: [
              { round: 1, label: 'Round 1', rows: [{ seed: 1, name: 'Pin Pals', score: 700, eliminated: false }, { seed: 2, name: 'Gutter Gang', score: 600, eliminated: true }] },
              { round: 2, label: 'Round 2', rows: [{ seed: 1, name: 'Pin Pals', score: null, eliminated: false }] },
            ],
            table: [],
            notes: 'Lowest score each round is out.',
          },
        }],
      },
    ],
    allEvents: {
      events: [{ id: 'singles', name: 'Singles' }, { id: 'doubles', name: 'Doubles' }],
      cashingCount: 1,
      rows: [
        { key: 'b1', rank: 1, tied: false, name: 'Ann Lee', eventTotals: [660, 400], total: 1060, status: 'cashing' },
        { key: 'b2', rank: 2, tied: false, name: 'Bob Ray', eventTotals: [615, null], total: 615, status: null },
      ],
    },
    ...overrides,
  };
}

function okResponse(data: LiveStandings) {
  return { ok: true, status: 200, json: async () => data };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const standingsTable = () => screen.getByRole('table', { name: /standings/ });
const bodyRows = () => within(standingsTable()).getAllByRole('row').slice(1);

beforeEach(() => {
  setVisibility('visible');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(payload())));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live standings page', () => {
  it('accepts numeric and tc- ids and builds links', () => {
    expect(parseLiveTournamentId('58')).toBe(58);
    expect(parseLiveTournamentId('tc-58')).toBe(58);
    expect(parseLiveTournamentId('abc')).toBeNull();
    expect(parseLiveTournamentId('0')).toBeNull();
    expect(livePagePath('tc-58')).toBe('/live/tc-58');
    expect(livePagePath(58)).toBe('/live/tc-58');
    expect(liveStandingsPath(58)).toBe('/api/v1/public/tc-tournament/58/standings');
  });

  it('shows the header, key numbers, tie ranks, cut and cash lines, and the handicap column', () => {
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'County Open' })).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Nov 15, 2026 · Meridian Lanes, Meridian, ID')).toBeInTheDocument();
    expect(screen.getByText(/auto-refresh on/)).toBeInTheDocument();
    const stats = screen.getByRole('region', { name: 'Tournament totals' });
    expect(within(stats).getByText('7')).toBeInTheDocument();
    expect(within(stats).getByText('3')).toBeInTheDocument();
    expect(within(stats).getByText('780')).toBeInTheDocument();

    expect(within(standingsTable()).getByRole('columnheader', { name: 'Hdcp' })).toBeInTheDocument();
    expect(within(standingsTable()).getByRole('columnheader', { name: 'G3' })).toBeInTheDocument();
    const rows = bodyRows();
    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Ann Lee'),
      expect.stringContaining('Bob Ray'),
      'Cut line: top 2 advance to finals',
      expect.stringContaining('Cara Diaz'),
      'In the money: top 3 cash',
      expect.stringContaining('Dan Fox'),
      expect.stringContaining('Eve Moss'),
    ]);
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('T2');
    expect(within(rows[3]).getAllByRole('cell')[0]).toHaveTextContent('T2');
    expect(within(rows[1]).getByText('Advancing')).toBeInTheDocument();
    expect(within(rows[3]).getByText('Cashing')).toBeInTheDocument();
    expect(within(rows[6]).getByText('Not bowled yet')).toBeInTheDocument();
    // Zeros and unbowled games are secondary.
    const danCells = within(rows[5]).getAllByRole('cell');
    expect(danCells[3]).toHaveAttribute('data-tone', 'secondary');
    expect(danCells[4]).toHaveTextContent('—');
    expect(danCells[danCells.length - 1]).toHaveAttribute('data-emphasis', 'true');
  });

  it('filters rows with Find a bowler and hides the divider lines while searching', () => {
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a bowler' }), { target: { value: 'cara' } });
    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Cara Diaz');
    expect(screen.queryByText(/Cut line/)).not.toBeInTheDocument();
  });

  it('switches divisions and events; scratch events hide the handicap column', () => {
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Division' })).getByRole('button', { name: /Senior/ }));
    expect(screen.getByRole('heading', { name: 'Singles · Senior' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Scores will appear here once bowling starts.');
    expect(bodyRows()[0]).toHaveTextContent('Not bowled yet');

    fireEvent.click(within(screen.getByRole('group', { name: 'Event' })).getByRole('button', { name: 'Doubles' }));
    expect(screen.getByRole('heading', { name: 'Doubles' })).toBeInTheDocument();
    expect(within(standingsTable()).queryByRole('columnheader', { name: 'Hdcp' })).not.toBeInTheDocument();
    expect(within(standingsTable()).getByRole('columnheader', { name: 'G2' })).toBeInTheDocument();
    expect(within(standingsTable()).queryByRole('columnheader', { name: 'G3' })).not.toBeInTheDocument();
    expect(screen.getByText('Ann Lee, Bob Ray')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('group', { name: 'Event' })).getByRole('button', { name: 'Team' }));
    expect(screen.getByText('No entries yet')).toBeInTheDocument();
  });

  it('shows finals: stepladder matches, round robin table, survivor rounds, and notes', () => {
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    fireEvent.click(screen.getAllByRole('link', { name: 'Finals' })[0]);

    const singles = screen.getByRole('region', { name: 'Singles · Open finals' });
    expect(within(singles).getByText('Complete')).toBeInTheDocument();
    const title = within(singles).getByRole('group', { name: 'Title match' });
    expect(within(title).getByLabelText('Winner')).toBeInTheDocument();
    expect(within(title).getByText('+23')).toBeInTheDocument();
    expect(within(singles).getAllByText('Ann Lee').length).toBeGreaterThan(0);
    expect(within(singles).getByText('Won the final 214 to 191')).toBeInTheDocument();

    const doubles = screen.getByRole('region', { name: 'Doubles finals' });
    expect(within(doubles).getByRole('columnheader', { name: 'W-L-T' })).toBeInTheDocument();
    expect(within(doubles).getByText('3-1-0')).toBeInTheDocument();

    const team = screen.getByRole('region', { name: 'Team finals' });
    expect(within(team).getByText('Lowest score each round is out.')).toBeInTheDocument();
    expect(within(team).getByText('Out after round 1')).toBeInTheDocument();
    expect(within(team).getByRole('columnheader', { name: 'Round 2' })).toBeInTheDocument();
  });

  it('shows the champion line for round robin finals', () => {
    const data = payload();
    const finals = data.events[1].divisions[0].finals;
    if (finals) {
      finals.status = 'complete';
      finals.champion = { name: 'Ann Lee & Bob Ray', detail: 'Won with 21.5 points' };
    }
    render(<LiveStandingsView tournamentId={58} initialData={data} />);
    fireEvent.click(screen.getAllByRole('link', { name: 'Finals' })[0]);
    const doubles = screen.getByRole('region', { name: 'Doubles finals' });
    expect(within(doubles).getByText(/Champion:/)).toHaveTextContent('Champion: Ann Lee & Bob Ray, won with 21.5 points');
  });

  it('shows All events totals with the cashing line, and hides tabs the tournament does not use', () => {
    const { unmount } = render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    fireEvent.click(screen.getAllByRole('link', { name: 'All events' })[0]);
    const table = screen.getByRole('table', { name: 'All events standings' });
    expect(within(table).getByRole('columnheader', { name: 'Doubles' })).toBeInTheDocument();
    expect(within(table).getByText('In the money: top 1 cash')).toBeInTheDocument();
    expect(within(table).getByText('1060')).toBeInTheDocument();
    unmount();

    const plain = payload({ allEvents: null, events: [{ ...payload().events[0], divisions: [seniorDivision] }] });
    render(<LiveStandingsView tournamentId={58} initialData={plain} />);
    expect(screen.queryByRole('link', { name: 'Finals' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'All events' })).not.toBeInTheDocument();
  });

  it('polls every 10 seconds and only updates when the fingerprint changes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(payload({ tournament: { ...payload().tournament, name: 'Same fingerprint' } })))
      .mockResolvedValueOnce(okResponse(payload({ fingerprint: 'fp-2', tournament: { ...payload().tournament, name: 'County Open finals day' } })));
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    const before = screen.getByText('Ann Lee', { selector: 'span' });
    expect(fetchMock).not.toHaveBeenCalled();

    await advance(LIVE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/public/tc-tournament/58/standings', expect.objectContaining({ cache: 'no-store' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('County Open');

    await advance(LIVE_POLL_MS);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('County Open finals day');
    // Rows are keyed, so React updates them in place.
    expect(screen.getByText('Ann Lee', { selector: 'span' })).toBe(before);
  });

  it('pauses while the tab is hidden and refreshes when it is shown again', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(okResponse(payload()));
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    act(() => setVisibility('hidden'));
    await advance(LIVE_POLL_MS * 3);
    expect(fetchMock).not.toHaveBeenCalled();
    act(() => setVisibility('visible'));
    await advance(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(LIVE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last data on errors and says it is reconnecting after two failures', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
      .mockResolvedValue(okResponse(payload()));
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    await advance(LIVE_POLL_MS);
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
    await advance(LIVE_POLL_MS);
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
    expect(screen.getByText('Ann Lee', { selector: 'span' })).toBeInTheDocument();
    await advance(LIVE_POLL_MS);
    expect(screen.queryByText('Reconnecting...')).not.toBeInTheDocument();
  });

  it('refreshes on demand', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(payload({ fingerprint: 'fp-3', tournament: { ...payload().tournament, status: 'final' } })));
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('Final')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the not-found state for a tournament that is not public', async () => {
    render(<LiveStandingsView tournamentId={404} initialData={null} initialNotFound />);
    expect(screen.getByText('Live standings are not available')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find a tournament' })).toHaveAttribute('href', '/');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('switches to the not-found state when the tournament stops being public', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({}) }));
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    await advance(LIVE_POLL_MS);
    expect(screen.getByText('Live standings are not available')).toBeInTheDocument();
  });

  it('loads in the browser when the server had no first payload', async () => {
    render(<LiveStandingsView tournamentId={58} initialData={null} />);
    expect(screen.getByText('Loading live standings...')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'County Open' })).toBeInTheDocument();
  });

  it('copies the page link with Share', async () => {
    const user = userEvent.setup();
    render(<LiveStandingsView tournamentId={58} initialData={payload()} />);
    await user.click(screen.getByRole('button', { name: 'Share live standings' }));
    expect(await screen.findByRole('button', { name: 'Link copied' })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(window.location.href);
  });

  it('TV mode hides search, Share, and Refresh and cycles through events', async () => {
    vi.useFakeTimers();
    render(<LiveStandingsView tournamentId={58} initialData={payload()} tv />);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Singles · Open' })).toBeInTheDocument();
    await advance(TV_CYCLE_MS);
    expect(screen.getByRole('heading', { name: 'Singles · Senior' })).toBeInTheDocument();
    await advance(TV_CYCLE_MS);
    expect(screen.getByRole('heading', { name: 'Doubles' })).toBeInTheDocument();
  });
});
