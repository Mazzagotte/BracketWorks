import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LiveFinalsView from './LiveFinalsView';
import { TV_CYCLE_MS } from './LiveShell';
import type { FinalsMatch, FinalsSide, LiveDivision, LiveFinals, LiveStandings, StandingRow } from './liveStandingsTypes';
import { LIVE_POLL_MS } from './useLiveStandings';

function side(seed: number, name: string, score: number | null = null, winner = false): FinalsSide {
  return { seed, name, score, winner };
}

function match(id: string, round: number, label: string, a: FinalsSide | null, b: FinalsSide | null): FinalsMatch {
  return { id, round, label, a, b };
}

function finals(overrides: Partial<LiveFinals>): LiveFinals {
  return {
    type: 'stepladder',
    label: 'Stepladder, top 4',
    status: 'in-progress',
    champion: null,
    matches: [],
    rounds: [],
    table: [],
    placings: [],
    notes: '',
    ...overrides,
  };
}

function qualifier(key: string, rank: number, name: string, total: number, status: StandingRow['status']): StandingRow {
  return {
    key, rank, tied: false, name, bowlers: [{ name, average: 190, handicapPerGame: 0 }], games: [total], gamesBowled: 1,
    scratchTotal: total, handicapTotal: 0, total, status, squadLabel: null,
  };
}

function group(finalsData: LiveFinals | null, extra: Partial<LiveDivision> = {}): LiveDivision {
  return { id: null, name: null, entryCount: 6, advancingCount: 4, cashingCount: 2, rows: [], finals: finalsData, ...extra };
}

const stepladderInProgress = finals({
  matches: [
    match('r1-m1', 1, 'Match 1', side(4, 'Dave Kim', 291, true), side(3, 'Terry Wallace', 249)),
    match('r2-m1', 2, 'Match 2', side(4, 'Dave Kim', 201), side(2, 'Robin Hayes')),
    match('r3-m1', 3, 'Title match', null, side(1, 'Alex Brooks')),
  ],
  placings: [{ key: '12', place: 4, tied: false, name: 'Terry Wallace', cashing: false }],
});

const stepladderComplete = finals({
  label: 'Stepladder, top 3',
  status: 'complete',
  champion: { name: 'Robin Hayes', detail: 'Won the title match 284 to 265' },
  matches: [
    match('r1-m1', 1, 'Match 1', side(3, 'Dave Kim', 220), side(2, 'Robin Hayes', 241, true)),
    match('r2-m1', 2, 'Title match', side(2, 'Robin Hayes', 284, true), side(1, 'Alex Brooks', 265)),
  ],
  placings: [
    { key: 'r', place: 1, tied: false, name: 'Robin Hayes', cashing: true },
    { key: 'a', place: 2, tied: false, name: 'Alex Brooks', cashing: true },
    { key: 'd', place: 3, tied: false, name: 'Dave Kim', cashing: false },
  ],
});

function payload(divisionGroup: LiveDivision, overrides: Partial<LiveStandings> = {}): LiveStandings {
  return {
    tournament: { id: 58, name: 'County Open', dateText: 'Nov 15, 2026', locationText: 'Meridian Lanes, Meridian, ID', status: 'in-progress', logoUrl: null },
    updatedAt: '2026-11-15T20:08:00Z',
    fingerprint: 'fp-1',
    events: [{ id: 'singles', name: 'Singles', format: 'singles', scoring: 'scratch', games: 1, scoringLabel: 'Scratch', divisions: [divisionGroup] }],
    allEvents: null,
    ...overrides,
  };
}

function okResponse(data: LiveStandings) {
  return { ok: true, status: 200, json: async () => data };
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const spotlight = () => screen.getByRole('region', { name: 'Now bowling' });

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse(payload(group(stepladderInProgress)))));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('live finals page', () => {
  it('uses the live shell with links to standings and the active Finals view', () => {
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(stepladderInProgress), { allEvents: { events: [], cashingCount: null, rows: [] } })} />);
    expect(screen.getByRole('heading', { level: 1, name: 'County Open' })).toBeInTheDocument();
    expect(screen.getByText('Nov 15, 2026 · Meridian Lanes, Meridian, ID')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Standings' })[0]).toHaveAttribute('href', '/live/tc-58');
    expect(screen.getAllByRole('link', { name: 'Finals' })[0]).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link', { name: 'All events' })[0]).toHaveAttribute('href', '/live/tc-58?view=all-events');
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share live finals' })).toBeInTheDocument();
  });

  it('stepladder: spotlights the current match, says what is next, and draws the ladder', () => {
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(stepladderInProgress))} />);
    const now = spotlight();
    expect(within(now).getByText('Match 2 · Singles')).toBeInTheDocument();
    expect(within(now).getByText('Dave Kim')).toBeInTheDocument();
    expect(within(now).getByText('Robin Hayes')).toBeInTheDocument();
    expect(within(now).getByLabelText('Dave Kim: 201')).toHaveTextContent('201');
    expect(within(now).getByLabelText('Robin Hayes: no score yet')).toHaveTextContent('—');
    expect(within(now).getByText('Up next: Title match, winner of Match 2 vs Alex Brooks (seed 1)')).toBeInTheDocument();

    const ladder = screen.getByRole('region', { name: 'Singles stepladder' });
    expect(within(ladder).getByRole('group', { name: 'Match 2' })).toHaveAttribute('aria-current', 'step');
    expect(within(ladder).getByRole('group', { name: 'Title match' })).toHaveTextContent('Seed 1 waits');
    // Placings decided so far sit under the ladder while the finals are in progress.
    expect(within(screen.getByRole('region', { name: 'Placings' })).getByText('4th')).toBeInTheDocument();
    const stats = screen.getByRole('region', { name: 'Finals totals' });
    expect(within(stats).getByText('1 of 3')).toBeInTheDocument();
    expect(within(stats).getByText('291')).toBeInTheDocument();
  });

  it('match play: spotlights the first open match in order and draws two halves for 8 finalists', () => {
    const quarter = (n: number, a: FinalsSide, b: FinalsSide) => match(`r1-m${n}`, 1, `Quarterfinal ${n}`, a, b);
    const data = finals({
      type: 'match-play-single',
      label: 'Match play, top 8',
      matches: [
        quarter(1, side(1, 'Ann Lee', 220, true), side(8, 'Hal Ng', 180)),
        quarter(2, side(4, 'Dee Cox', 210, true), side(5, 'Eli Orr', 200)),
        quarter(3, side(2, 'Bob Ray', 190), side(7, 'Gil Pau')),
        quarter(4, side(3, 'Cara Diaz', 230, true), side(6, 'Fay Ito', 199)),
        match('r2-m1', 2, 'Semifinal 1', side(1, 'Ann Lee'), side(4, 'Dee Cox')),
        match('r2-m2', 2, 'Semifinal 2', null, side(3, 'Cara Diaz')),
        match('r3-m1', 3, 'Final', null, null),
      ],
    });
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(data))} />);
    expect(within(spotlight()).getByText('Quarterfinal 3 · Singles')).toBeInTheDocument();
    expect(within(spotlight()).getByText('Up next: Semifinal 1, Ann Lee (seed 1) vs Dee Cox (seed 4)')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Quarterfinals, left half' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Quarterfinals, right half' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Quarterfinal 3' })).toHaveAttribute('aria-current', 'step');
  });

  it('round robin: spotlights the first unfinished game and shows the grid and points', () => {
    const data = finals({
      type: 'round-robin',
      label: 'Round robin, Petersen points',
      matches: [
        match('r1-m1', 1, 'Round 1, match 1', side(1, 'Ann Lee', 214, true), side(2, 'Bob Ray', 190)),
        match('r2-m1', 2, 'Round 2, match 1', side(1, 'Ann Lee', 200), side(3, 'Cara Diaz')),
        match('r3-m1', 3, 'Round 3, match 1', side(2, 'Bob Ray'), side(3, 'Cara Diaz')),
      ],
      table: [
        { key: 'a', rank: 1, seed: 1, name: 'Ann Lee', wins: 1, losses: 0, ties: 0, pins: 414, points: 9 },
        { key: 'b', rank: 2, seed: 2, name: 'Bob Ray', wins: 0, losses: 1, ties: 0, pins: 190, points: 3 },
        { key: 'c', rank: 3, seed: 3, name: 'Cara Diaz', wins: 0, losses: 0, ties: 0, pins: 0, points: 0 },
      ],
    });
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(data))} />);
    expect(within(spotlight()).getByText('Round 2, match 1 · Singles')).toBeInTheDocument();
    expect(within(spotlight()).getByText('Up next: Round 3, match 1, Bob Ray (seed 2) vs Cara Diaz (seed 3)')).toBeInTheDocument();
    const grid = screen.getByRole('table', { name: 'Singles head to head' });
    const annRow = within(grid).getAllByRole('row')[1];
    expect(within(annRow).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['', '214 W', '200']);
    expect(screen.getByRole('table', { name: 'Singles round robin points' })).toHaveTextContent('1-0-0');
  });

  it('survivor: spotlights the round being bowled and marks who is out', () => {
    const data = finals({
      type: 'survivor',
      label: 'Survivor',
      rounds: [
        { round: 1, label: 'Round 1', rows: [
          { key: 'a', seed: 1, name: 'Ann Lee', score: 220, eliminated: false },
          { key: 'b', seed: 2, name: 'Bob Ray', score: 180, eliminated: true },
          { key: 'c', seed: 3, name: 'Cara Diaz', score: 210, eliminated: false },
        ] },
        { round: 2, label: 'Round 2', rows: [
          { key: 'a', seed: 1, name: 'Ann Lee', score: null, eliminated: false },
          { key: 'c', seed: 3, name: 'Cara Diaz', score: 199, eliminated: false },
        ] },
      ],
    });
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(data))} />);
    expect(within(spotlight()).getByText('Round 2 · Singles')).toBeInTheDocument();
    expect(within(spotlight()).getByLabelText('Cara Diaz: 199')).toBeInTheDocument();
    const rounds = screen.getByRole('region', { name: 'Singles survivor rounds' });
    const first = within(rounds).getByRole('region', { name: 'Round 1' });
    expect(within(first).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Ann Lee'),
      expect.stringContaining('Cara Diaz'),
      expect.stringMatching(/Bob Ray.*Out/),
    ]);
    expect(within(rounds).getByRole('region', { name: 'Round 2' })).toHaveAttribute('aria-current', 'step');
  });

  it('complete: shows the champion and placings instead of the spotlight', () => {
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(stepladderComplete))} />);
    expect(screen.queryByRole('region', { name: 'Now bowling' })).not.toBeInTheDocument();
    const champion = screen.getByRole('region', { name: 'Champion' });
    expect(within(champion).getByRole('heading', { name: 'Champion: Robin Hayes' })).toBeInTheDocument();
    expect(within(champion).getByText('Won the title match 284 to 265')).toBeInTheDocument();
    const placings = within(champion).getByRole('region', { name: 'Placings' });
    expect(within(placings).getAllByText('Cashes')).toHaveLength(2);
    // Placings appear once, in the champion card.
    expect(screen.getAllByRole('region', { name: 'Placings' })).toHaveLength(1);
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('not started: says finals start after qualifying and lists the advancing qualifiers', () => {
    const division = group(finals({ status: 'not-started', label: 'Stepladder, top 2' }), {
      advancingCount: 2,
      rows: [
        qualifier('e2', 2, 'Bob Ray', 610, 'advancing'),
        qualifier('e1', 1, 'Ann Lee', 650, 'advancing'),
        qualifier('e3', 3, 'Cara Diaz', 590, null),
      ],
    });
    render(<LiveFinalsView tournamentId={58} initialData={payload(division)} />);
    expect(screen.getByText('Finals start after qualifying.')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Advancing qualifiers' });
    const rows = within(table).getAllByRole('row').slice(1).map((row) => row.textContent);
    expect(rows).toEqual(['1Ann Lee650', '2Bob Ray610']);
    expect(screen.queryByRole('region', { name: 'Now bowling' })).not.toBeInTheDocument();
  });

  it('updates only when the fingerprint changes, keeping rows in place', async () => {
    vi.useFakeTimers();
    const scored = finals({
      ...stepladderInProgress,
      matches: [
        stepladderInProgress.matches[0],
        match('r2-m1', 2, 'Match 2', side(4, 'Dave Kim', 201), side(2, 'Robin Hayes', 230, true)),
        match('r3-m1', 3, 'Title match', side(2, 'Robin Hayes'), side(1, 'Alex Brooks')),
      ],
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(okResponse(payload(group(scored))))
      .mockResolvedValueOnce(okResponse(payload(group(scored), { fingerprint: 'fp-2' })));
    vi.stubGlobal('fetch', fetchMock);
    render(<LiveFinalsView tournamentId={58} initialData={payload(group(stepladderInProgress))} />);
    const before = within(screen.getByRole('region', { name: 'Singles stepladder' })).getByRole('group', { name: 'Match 1' });

    await advance(LIVE_POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(within(spotlight()).getByText('Match 2 · Singles')).toBeInTheDocument();

    await advance(LIVE_POLL_MS);
    expect(within(spotlight()).getByText('Title match · Singles')).toBeInTheDocument();
    expect(within(spotlight()).getByText('Robin Hayes')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Singles stepladder' })).getByRole('group', { name: 'Match 1' })).toBe(before);
  });

  it('switches finals groups with the pickers and opens on the group from the link', () => {
    const data = payload(group(stepladderInProgress));
    data.events.push({
      id: 'doubles', name: 'Doubles', format: 'doubles', scoring: 'scratch', games: 1, scoringLabel: 'Scratch',
      divisions: [group(stepladderComplete)],
    });
    data.events.push({ id: 'team', name: 'Team', format: 'team', scoring: 'scratch', games: 1, scoringLabel: 'Scratch', divisions: [group(null)] });
    const { unmount } = render(<LiveFinalsView tournamentId={58} initialData={data} />);
    const picker = screen.getByRole('group', { name: 'Event' });
    // Events without finals are not offered.
    expect(within(picker).queryByRole('button', { name: 'Team' })).not.toBeInTheDocument();
    fireEvent.click(within(picker).getByRole('button', { name: 'Doubles' }));
    expect(screen.getByRole('heading', { name: 'Champion: Robin Hayes' })).toBeInTheDocument();
    unmount();

    render(<LiveFinalsView tournamentId={58} initialData={data} initialSelection={{ event: 'doubles' }} />);
    expect(screen.getByRole('region', { name: 'Doubles finals' })).toBeInTheDocument();
  });

  it('TV mode hides pickers, Share, and Refresh and cycles through finals groups', async () => {
    vi.useFakeTimers();
    const data = payload(group(stepladderInProgress));
    data.events.push({
      id: 'doubles', name: 'Doubles', format: 'doubles', scoring: 'scratch', games: 1, scoringLabel: 'Scratch',
      divisions: [group(stepladderComplete)],
    });
    render(<LiveFinalsView tournamentId={58} initialData={data} tv />);
    expect(screen.queryByRole('group', { name: 'Event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Share/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Standings' })[0]).toHaveAttribute('href', '/live/tc-58?tv=1');
    expect(screen.getByRole('region', { name: 'Singles finals' })).toBeInTheDocument();
    await advance(TV_CYCLE_MS);
    expect(screen.getByRole('region', { name: 'Doubles finals' })).toBeInTheDocument();
    await advance(TV_CYCLE_MS);
    expect(screen.getByRole('region', { name: 'Singles finals' })).toBeInTheDocument();
  });

  it('shows the not-found state for a tournament that is not public', () => {
    render(<LiveFinalsView tournamentId={404} initialData={null} initialNotFound />);
    expect(screen.getByText('Live finals are not available')).toBeInTheDocument();
  });
});
