import { describe, expect, it } from 'vitest';

import type { OrganizerRegistrationRecord } from './organizerApi';
import { emptySquad } from './setupFactories';
import { buildRegistrationSummary, buildSquadSummaries, isTournamentDayWindow, localIsoDate, registrationStatusDetail } from './tournamentInsights';

const squad = { ...emptySquad(), id: '1130', name: '11:30 AM', capacity: 75 };
type Entry = NonNullable<OrganizerRegistrationRecord['entries']>[number];

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 1,
    event_config_id: 'doubles',
    event_name: 'Doubles',
    squad_config_id: squad.id,
    status: 'confirmed',
    entry_fee_cents: 4000,
    bowler_count: 2,
    ...overrides,
  };
}

describe('buildSquadSummaries', () => {
  it('separates a doubles registration from its two occupied bowler spots', () => {
    const [summary] = buildSquadSummaries([squad], [{ status: 'confirmed', entries: [entry()] }]);

    expect(summary).toMatchObject({
      registrationCount: 1,
      bowlerCount: 2,
      availableBowlerSpots: 73,
      waitlistedRegistrationCount: 0,
      waitlistedBowlerCount: 0,
      status: 'Open',
    });
  });

  it('counts each submission once per squad but counts bowlers in every active entry', () => {
    const [summary] = buildSquadSummaries([squad], [{
      entries: [
        entry(),
        entry({ id: 2, status: 'pending', bowler_count: 1 }),
        entry({ id: 3, squad_config_id: 'other', bowler_count: 4 }),
      ],
    }]);

    expect(summary).toMatchObject({ registrationCount: 1, bowlerCount: 3, availableBowlerSpots: 72 });
  });

  it('uses entry statuses like the public API, independently of the submission status', () => {
    const [summary] = buildSquadSummaries([squad], [
      { status: 'confirmed', entries: [entry({ status: 'cancelled' }), entry({ status: 'refunded' })] },
      { status: 'confirmed', entries: [entry({ status: 'waitlisted', bowler_count: 4 })] },
      { status: 'cancelled', entries: [entry({ status: 'pending', bowler_count: 1 })] },
      { status: 'waitlisted', entries: [entry({ status: 'confirmed' })] },
      { entries: [] },
    ]);

    expect(summary).toMatchObject({
      registrationCount: 2,
      bowlerCount: 3,
      availableBowlerSpots: 72,
      waitlistedRegistrationCount: 1,
      waitlistedBowlerCount: 4,
      status: 'Waitlist',
    });
  });

  it.each([
    [63, 'Open', 12],
    [64, 'Nearly Full', 11],
    [75, 'Full', 0],
    [76, 'Full', 0],
  ])('uses %i occupied bowler spots to determine %s status', (bowlerCount, status, availableBowlerSpots) => {
    const [summary] = buildSquadSummaries([squad], [{ entries: [entry({ bowler_count: bowlerCount })] }]);

    expect(summary).toMatchObject({ registrationCount: 1, bowlerCount, status, availableBowlerSpots });
  });

  it('reports waitlisting at full capacity without consuming extra spots', () => {
    const [summary] = buildSquadSummaries([squad], [{
      entries: [entry({ bowler_count: 75 }), entry({ status: 'waitlisted' })],
    }]);

    expect(summary).toMatchObject({
      registrationCount: 1, bowlerCount: 75, waitlistedRegistrationCount: 1,
      waitlistedBowlerCount: 2, availableBowlerSpots: 0, status: 'Waitlist',
    });
  });

  it('preserves unspecified capacity and empty squads', () => {
    expect(buildSquadSummaries([{ ...squad, capacity: 0 }], [])[0]).toMatchObject({
      registrationCount: 0, bowlerCount: 0, availableBowlerSpots: null, status: 'Open',
    });
    expect(buildSquadSummaries([], [])).toEqual([]);
  });
});

describe('tournament day window', () => {
  it('opens the day before the start and closes after the last day', () => {
    expect(isTournamentDayWindow('2026-11-14', '2026-11-15', '2026-11-12')).toBe(false);
    expect(isTournamentDayWindow('2026-11-14', '2026-11-15', '2026-11-13')).toBe(true);
    expect(isTournamentDayWindow('2026-11-14', '2026-11-15', '2026-11-14')).toBe(true);
    expect(isTournamentDayWindow('2026-11-14', '2026-11-15', '2026-11-15')).toBe(true);
    expect(isTournamentDayWindow('2026-11-14', '2026-11-15', '2026-11-16')).toBe(false);
  });

  it('treats a missing end date as a one-day tournament and crosses month boundaries', () => {
    expect(isTournamentDayWindow('2026-12-01', null, '2026-11-30')).toBe(true);
    expect(isTournamentDayWindow('2026-12-01', null, '2026-12-02')).toBe(false);
    expect(isTournamentDayWindow(null, null, '2026-12-01')).toBe(false);
  });

  it('formats the local date as YYYY-MM-DD', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('registration status detail', () => {
  it('always shows confirmed and only nonzero pending and waitlisted counts', () => {
    const registration = (status: string) => ({ id: 1, status } as OrganizerRegistrationRecord);
    expect(registrationStatusDetail(buildRegistrationSummary([registration('confirmed')]))).toBe('1 confirmed');
    expect(registrationStatusDetail(buildRegistrationSummary([]))).toBe('0 confirmed');
    expect(registrationStatusDetail(buildRegistrationSummary([
      registration('confirmed'), registration('pending'), registration('waitlisted'), registration('cancelled'),
    ]))).toBe('1 confirmed · 1 pending · 1 waitlisted');
  });
});
