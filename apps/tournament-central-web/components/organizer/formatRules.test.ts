import { describe, expect, it } from 'vitest';
import { defaultEventRules, defaultSideEvent } from './formatTypes';
import { bracketPayoutSummary, divisionLimitParts, eventRulesSummary, finalsSummary, handicapExample, handicapFormula, sideEventSummary } from './formatSummaries';
import { emptyEvent, emptyFee } from './setupFactories';
import { eventRuleProblems, formatRuleIssues, sideEventProblems } from './setupValidation';
import type { EventConfig, FeeConfig } from './types';

function event(rulesPatch: Partial<NonNullable<EventConfig['rules']>> = {}, overrides: Partial<EventConfig> = {}): EventConfig {
  return { ...emptyEvent(1), id: 'ev-1', name: 'Singles', ...overrides, rules: { ...defaultEventRules('singles', 'handicap'), ...rulesPatch } };
}

function bracketsFee(amountCents: number, brackets: Partial<NonNullable<NonNullable<FeeConfig['sideEvent']>['brackets']>> = {}): FeeConfig {
  const sideEvent = defaultSideEvent('brackets');
  return { ...emptyFee(1), id: 'fee-1', name: 'Brackets', amountCents, sideEvent: { ...sideEvent, brackets: { ...sideEvent.brackets!, ...brackets } } };
}

describe('event rule validation', () => {
  it('accepts the defaults', () => {
    expect(eventRuleProblems(event())).toEqual([]);
  });

  it('checks handicap percent, basis, cut, combined average, and payout ratio', () => {
    const fields = (target: EventConfig) => eventRuleProblems(target).map((problem) => problem.field);
    expect(fields(event({ handicap: { percent: 0, basis: 220, maxPins: null, perPair: false } }))).toEqual(['handicapPercent']);
    expect(fields(event({ handicap: { percent: 101, basis: 0, maxPins: null, perPair: false } }))).toEqual(['handicapPercent', 'handicapBasis']);
    expect(fields(event({ finals: { type: 'stepladder', cut: { by: 'count', value: 0 }, roundRobinScoring: null, winBonusPins: null, notes: '', scope: 'tournament' } }))).toEqual(['cutValue']);
    expect(fields(event({ finals: { type: 'cut', cut: null, roundRobinScoring: null, winBonusPins: null, notes: '', scope: 'tournament' } }))).toEqual(['cutValue']);
    expect(fields(event({ finals: { type: 'cut', cut: { by: 'percent', value: 150 }, roundRobinScoring: null, winBonusPins: null, notes: '', scope: 'tournament' } }))).toEqual(['cutValue']);
    expect(fields(event({ team: { mixedRequired: false, combinedAverageMax: 0 } }))).toEqual(['combinedAverageMax']);
    expect(fields(event({ payoutRatio: 0 }))).toEqual(['payoutRatio']);
  });

  it('ignores handicap settings on scratch events', () => {
    expect(eventRuleProblems(event({ handicap: { percent: 0, basis: 0, maxPins: null, perPair: false } }, { scoring: 'scratch' }))).toEqual([]);
  });

  it('warns, without blocking, when bracket payouts do not add up', () => {
    expect(sideEventProblems(bracketsFee(500))).toEqual([]);
    expect(sideEventProblems(bracketsFee(500, { houseCents: 500 }))).toEqual([
      expect.objectContaining({ field: 'bracketPayouts', severity: 'warning' }),
    ]);
    expect(sideEventProblems(bracketsFee(500, { size: 1 }))[0]).toMatchObject({ field: 'bracketSize', severity: 'error' });
  });

  it('reports issues for enabled events and offered add-ons in their setup steps', () => {
    const issues = formatRuleIssues(
      [event({ payoutRatio: 0 }), event({ payoutRatio: 0 }, { id: 'ev-2', enabled: false })],
      [bracketsFee(600)],
    );
    expect(issues).toEqual([
      expect.objectContaining({ id: 'event-rules-payoutRatio-ev-1', section: 'events-divisions', severity: 'error' }),
      expect.objectContaining({ id: 'fee-rules-bracketPayouts-fee-1', section: 'fees-payments-documents', severity: 'warning' }),
    ]);
  });
});

describe('format summaries', () => {
  it('describes handicap, finals, events, brackets, and divisions in plain words', () => {
    const handicap = { percent: 90, basis: 220, maxPins: null, perPair: false };
    expect(handicapFormula(handicap)).toBe('90% of 220');
    expect(handicapExample(handicap)).toBe('A 180 average gets 36 pins per game.');
    expect(handicapExample({ ...handicap, percent: 80, basis: 440, perPair: true })).toBe('A pair averaging 360 combined gets 64 pins per game.');
    expect(finalsSummary({ type: 'stepladder', cut: { by: 'count', value: 5 }, roundRobinScoring: null, winBonusPins: null, notes: '', scope: 'tournament' })).toBe('Stepladder, top 5');
    expect(eventRulesSummary({ ...defaultEventRules('singles', 'handicap'), games: 3 }, 'handicap')).toBe('Singles · 3 games · Handicap 90% of 220');
    const perSquad = defaultEventRules('singles', 'scratch');
    expect(eventRulesSummary({ ...perSquad, finals: { ...perSquad.finals, type: 'stepladder', scope: 'squad' } }, 'scratch'))
      .toBe('Singles · Scratch · Stepladder · Finals for each squad');
    expect(bracketPayoutSummary(500, defaultSideEvent('brackets').brackets!)).toBe('8 entries at $5 = $40: pays $30 and $10');
    expect(sideEventSummary({ ...defaultSideEvent('brackets'), maxQuantity: 10 })).toBe('Brackets · Per bowler · Up to 10 each');
    expect(divisionLimitParts({ minAge: 50, maxAge: 64, maxAverage: 200, rules: { gender: 'women', prizeType: 'scholarship' } }))
      .toEqual(['Women only', 'Age 50-64', 'Average 200 and under', 'Scholarship prizes']);
  });
});
