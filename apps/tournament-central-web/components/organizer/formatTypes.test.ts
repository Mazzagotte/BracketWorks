import { describe, expect, it } from 'vitest';

import { handicapPins, normalizeDivisionRules, normalizeEventRules, normalizeSideEvent } from './formatTypes';
import { normalizeOrganizerDraft } from './setupSerialization';

describe('tournament format model', () => {
  it('gives events saved before format rules sensible defaults from what they already say', () => {
    const doubles = normalizeEventRules(undefined, { scoring: 'handicap', maxPlayers: 2 });
    expect(doubles.format).toBe('doubles');
    expect(doubles.handicap).toEqual({ percent: 90, basis: 220, maxPins: null, perPair: false });
    expect(normalizeEventRules(undefined, { scoring: 'scratch', maxPlayers: 5 })).toMatchObject({ format: 'team', handicap: null });
  });

  it('keeps saved rules and drops handicap for scratch events', () => {
    const rules = normalizeEventRules({
      format: 'scotch-doubles', games: 3, handicap: { percent: 80, basis: 230, maxPins: 60, perPair: true },
      finals: { type: 'stepladder', cut: { by: 'count', value: 5 } }, usbcRequired: true, reentryScoring: 'best-counts',
    }, { scoring: 'handicap', maxPlayers: 2 });
    expect(rules).toMatchObject({ format: 'scotch-doubles', games: 3, usbcRequired: true, reentryScoring: 'best-counts' });
    expect(rules.handicap).toEqual({ percent: 80, basis: 230, maxPins: 60, perPair: true });
    expect(rules.finals).toMatchObject({ type: 'stepladder', cut: { by: 'count', value: 5 }, scope: 'tournament' });
    expect(normalizeEventRules({ finals: { type: 'stepladder', scope: 'squad' } }, { scoring: 'scratch', maxPlayers: 1 }).finals.scope).toBe('squad');
    expect(normalizeEventRules({ finals: { scope: 'nonsense' } }, { scoring: 'scratch', maxPlayers: 1 }).finals.scope).toBe('tournament');
    expect(normalizeEventRules({ handicap: { percent: 80, basis: 230 } }, { scoring: 'scratch', maxPlayers: 1 }).handicap).toBeNull();
  });

  it('figures handicap per game with the cap', () => {
    expect(handicapPins({ percent: 90, basis: 220, maxPins: null, perPair: false }, 180)).toBe(36);
    expect(handicapPins({ percent: 90, basis: 220, maxPins: 30, perPair: false }, 180)).toBe(30);
    expect(handicapPins({ percent: 90, basis: 220, maxPins: null, perPair: false }, 240)).toBe(0);
  });

  it('treats old fees as plain fees and keeps bracket settings', () => {
    expect(normalizeSideEvent(undefined)).toMatchObject({ kind: 'fee', allowQuantity: false, per: 'registration', brackets: null });
    expect(normalizeSideEvent({ kind: 'brackets', brackets: { scoring: 'scratch', firstPlaceCents: 3500, houseCents: 500 } }))
      .toMatchObject({ kind: 'brackets', allowQuantity: true, per: 'bowler', brackets: { scoring: 'scratch', size: 8, firstPlaceCents: 3500, secondPlaceCents: 1000, houseCents: 500 } });
    expect(normalizeDivisionRules({ gender: 'women', prizeType: 'scholarship' })).toEqual({ gender: 'women', prizeType: 'scholarship' });
  });

  it('normalizes a saved draft that predates the format fields', () => {
    const draft = normalizeOrganizerDraft({
      tournamentId: 1,
      payload: {
        events: [{ id: 'e', name: 'Singles', scoring: 'handicap', minPlayers: 1, maxPlayers: 1 } as never],
        divisions: [{ id: 'd', name: 'Open' } as never],
        fees: [{ id: 'f', name: 'Lineage', amountCents: 500 } as never],
      },
    });
    expect(draft.events[0].rules?.format).toBe('singles');
    expect(draft.divisions[0].rules).toEqual({ gender: 'any', prizeType: 'cash' });
    expect(draft.fees[0].sideEvent?.kind).toBe('fee');
  });
});
